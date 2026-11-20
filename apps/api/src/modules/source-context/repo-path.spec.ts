import {
  buildRepoIndex,
  framePathSegments,
  resolveRepoPath,
} from './repo-path';

// A backslash written without a backslash in the source: Windows paths in the tests.
const BS = String.fromCharCode(92);
const win = (path: string) => path.split('/').join(BS);

const REPO = [
  'package.json',
  'src/main.js',
  'src/users/users.service.js',
  'src/users/index.js',
  'src/orders/index.js',
  'src/orders/orders.service.js',
  'lib/helper.js',
  'apps/api/src/server.ts',
  'apps/web/src/server.ts',
  'apps/api/src/users/users.service.ts',
  'dist/committed-bundle.js',
  'node_modules/leftpad/index.js',
];
const index = buildRepoIndex(REPO);
const resolve = (frame: string) => resolveRepoPath(frame, index);
const path = (frame: string) => {
  const result = resolve(frame);
  return result.ok ? result.path : result.reason;
};

describe('framePathSegments', () => {
  it('handles every flavor of frame path', () => {
    const expected = ['app', 'src', 'a.js'];
    expect(framePathSegments('/app/src/a.js')).toEqual(expected);
    expect(framePathSegments('file:///app/src/a.js')).toEqual(expected);
    expect(framePathSegments(win('C:/app/src/a.js'))).toEqual(expected);
    expect(framePathSegments('/app/src/a.js?v=123#x')).toEqual(expected);
    expect(framePathSegments('/app/./src//a.js')).toEqual(expected);
    expect(framePathSegments('/app/%73rc/a.js')).toEqual(expected);
    expect(framePathSegments('webpack://app/./src/a.js')).toEqual([
      'app',
      'src',
      'a.js',
    ]);
  });

  it('never follows ".." and survives broken encoding', () => {
    expect(framePathSegments('/app/../../etc/passwd')).toEqual([
      'app',
      'etc',
      'passwd',
    ]);
    expect(framePathSegments('/app/%E0%A4%A/a.js')).toEqual([
      'app',
      '%E0%A4%A',
      'a.js',
    ]);
  });
});

describe('resolveRepoPath', () => {
  it('maps the paths of the usual deployments to the repository file', () => {
    expect(path('/app/src/users/users.service.js')).toBe(
      'src/users/users.service.js',
    ); // Docker
    expect(path('/var/task/src/users/users.service.js')).toBe(
      'src/users/users.service.js',
    ); // Vercel, Lambda
    expect(path(win('C:/dev/project/src/users/users.service.js'))).toBe(
      'src/users/users.service.js',
    ); // Windows
    expect(path('file:///app/src/main.js')).toBe('src/main.js');
    expect(path('webpack://svc/./src/users/users.service.js')).toBe(
      'src/users/users.service.js',
    );
  });

  it('prefers the file that shares the most folders', () => {
    expect(path('/app/apps/api/src/server.ts')).toBe('apps/api/src/server.ts');
    expect(path('/app/apps/web/src/server.ts')).toBe('apps/web/src/server.ts');
    expect(path('/app/apps/api/src/users/users.service.ts')).toBe(
      'apps/api/src/users/users.service.ts',
    );
  });

  it('tells the folder apart when the file name is the same', () => {
    expect(path('/app/src/users/index.js')).toBe('src/users/index.js');
    expect(path('/app/src/orders/index.js')).toBe('src/orders/index.js');
  });

  it('refuses to guess between files that match equally well', () => {
    expect(path('/app/src/server.ts')).toBe('ambiguous'); // api and web both end in src/server.ts
    expect(path('/app/other/server.ts')).toBe('not_found');
  });

  it('refuses a match on the file name alone', () => {
    expect(path('/app/vendor/fork/main.js')).toBe('not_found'); // src/main.js exists
    expect(path('/var/task/helper.js')).toBe('not_found'); // lib/helper.js exists
  });

  it('accepts a bare file name only when it is unique', () => {
    expect(path('main.js')).toBe('src/main.js');
    expect(path('index.js')).toBe('ambiguous');
  });

  it('does not show source for compiled output', () => {
    expect(path('/app/dist/users/users.service.js')).toBe('compiled');
    expect(path('/app/build/main.js')).toBe('compiled');
    expect(path('/app/.next/server/pages/api.js')).toBe('compiled');
    expect(path('/app/apps/api/dist/src/server.js')).toBe('compiled');
  });

  it('shows committed build output when the repository really has it', () => {
    expect(path('/app/dist/committed-bundle.js')).toBe(
      'dist/committed-bundle.js',
    );
  });

  it('leaves library and internal code alone', () => {
    for (const frame of [
      '/app/node_modules/leftpad/index.js',
      'node:internal/process/task_queues',
      'internal/modules/cjs/loader.js',
      '<anonymous>',
      'eval at run (<anonymous>)',
      '',
      '/',
    ]) {
      expect(path(frame)).toBe('library');
    }
  });

  it('never resolves anything inside node_modules, even if the repo has it', () => {
    expect(path('/app/node_modules/leftpad/index.js')).toBe('library');
    expect(index.byName.get('index.js')?.map((f) => f.path)).not.toContain(
      'node_modules/leftpad/index.js',
    );
  });

  it('answers not_found for unknown files and path tricks', () => {
    expect(path('/app/src/nope.js')).toBe('not_found');
    expect(path('/app/../../etc/passwd')).toBe('not_found');
    expect(path('/app/src/users/')).toBe('not_found');
  });

  it('copes with absurdly long input', () => {
    const long = `/app/${'a/'.repeat(100_000)}users.service.js`;
    expect(resolve(long).ok).toBe(false);
  });
});

describe('resolveRepoPath invariants', () => {
  it('only ever answers with a file of the repository, whatever the input', () => {
    const known = new Set(REPO);
    const alphabet = [
      'src',
      'users',
      'index.js',
      'main.js',
      '..',
      '.',
      'a',
      'dist',
      'C:',
      '%2e',
      '?x',
      '',
      BS,
      '/',
    ];
    let seed = 42;
    const next = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed;
    };

    for (let i = 0; i < 3_000; i += 1) {
      const parts = Array.from(
        { length: 1 + (next() % 8) },
        () => alphabet[next() % alphabet.length],
      );
      const frame = parts.join(next() % 2 === 0 ? '/' : BS);
      const result = resolve(frame);
      if (result.ok) expect(known.has(result.path)).toBe(true);
    }
  });
});
