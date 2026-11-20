import { parseStack, shortPath } from '@errwise/shared';

// The parser lives in @errwise/shared (the dashboard and the API both use it) and the
// package has no test runner, so its behavior is pinned here, where the API consumes it.
describe('parseStack', () => {
  it('splits the header from the frames and keeps frame order', () => {
    const { header, frames } = parseStack(
      [
        'TypeError: x is undefined',
        '    at getUser (/app/src/users.js:10:5)',
        '    at handler (/app/src/routes.js:22:3)',
      ].join('\n'),
    );

    expect(header).toBe('TypeError: x is undefined');
    expect(frames).toEqual([
      {
        fn: 'getUser',
        file: '/app/src/users.js',
        line: 10,
        column: 5,
        inApp: true,
      },
      {
        fn: 'handler',
        file: '/app/src/routes.js',
        line: 22,
        column: 3,
        inApp: true,
      },
    ]);
  });

  it('reads anonymous frames, async frames and constructors', () => {
    const { frames } = parseStack(
      [
        'Error: boom',
        '    at /app/src/a.js:1:2',
        '    at async load (/app/src/b.js:3:4)',
        '    at new Service (/app/src/c.js:5:6)',
      ].join('\n'),
    );

    expect(frames.map((f) => [f.fn, f.file, f.line, f.column])).toEqual([
      [null, '/app/src/a.js', 1, 2],
      ['async load', '/app/src/b.js', 3, 4],
      ['new Service', '/app/src/c.js', 5, 6],
    ]);
  });

  it('normalizes file:// URLs and Windows separators', () => {
    const { frames } = parseStack(
      [
        'Error: boom',
        '    at run (file:///app/src/esm.mjs:7:8)',
        String.raw`    at win (C:\proj\src\win.js:9:1)`,
      ].join('\n'),
    );

    expect(frames[0]?.file).toBe('/app/src/esm.mjs');
    expect(frames[1]?.file).toBe('C:/proj/src/win.js');
  });

  it('marks node_modules and node: internals as library code', () => {
    const { frames } = parseStack(
      [
        'Error: boom',
        '    at app (/app/src/a.js:1:1)',
        '    at Layer.handle (/app/node_modules/express/lib/layer.js:95:5)',
        '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)',
      ].join('\n'),
    );

    expect(frames.map((f) => f.inApp)).toEqual([true, false, false]);
  });

  it('keeps unparseable "at" lines as library frames so indexes stay stable', () => {
    const { frames } = parseStack(
      'Error: boom\n    at <anonymous>\n    at real (/app/a.js:1:1)',
    );

    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({
      file: '<anonymous>',
      line: null,
      inApp: false,
    });
    expect(frames[1]?.fn).toBe('real');
  });

  it('keeps a multi-line message in the header', () => {
    const { header, frames } = parseStack(
      'Error: first line\nsecond line\n    at f (/a.js:1:1)',
    );

    expect(header).toBe('Error: first line\nsecond line');
    expect(frames).toHaveLength(1);
  });

  it('returns no frames for text that is not a stack', () => {
    expect(parseStack('just a message').frames).toEqual([]);
    expect(parseStack('').frames).toEqual([]);
  });
});

describe('shortPath', () => {
  it('keeps the last three segments of an application path', () => {
    expect(shortPath('/var/task/apps/api/src/users/users.service.js')).toBe(
      'src/users/users.service.js',
    );
  });

  it('keeps everything from node_modules on', () => {
    expect(shortPath('/app/node_modules/express/lib/router/layer.js')).toBe(
      'node_modules/express/lib/router/layer.js',
    );
  });
});
