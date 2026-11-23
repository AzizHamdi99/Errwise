import type { Event, Issue } from '@prisma/client';
import { cutWindow } from './fix-window';
import { FIX_CACHE_VERSION, buildFixInput, hashFixInput } from './fix-input';
import type { FixCandidate } from './fix-input';

const ISSUE = { type: 'TypeError' } as Issue;
const EVENT = {
  type: 'TypeError',
  message: 'Cannot read properties of null (reading "profile")',
  stack: 'TypeError: x\n    at getUser (/app/src/users.js:3:15)',
  environment: 'production',
  release: '1.0.0',
  context: { nodeVersion: 'v22.1.0' },
} as unknown as Event;

const lines = (n: number, prefix = 'line') =>
  Array.from({ length: n }, (_, i) => `${prefix} ${i + 1};`).join('\n');

function candidate(overrides: Partial<FixCandidate> = {}): FixCandidate {
  return {
    path: 'src/users.js',
    text: `${lines(100)}\n`,
    line: 50,
    ...overrides,
  };
}

describe('cutWindow', () => {
  it('takes thirty lines on each side of the failing one when they fit', () => {
    const window = cutWindow(lines(100), 50, 4_000);

    expect(window).toMatchObject({
      startLine: 20,
      endLine: 80,
      failingLine: 50,
    });
    expect(window?.raw.split('\n')).toHaveLength(61);
    expect(window?.raw.split('\n')[30]).toBe('line 50;');
  });

  it('stops at the edges of the file', () => {
    expect(cutWindow(lines(10), 2, 4_000)).toMatchObject({
      startLine: 1,
      endLine: 10,
    });
    expect(cutWindow(lines(100), 100, 4_000)).toMatchObject({ endLine: 100 });
  });

  it('shrinks around the failing line until the scrubbed text fits, never cutting a line', () => {
    const window = cutWindow(lines(100), 50, 300);

    expect(window).not.toBeNull();
    expect(window!.code.length).toBeLessThanOrEqual(300);
    expect(window!.startLine).toBeLessThanOrEqual(50);
    expect(window!.endLine).toBeGreaterThanOrEqual(50);
    expect(window!.raw.split('\n')).toContain('line 50;');
    for (const line of window!.raw.split('\n'))
      expect(line).toMatch(/^line \d+;$/);
  });

  it('checks the limit after scrubbing, because a placeholder can be longer', () => {
    // "a@b.cd" (6 chars) becomes "[email]" (7 chars).
    const text = Array.from({ length: 40 }, () => 'a@b.cd').join('\n');
    const window = cutWindow(text, 20, 100);

    expect(window!.code.length).toBeLessThanOrEqual(100);
    expect(window!.code).toContain('[email]');
    expect(window!.raw).toContain('a@b.cd');
  });

  it('is null when the failing line alone is too long, or not in the file', () => {
    expect(
      cutWindow(`short\n${'x'.repeat(5_000)}\nshort`, 2, 4_000),
    ).toBeNull();
    expect(cutWindow(lines(10), 11, 4_000)).toBeNull();
    expect(cutWindow(lines(10), 0, 4_000)).toBeNull();
    expect(cutWindow('', 1, 4_000)).toBeNull();
    expect(cutWindow('\n\n  \n', 2, 4_000)).toBeNull(); // only blank lines
  });

  it('does not count the newline at the end of a file as a line', () => {
    expect(cutWindow('a\nb\n', 2, 4_000)).toMatchObject({
      endLine: 2,
      raw: 'a\nb',
    });
  });

  it('removes secrets from what leaves, and keeps the real text apart', () => {
    const text =
      'const a = 1;\nconst key = "sk-abcdefghijklmnopqrstuvwxyz";\nbreak();';
    const window = cutWindow(text, 3, 4_000)!;

    expect(window.code).not.toContain('sk-abcdef');
    expect(window.code).toContain('[key]');
    expect(window.raw).toContain('sk-abcdef');
  });
});

describe('buildFixInput', () => {
  it('builds a scrubbed request and what its answer is checked against', () => {
    const prepared = buildFixInput(ISSUE, EVENT, [candidate()])!;

    expect(prepared.request).toMatchObject({
      type: 'TypeError',
      environment: 'production',
      release: '1.0.0',
      runtime: 'node 22.1.0',
      files: [{ file: 'src/users.js', startLine: 20, failingLine: 50 }],
    });
    expect(prepared.files.get('src/users.js')).toMatchObject({
      window: { startLine: 20, endLine: 80 },
    });
    expect(prepared.windows[0]).toMatchObject({
      path: 'src/users.js',
      startLine: 20,
    });
  });

  it('removes personal data from the error text and the code', () => {
    const event = {
      ...EVENT,
      message: 'User bob@x.com not found',
      stack:
        'Error\n    at f (/app/a.js:1:1)\n    token=Bearer abcdefghijklmnop',
    } as Event;
    const text = `${lines(5)}\nconst owner = "carol@y.org";\n`;

    const prepared = buildFixInput(ISSUE, event, [
      candidate({ text, line: 3 }),
    ])!;
    const sent = JSON.stringify(prepared.request);

    expect(sent).not.toContain('bob@x.com');
    expect(sent).not.toContain('carol@y.org');
    expect(sent).not.toContain('abcdefghijklmnop');
    expect(sent).toContain('[email]');
  });

  it('never sends the free-form context of the event', () => {
    const event = {
      ...EVENT,
      context: { user: 'x', nodeVersion: 'v22.0.0' },
    } as Event;
    const sent = JSON.stringify(
      buildFixInput(ISSUE, event, [candidate()])!.request,
    );
    expect(sent).not.toContain('"user"');
  });

  it('leaves out files the feature may not edit, before the model sees them', () => {
    const prepared = buildFixInput(ISSUE, EVENT, [
      candidate({ path: '.github/workflows/ci.js' }),
      candidate({ path: 'src/users.test.js' }),
      candidate({ path: 'webpack.config.js' }),
      candidate({ path: 'src/ok.js' }),
    ])!;

    expect(prepared.request.files.map((f) => f.file)).toEqual(['src/ok.js']);
  });

  it('leaves out files with mixed line endings, broken text, or a line that is not there', () => {
    const prepared = buildFixInput(ISSUE, EVENT, [
      candidate({ path: 'src/mixed.js', text: 'a\r\nb\nc\r\n', line: 1 }),
      candidate({ path: 'src/broken.js', text: 'caf�\nb', line: 1 }),
      candidate({ path: 'src/short.js', text: lines(3), line: 9 }),
      candidate({ path: 'src/ok.js' }),
    ])!;

    expect(prepared.request.files.map((f) => f.file)).toEqual(['src/ok.js']);
  });

  it('is null when no file is left', () => {
    expect(buildFixInput(ISSUE, EVENT, [])).toBeNull();
    expect(
      buildFixInput(ISSUE, EVENT, [candidate({ path: 'package.json' })]),
    ).toBeNull();
  });

  it('matches a Windows file through its "\\n" text', () => {
    const text = lines(10).replace(/\n/g, '\r\n');
    const prepared = buildFixInput(ISSUE, EVENT, [
      candidate({ text, line: 5 }),
    ])!;

    expect(prepared.request.files[0].code).not.toContain('\r');
    expect(prepared.files.get('src/users.js')!.text).not.toContain('\r');
  });

  it('keeps all windows together under the total budget, and at most three files', () => {
    const big = Array.from({ length: 200 }, () => 'x'.repeat(60)).join('\n');
    const prepared = buildFixInput(
      ISSUE,
      EVENT,
      ['a', 'b', 'c', 'd', 'e'].map((n) =>
        candidate({ path: `src/${n}.js`, text: big, line: 100 }),
      ),
    )!;

    const total = prepared.request.files.reduce((n, f) => n + f.code.length, 0);
    expect(total).toBeLessThanOrEqual(10_000);
    expect(prepared.request.files.length).toBeLessThanOrEqual(3);
    for (const file of prepared.request.files) {
      expect(file.code.length).toBeLessThanOrEqual(4_000);
    }
  });

  it('cuts the error text to what the prompt keeps', () => {
    const event = {
      ...EVENT,
      message: 'm'.repeat(4_000),
      stack: 's'.repeat(20_000),
    } as Event;
    const { request } = buildFixInput(ISSUE, event, [candidate()])!;

    expect(request.message).toHaveLength(1_000);
    expect(request.stack).toHaveLength(3_000);
  });
});

describe('hashFixInput', () => {
  const request = () => buildFixInput(ISSUE, EVENT, [candidate()])!.request;

  it('is the same for the same input and differs when anything the model sees differs', () => {
    expect(hashFixInput(request(), 'acme/shop')).toBe(
      hashFixInput(request(), 'acme/shop'),
    );

    const base = hashFixInput(request(), 'acme/shop');
    const changed = [
      hashFixInput({ ...request(), message: 'other' }, 'acme/shop'),
      hashFixInput({ ...request(), release: '2.0.0' }, 'acme/shop'),
      hashFixInput(
        {
          ...request(),
          files: [{ ...request().files[0], code: 'different code' }],
        },
        'acme/shop',
      ),
      hashFixInput(request(), 'acme/other'),
    ];
    for (const hash of changed) expect(hash).not.toBe(base);
  });

  it('does not care about the case of the repository name', () => {
    expect(hashFixInput(request(), 'Acme/Shop')).toBe(
      hashFixInput(request(), 'acme/shop'),
    );
  });

  it('has a version, to bump together with the prompt of apps/ai', () => {
    expect(FIX_CACHE_VERSION).toBe(1);
  });
});
