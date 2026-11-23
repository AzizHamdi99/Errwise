import type { FixEdit } from '@errwise/shared';
import {
  applyEdits,
  checkFixEdits,
  denormalizeText,
  isEditablePath,
  normalizeText,
  MAX_FIX_DIFF_LINES,
} from './fix-patch';
import type { FileUnderFix, FixRejection } from './fix-patch';

const FILE = 'src/users/users.service.js';
const TEXT = [
  'async function getUser(id) {', // 1
  '  const user = await db.find(id);', // 2
  '  const name = user.profile.name;', // 3
  '  return name;', // 4
  '}', // 5
  '', // 6
  'async function other() {', // 7
  '  const user = await db.find(1);', // 8
  '  return user;', // 9
  '}', // 10
  '',
].join('\n');

function under(
  text = TEXT,
  window = { startLine: 1, endLine: 5 },
): Map<string, FileUnderFix> {
  return new Map([[FILE, { text, window }]]);
}

function edit(search: string, replace: string, file = FILE): FixEdit {
  return { file, search, replace };
}

function reasonOf(
  edits: FixEdit[],
  files = under(),
): FixRejection | 'accepted' {
  const check = checkFixEdits(edits, files);
  return check.ok ? 'accepted' : check.reason;
}

describe('isEditablePath', () => {
  it.each([
    'src/a.ts',
    'src/users/users.service.js',
    'lib/x.mjs',
    'app/page.tsx',
    'a.cts',
  ])('accepts %s', (path) => {
    expect(isEditablePath(path)).toBe(true);
  });

  it.each([
    '.github/workflows/ci.yml',
    '.github/scripts/x.js',
    '.eslintrc.js',
    'src/.hidden/a.ts',
    'node_modules/x/index.js',
    'package.json',
    'yarn.lock',
    'Dockerfile',
    'README.md',
    'src/types.d.ts',
    'webpack.config.js',
    'jest.setup.ts',
    'src/a.test.ts',
    'src/a.spec.js',
    'src/__tests__/a.ts',
    'test/helpers.js',
    'e2e/login.ts',
    '../outside.ts',
    'src/../a.ts',
    '/etc/passwd.js',
    'src\\a.ts',
    'src//a.ts',
    'noextension',
    '',
  ])('refuses %s', (path) => {
    expect(isEditablePath(path)).toBe(false);
  });

  it('refuses a path that is too long', () => {
    expect(isEditablePath(`${'a/'.repeat(300)}x.ts`)).toBe(false);
  });
});

describe('normalizeText and denormalizeText', () => {
  it('leaves plain text alone', () => {
    expect(normalizeText('a\nb\n')).toEqual({
      ok: true,
      value: { text: 'a\nb\n', bom: false, eol: 'lf' },
    });
  });

  it('turns Windows line endings into "\\n" and restores them', () => {
    const result = normalizeText('a\r\nb\r\n');
    expect(result).toEqual({
      ok: true,
      value: { text: 'a\nb\n', bom: false, eol: 'crlf' },
    });
    if (result.ok) {
      expect(denormalizeText(result.value, 'a\nX\n')).toBe('a\r\nX\r\n');
    }
  });

  it('keeps a byte order mark out of the text and puts it back', () => {
    const result = normalizeText('﻿a\nb');
    expect(result).toEqual({
      ok: true,
      value: { text: 'a\nb', bom: true, eol: 'lf' },
    });
    if (result.ok) {
      expect(denormalizeText(result.value, 'a\nc')).toBe('﻿a\nc');
    }
  });

  it('refuses mixed line endings, a lone carriage return and broken UTF-8', () => {
    expect(normalizeText('a\r\nb\nc')).toEqual({
      ok: false,
      reason: 'mixed_line_endings',
    });
    expect(normalizeText('a\rb')).toEqual({
      ok: false,
      reason: 'invalid_text',
    });
    expect(normalizeText('caf�')).toEqual({
      ok: false,
      reason: 'invalid_text',
    });
  });

  it('an empty file is fine', () => {
    expect(normalizeText('')).toEqual({
      ok: true,
      value: { text: '', bom: false, eol: 'lf' },
    });
  });
});

describe('applyEdits', () => {
  it('replaces each search exactly where it is, whatever the order given', () => {
    const result = applyEdits(TEXT, [
      edit('  return name;', '  return name ?? "";'),
      edit('user.profile.name', 'user?.profile.name'),
    ]);

    expect(result).toEqual({
      ok: true,
      text: TEXT.replace('user.profile.name', 'user?.profile.name').replace(
        '  return name;',
        '  return name ?? "";',
      ),
    });
  });

  it('does not let a longer replacement shift a later edit', () => {
    const result = applyEdits('aXbYc', [edit('X', 'XXXXXXXX'), edit('Y', '-')]);
    expect(result).toEqual({ ok: true, text: 'aXXXXXXXXb-c' });
  });

  it('refuses a search that is gone, a search that is no longer unique, and overlaps', () => {
    expect(applyEdits(TEXT, [edit('nothing like this', 'x')])).toEqual({
      ok: false,
      reason: 'search_not_found',
    });
    expect(applyEdits(TEXT, [edit('await db.find(', 'x')])).toEqual({
      ok: false,
      reason: 'search_not_unique',
    });
    expect(
      applyEdits('abcdef', [edit('abcd', 'x'), edit('cdef', 'y')]),
    ).toEqual({ ok: false, reason: 'overlapping_edits' });
  });

  it('accepts two edits that touch without overlapping', () => {
    expect(applyEdits('abcd', [edit('ab', '1'), edit('cd', '2')])).toEqual({
      ok: true,
      text: '12',
    });
  });

  it('matches on "\\n" even if the model wrote "\\r\\n"', () => {
    expect(applyEdits('a\nb\n', [edit('a\r\nb', 'x')])).toEqual({
      ok: true,
      text: 'x\n',
    });
  });
});

describe('checkFixEdits', () => {
  it('accepts a good edit and stores the line it starts at', () => {
    const check = checkFixEdits(
      [edit('user.profile.name', 'user?.profile.name')],
      under(),
    );

    expect(check).toEqual({
      ok: true,
      edits: [
        {
          file: FILE,
          search: 'user.profile.name',
          replace: 'user?.profile.name',
          line: 3,
          prefix: '  const name = ',
          suffix: ';',
        },
      ],
      warnings: [],
      diffLines: 2,
    });
  });

  describe('the rest of the line around an edit', () => {
    const contextOf = (
      text: string,
      search: string,
      window = { startLine: 1, endLine: 20 },
    ) => {
      const check = checkFixEdits(
        [edit(search, `${search}!`)],
        under(text, window),
      );
      if (!check.ok) throw new Error(check.reason);
      return { prefix: check.edits[0].prefix, suffix: check.edits[0].suffix };
    };

    it('is what comes before and after the match on its line', () => {
      expect(contextOf('a();\n  x = foo(bar);\nb();\n', 'foo(bar)')).toEqual({
        prefix: '  x = ',
        suffix: ';',
      });
    });

    it('is empty when the match is whole lines', () => {
      expect(contextOf('a();\nfoo();\nb();\n', 'foo();')).toEqual({
        prefix: '',
        suffix: '',
      });
    });

    it('works at the very start and the very end of a file', () => {
      expect(contextOf('foo(); // end', 'foo()')).toEqual({
        prefix: '',
        suffix: '; // end',
      });
      expect(contextOf('a();\nx = foo', 'foo')).toEqual({
        prefix: 'x = ',
        suffix: '',
      });
    });

    it('is the first line before and the last line after a match over several lines', () => {
      expect(
        contextOf(
          'a();\n  x = f(\n    1,\n  ) + 2;\nb();\n',
          'f(\n    1,\n  )',
        ),
      ).toEqual({ prefix: '  x = ', suffix: ' + 2;' });
    });

    it('is scrubbed: a secret that shares the line was never shown to the model', () => {
      const key = 'sk-abcdefghijklmnopqrstuvwxyz0123';
      const result = contextOf(`const k = "${key}", v = foo;\n`, 'foo');

      expect(result.prefix).not.toContain(key);
      expect(result.prefix).toContain('[key]');
    });

    it('is cut on the side away from the change when the line is long', () => {
      const long = 'x'.repeat(1_000);
      const result = contextOf(`${long}foo${long}\n`, 'foo');

      expect(result.prefix).toHaveLength(300);
      expect(result.prefix.startsWith('…')).toBe(true);
      expect(result.prefix.endsWith('x')).toBe(true);
      expect(result.suffix).toHaveLength(300);
      expect(result.suffix.endsWith('…')).toBe(true);
    });
  });

  it('reports the line of a search that spans several lines', () => {
    const check = checkFixEdits(
      [edit('  const user = await db.find(id);\n  const name', 'x')],
      under(),
    );
    expect(check.ok && check.edits[0].line).toBe(2);
  });

  it('matches a Windows file through its normalized text', () => {
    const normalized = normalizeText(TEXT.replace(/\n/g, '\r\n'));
    if (!normalized.ok) throw new Error('should normalize');
    const files = under(normalized.value.text);

    expect(reasonOf([edit('  return name;', '  return 1;')], files)).toBe(
      'accepted',
    );
  });

  describe('refuses the whole patch when', () => {
    it('a file was not sent to the model', () => {
      expect(reasonOf([edit('x', 'y', 'src/other.js')])).toBe('file_not_sent');
    });

    it('a file is not a code file the feature may edit', () => {
      const files = new Map([
        [
          '.github/workflows/ci.js',
          { text: 'run: x', window: { startLine: 1, endLine: 1 } },
        ],
        [
          'src/a.test.js',
          { text: 'run: x', window: { startLine: 1, endLine: 1 } },
        ],
      ]);
      expect(
        reasonOf([edit('run', 'x', '.github/workflows/ci.js')], files),
      ).toBe('file_not_editable');
      expect(reasonOf([edit('run', 'x', 'src/a.test.js')], files)).toBe(
        'file_not_editable',
      );
    });

    it('the search is not in the file', () => {
      expect(reasonOf([edit('does not exist', 'x')])).toBe('search_not_found');
    });

    it('the search is the scrubbed text the model saw, not the real text', () => {
      const real = under('const mail = "bob@x.com";\n', {
        startLine: 1,
        endLine: 1,
      });
      expect(reasonOf([edit('const mail = "[email]";', 'x')], real)).toBe(
        'search_not_found',
      );
    });

    it('the search is found twice, even if the two overlap', () => {
      expect(reasonOf([edit('await db.find(', 'x')])).toBe('search_not_unique');
      const aaa = under('aaa', { startLine: 1, endLine: 1 });
      expect(reasonOf([edit('aa', 'b')], aaa)).toBe('search_not_unique');
    });

    it('the search is unique in the file but outside the lines the model saw', () => {
      expect(reasonOf([edit('  return user;', 'x')])).toBe('outside_window');
    });

    it('a search starts inside the window and ends outside it', () => {
      expect(reasonOf([edit('}\n\nasync function other()', 'x')])).toBe(
        'outside_window',
      );
    });

    it('two edits overlap', () => {
      expect(
        reasonOf([
          edit('const name = user.profile', 'x'),
          edit('profile.name;', 'y'),
        ]),
      ).toBe('overlapping_edits');
    });

    it('an edit changes nothing', () => {
      expect(reasonOf([edit('  return name;', '  return name;')])).toBe(
        'no_change',
      );
      // Line endings alone are not a change either.
      expect(reasonOf([edit('  return name;', '  return name;')])).toBe(
        'no_change',
      );
    });

    it('a placeholder of the scrubber is written into the code', () => {
      for (const placeholder of ['[key]', '[email]', '[token]', '[jwt]']) {
        expect(
          reasonOf([edit('  return name;', `  return "${placeholder}";`)]),
        ).toBe('placeholder');
      }
    });

    it('there are too many edits or too many files', () => {
      const many = Array.from({ length: 6 }, (_, i) =>
        edit(`line ${i}`, `line ${i}b`),
      );
      expect(reasonOf(many)).toBe('too_many_edits');

      const names = ['a', 'b', 'c', 'd'].map((n) => `src/${n}.js`);
      const files = new Map(
        names.map((n): [string, FileUnderFix] => [
          n,
          { text: 'x', window: { startLine: 1, endLine: 1 } },
        ]),
      );
      expect(
        reasonOf(
          names.map((n) => edit('x', 'y', n)),
          files,
        ),
      ).toBe('too_many_files');
    });

    it('the patch is bigger than a small fix', () => {
      const big = 'x\n'.repeat(MAX_FIX_DIFF_LINES);
      const files = under('start\nline one\nline two\nend\n', {
        startLine: 1,
        endLine: 4,
      });
      expect(reasonOf([edit('line one\nline two', big)], files)).toBe(
        'too_large',
      );
    });

    it('a bad edit comes after good ones', () => {
      expect(
        reasonOf([
          edit('user.profile.name', 'user?.profile.name'),
          edit('does not exist', 'x'),
        ]),
      ).toBe('search_not_found');
    });
  });

  it('allows a placeholder when the file itself already has it', () => {
    // obj[key] is ordinary JavaScript: the scrubber has no say about it.
    const files = under('const v = obj[key];\nreturn v;\n', {
      startLine: 1,
      endLine: 2,
    });
    expect(reasonOf([edit('return v;', 'return obj[key] ?? v;')], files)).toBe(
      'accepted',
    );
  });

  it('is not fooled by an edit that is only a different line ending', () => {
    expect(reasonOf([edit('  return name;\n}', '  return name;\r\n}')])).toBe(
      'no_change',
    );
  });

  describe('warnings', () => {
    const warningsFor = (replace: string, search = '  return name;') => {
      const check = checkFixEdits([edit(search, replace)], under());
      if (!check.ok) throw new Error(check.reason);
      return check.warnings;
    };

    it('flags what the change adds', () => {
      expect(warningsFor('  return process.env.NAME;')).toEqual([
        'reads_environment',
      ]);
      expect(warningsFor("  require('child_process').exec('ls');")).toEqual(
        expect.arrayContaining(['runs_shell_command', 'adds_import']),
      );
      expect(warningsFor("  await fetch('https://x.example');")).toEqual([
        'makes_network_call',
      ]);
      expect(warningsFor("  return eval('1');")).toEqual(['evaluates_code']);
      expect(warningsFor("import x from 'y';\n  return name;")).toEqual([
        'adds_import',
      ]);
    });

    it('is quiet about what was already there', () => {
      const files = under('const a = process.env.A;\nreturn a;\n', {
        startLine: 1,
        endLine: 2,
      });
      const check = checkFixEdits(
        [edit('process.env.A', 'process.env.A ?? "x"')],
        files,
      );
      expect(check.ok && check.warnings).toEqual([]);
    });
  });
});
