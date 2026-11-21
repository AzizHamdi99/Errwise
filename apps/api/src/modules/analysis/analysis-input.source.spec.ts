import type { Event } from '@prisma/client';
import type { SourceContextResult, SourceFrame } from '@errwise/shared';
import {
  ANALYSIS_CACHE_VERSION,
  buildAnalysisInput,
  buildSourceSnippets,
  hashAnalysisInput,
} from './analysis-input';

const NEWLINE = String.fromCharCode(10);

function found(
  overrides: Partial<Extract<SourceFrame, { status: 'found' }>>,
): SourceFrame {
  return {
    frameIndex: 0,
    status: 'found',
    repoPath: 'src/a.js',
    line: 3,
    startLine: 1,
    lines: ['one', 'two', 'three'],
    url: 'https://github.com/acme/shop/blob/abc/src/a.js#L3',
    ...overrides,
  };
}

const ok = (...frames: SourceFrame[]): SourceContextResult => ({
  status: 'ok',
  commitSha: 'a'.repeat(40),
  frames,
});

describe('buildSourceSnippets', () => {
  it('is empty unless the answer is ok', () => {
    expect(buildSourceSnippets(null)).toEqual([]);
    for (const status of [
      'disabled',
      'no_permission',
      'unavailable',
    ] as const) {
      expect(
        buildSourceSnippets({ status, commitSha: null, frames: [] }),
      ).toEqual([]);
    }
  });

  it('keeps only frames that have code', () => {
    const snippets = buildSourceSnippets(
      ok(
        { frameIndex: 0, status: 'unresolved', reason: 'compiled' },
        found({ frameIndex: 1 }),
      ),
    );
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.file).toBe('src/a.js');
  });

  it('numbers the lines, aligned, and marks the failing one', () => {
    const [snippet] = buildSourceSnippets(
      ok(found({ startLine: 8, line: 10, lines: ['a', 'b', 'c', 'd', 'e'] })),
    );

    expect(snippet?.code.split(NEWLINE)).toEqual([
      '   8 | a', // numbers are right-aligned to the width of the last one
      '   9 | b',
      '> 10 | c',
      '  11 | d',
      '  12 | e',
    ]);
  });

  it('cuts very long lines and keeps the whole snippet under the limit', () => {
    const [snippet] = buildSourceSnippets(
      ok(
        found({
          lines: Array.from({ length: 11 }, () => 'x'.repeat(5_000)),
          startLine: 1,
          line: 6,
        }),
      ),
    );
    expect(snippet?.code.length).toBeLessThanOrEqual(2_000);
    expect(snippet?.code.split(NEWLINE).every((l) => l.length <= 160)).toBe(
      true,
    );
  });

  it('scrubs the file name and the code', () => {
    const [snippet] = buildSourceSnippets(
      ok(
        found({
          lines: ["const key = 'ew_live_" + 'a'.repeat(32) + "';"],
          line: 1,
          startLine: 1,
        }),
      ),
    );
    expect(snippet?.code).not.toContain('ew_live_' + 'a'.repeat(32));
    expect(snippet?.code).toContain('[key]');
  });
});

describe('the analysis input with code', () => {
  const event = {
    type: 'TypeError',
    message: 'boom',
    stack: 'Error: boom',
    environment: 'production',
    release: null,
    context: null,
  } as unknown as Event;
  const issue = { type: 'TypeError' };

  it('has no sourceContext key when there is no code', () => {
    expect(buildAnalysisInput(issue, event).sourceContext).toBeUndefined();
    expect(buildAnalysisInput(issue, event, []).sourceContext).toBeUndefined();
  });

  it('includes the code, and the hash depends on it', () => {
    const one = buildSourceSnippets(ok(found({})));
    const other = buildSourceSnippets(ok(found({ lines: ['x', 'y', 'z'] })));

    const plain = hashAnalysisInput(buildAnalysisInput(issue, event));
    const withOne = hashAnalysisInput(buildAnalysisInput(issue, event, one));
    const withOther = hashAnalysisInput(
      buildAnalysisInput(issue, event, other),
    );

    expect(new Set([plain, withOne, withOther]).size).toBe(3);
    expect(withOne).toBe(
      hashAnalysisInput(buildAnalysisInput(issue, event, one)),
    );
  });

  it('uses a cache version that matches the prompt of the AI service', () => {
    // Bump both together: PROMPT_VERSION in apps/ai/app/analysis/prompts.py is "v4".
    expect(ANALYSIS_CACHE_VERSION).toBe(4);
  });
});
