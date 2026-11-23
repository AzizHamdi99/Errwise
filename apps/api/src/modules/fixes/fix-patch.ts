import {
  FIX_FILE_EXTENSIONS,
  MAX_FIX_EDITS,
  MAX_FIX_FILES,
} from '@errwise/shared';
import { MAX_FIX_LINE_CONTEXT } from '@errwise/shared';
import type { FixEdit, FixWarning, StoredFixEdit } from '@errwise/shared';
import { scrubText } from '../../common/utils/scrub';

/**
 * Checks and applies the edits a model proposed (ADR-009). Pure logic, no I/O.
 *
 * The model saw a scrubbed window of the file and answers with search/replace pairs. Nothing it
 * says is trusted: every edit is matched against the real text of the file, must hit exactly
 * once and inside the window it was shown, and the patch is refused as a whole when any edit is
 * not acceptable. The same functions re-apply the stored edits to the default branch when the
 * pull request is opened, so a stale or tampered patch fails there too.
 */

/** Added or removed lines of a whole patch: a fix is a few lines, not a rewrite. */
export const MAX_FIX_DIFF_LINES = 60;

export type FixRejection =
  | 'too_many_files'
  | 'too_many_edits'
  | 'file_not_sent'
  | 'file_not_editable'
  | 'invalid_text'
  | 'mixed_line_endings'
  | 'search_not_found'
  | 'search_not_unique'
  | 'outside_window'
  | 'overlapping_edits'
  | 'no_change'
  | 'placeholder'
  | 'too_large';

/** What `scrubText` writes in place of a secret. The model must never write one back. */
const SCRUB_PLACEHOLDERS = [
  '[email]',
  '[key]',
  '[jwt]',
  '[token]',
  '[card]',
  '[credentials]',
  '[redacted]',
  '[truncated]',
] as const;

/**
 * True when `replace` writes a placeholder of the scrubber that the file does not already
 * have. The model saw "[key]" where the file has a secret: writing it back would put the
 * placeholder in the repository in place of the secret. (`obj[key]` is ordinary JavaScript,
 * so a file that has the text itself is not a problem.)
 */
export function introducesPlaceholder(replace: string, text: string): boolean {
  return SCRUB_PLACEHOLDERS.some(
    (placeholder) =>
      replace.includes(placeholder) && !text.includes(placeholder),
  );
}

// --- paths ------------------------------------------------------------------------------

const EDITABLE_EXTENSIONS: ReadonlySet<string> = new Set(FIX_FILE_EXTENSIONS);
const TEST_DIRECTORIES = new Set([
  '__tests__',
  '__mocks__',
  'test',
  'tests',
  'e2e',
]);
const MAX_PATH_LENGTH = 500;

/**
 * Code only. Never dotfiles or dot-directories (`.github/`, `.eslintrc.js`), configuration,
 * type declarations, tests or dependencies: a fix that needs one of those is not a small fix.
 */
export function isEditablePath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_PATH_LENGTH) return false;
  if (path.includes('\\') || path.startsWith('/')) return false;

  const segments = path.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return false;
  if (segments.some((s) => s.startsWith('.') || s === 'node_modules'))
    return false;
  if (segments.slice(0, -1).some((s) => TEST_DIRECTORIES.has(s))) return false;

  const name = segments[segments.length - 1];
  const extension = name.includes('.') ? name.split('.').pop() : undefined;
  if (!extension || !EDITABLE_EXTENSIONS.has(extension)) return false;
  if (name.endsWith('.d.ts')) return false;
  if (/\.(?:config|setup|test|spec)\.[^.]+$/.test(name)) return false;
  return true;
}

// --- text -------------------------------------------------------------------------------

/** U+FEFF, written as a number so no invisible character sits in the source. */
const BOM = String.fromCharCode(0xfeff);

export interface NormalizedText {
  /** Always "\n" line endings, no byte order mark. The only form edits are matched against. */
  text: string;
  bom: boolean;
  eol: 'lf' | 'crlf';
}

/**
 * Null for text that cannot be edited safely: broken UTF-8 (the reader turns it into U+FFFD),
 * a lone carriage return, or a file that mixes line endings. Rewriting such a file would change
 * lines nobody asked to change.
 */
export function normalizeText(
  raw: string,
): { ok: true; value: NormalizedText } | { ok: false; reason: FixRejection } {
  const bom = raw.startsWith(BOM);
  const body = bom ? raw.slice(1) : raw;
  if (body.includes('�')) return { ok: false, reason: 'invalid_text' };

  const crlf = (body.match(/\r\n/g) ?? []).length;
  const withoutCrlf = body.replace(/\r\n/g, '');
  if (withoutCrlf.includes('\r')) return { ok: false, reason: 'invalid_text' };

  const bareLf = (withoutCrlf.match(/\n/g) ?? []).length;
  if (crlf > 0 && bareLf > 0)
    return { ok: false, reason: 'mixed_line_endings' };

  return {
    ok: true,
    value: {
      text: crlf > 0 ? body.replace(/\r\n/g, '\n') : body,
      bom,
      eol: crlf > 0 ? 'crlf' : 'lf',
    },
  };
}

/** The inverse of `normalizeText`: what is written back to the repository. */
export function denormalizeText(file: NormalizedText, text: string): string {
  const body = file.eol === 'crlf' ? text.replace(/\n/g, '\r\n') : text;
  return file.bom ? BOM + body : body;
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = text.indexOf('\n'); i !== -1 && i < index;) {
    line += 1;
    i = text.indexOf('\n', i + 1);
  }
  return line;
}

/**
 * The rest of the first and last line around a match, for the dashboard to show whole lines.
 * It comes from the real file, so it is scrubbed like everything else that is stored or shown:
 * the model never saw a secret that sits on the same line as its change.
 */
function lineAround(
  text: string,
  start: number,
  end: number,
): { prefix: string; suffix: string } {
  const lineStart = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  const lineEndAt = text.indexOf('\n', end);
  const lineEnd = lineEndAt === -1 ? text.length : lineEndAt;
  const prefix = scrubText(text.slice(lineStart, start));
  const suffix = scrubText(text.slice(end, lineEnd));
  return {
    // Cut from the side away from the change, so what is next to it stays.
    prefix:
      prefix.length > MAX_FIX_LINE_CONTEXT
        ? `…${prefix.slice(-(MAX_FIX_LINE_CONTEXT - 1))}`
        : prefix,
    suffix:
      suffix.length > MAX_FIX_LINE_CONTEXT
        ? `${suffix.slice(0, MAX_FIX_LINE_CONTEXT - 1)}…`
        : suffix,
  };
}

function lineCount(text: string): number {
  return text === '' ? 0 : text.split('\n').length;
}

/** Edits are matched on "\n" text: a model never writes the "\r" of a Windows file. */
function toLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

// --- locating and applying ---------------------------------------------------------------

type Located = { start: number } | { problem: 'not_found' | 'not_unique' };

/** Exactly one occurrence. Overlapping ones count too: "aa" twice in "aaa" is not unique. */
function locate(text: string, search: string): Located {
  const first = text.indexOf(search);
  if (first === -1) return { problem: 'not_found' };
  if (text.indexOf(search, first + 1) !== -1) return { problem: 'not_unique' };
  return { start: first };
}

interface Span {
  start: number;
  end: number;
}

function overlapping(spans: Span[]): boolean {
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  return ordered.some((span, i) => i > 0 && span.start < ordered[i - 1].end);
}

/**
 * The edits applied to the text of one file, in memory only. Used on the default branch when
 * a pull request is opened, where there is no window any more: the text must still contain
 * every `search` exactly once.
 */
export function applyEdits(
  text: string,
  edits: readonly Pick<FixEdit, 'search' | 'replace'>[],
):
  | { ok: true; text: string }
  | {
      ok: false;
      reason: 'search_not_found' | 'search_not_unique' | 'overlapping_edits';
    } {
  const planned: (Span & { replace: string })[] = [];
  for (const edit of edits) {
    const search = toLf(edit.search);
    const found = locate(text, search);
    if ('problem' in found) {
      return {
        ok: false,
        reason:
          found.problem === 'not_found'
            ? 'search_not_found'
            : 'search_not_unique',
      };
    }
    planned.push({
      start: found.start,
      end: found.start + search.length,
      replace: toLf(edit.replace),
    });
  }
  if (overlapping(planned)) return { ok: false, reason: 'overlapping_edits' };

  // From the end, so an edit never shifts the position of one that comes before it.
  let result = text;
  for (const { start, end, replace } of [...planned].sort(
    (a, b) => b.start - a.start,
  )) {
    result = result.slice(0, start) + replace + result.slice(end);
  }
  return { ok: true, text: result };
}

// --- checking a model's answer --------------------------------------------------------------

/** A file as it was read at the deployed commit, and the part of it the model was shown. */
export interface FileUnderFix {
  /** "\n" text, see `normalizeText`. */
  text: string;
  /** The lines shown to the model, 1-based and inclusive. */
  window: { startLine: number; endLine: number };
}

export type FixCheck =
  | {
      ok: true;
      edits: StoredFixEdit[];
      warnings: FixWarning[];
      diffLines: number;
    }
  | { ok: false; reason: FixRejection };

const WARNING_PATTERNS: Record<FixWarning, RegExp> = {
  reads_environment: /\bprocess\.env\b/g,
  runs_shell_command:
    /\bchild_process\b|\b(?:exec|execSync|execFile|spawn|spawnSync)\s*\(/g,
  makes_network_call:
    /\bfetch\s*\(|\baxios\b|\bXMLHttpRequest\b|\bWebSocket\b|\bhttps?\.(?:request|get)\s*\(|\bnet\.connect\b/g,
  adds_import: /^[ \t]*import\s|\brequire\s*\(|\bimport\s*\(/gm,
  evaluates_code: /\beval\s*\(|\bnew\s+Function\s*\(|\bvm\.run\w*\s*\(/g,
};

function occurrences(pattern: RegExp, text: string): number {
  return (text.match(pattern) ?? []).length;
}

/** Only what the edit adds counts: a line that already used `process.env` is not news. */
function warningsAdded(edits: readonly FixEdit[]): FixWarning[] {
  const found = new Set<FixWarning>();
  for (const [warning, pattern] of Object.entries(WARNING_PATTERNS) as [
    FixWarning,
    RegExp,
  ][]) {
    for (const edit of edits) {
      if (
        occurrences(pattern, edit.replace) > occurrences(pattern, edit.search)
      ) {
        found.add(warning);
      }
    }
  }
  return [...found];
}

function reject(reason: FixRejection): FixCheck {
  return { ok: false, reason };
}

/**
 * Accepts the patch only when every rule holds, and then returns it in the form that is stored
 * (with the line each edit starts at). A reason is a short code: never text from the model or
 * from the code.
 */
export function checkFixEdits(
  edits: readonly FixEdit[],
  files: ReadonlyMap<string, FileUnderFix>,
): FixCheck {
  if (edits.length > MAX_FIX_EDITS) return reject('too_many_edits');
  if (new Set(edits.map((e) => e.file)).size > MAX_FIX_FILES) {
    return reject('too_many_files');
  }

  const clean: FixEdit[] = [];
  const spans = new Map<string, Span[]>();
  const stored: StoredFixEdit[] = [];
  let diffLines = 0;

  for (const edit of edits) {
    const file = files.get(edit.file);
    if (!file) return reject('file_not_sent');
    if (!isEditablePath(edit.file)) return reject('file_not_editable');

    const search = toLf(edit.search);
    const replace = toLf(edit.replace);
    if (search.includes('\r') || replace.includes('\r')) {
      return reject('invalid_text');
    }
    if (search === replace) return reject('no_change');

    const found = locate(file.text, search);
    if ('problem' in found) {
      return reject(
        found.problem === 'not_found'
          ? 'search_not_found'
          : 'search_not_unique',
      );
    }

    // Inside the lines the model was shown, not merely somewhere in the file.
    const first = lineOf(file.text, found.start);
    const last = lineOf(file.text, found.start + search.length - 1);
    if (first < file.window.startLine || last > file.window.endLine) {
      return reject('outside_window');
    }

    // The model saw "[key]" where the file has a secret. Writing it back would put the
    // placeholder in the repository in place of the secret.
    if (introducesPlaceholder(replace, file.text)) return reject('placeholder');

    diffLines += lineCount(search) + lineCount(replace);
    clean.push({ file: edit.file, search, replace });
    const list = spans.get(edit.file) ?? [];
    list.push({ start: found.start, end: found.start + search.length });
    spans.set(edit.file, list);
    stored.push({
      file: edit.file,
      search,
      replace,
      line: first,
      ...lineAround(file.text, found.start, found.start + search.length),
    });
  }

  if (diffLines > MAX_FIX_DIFF_LINES) return reject('too_large');
  for (const list of spans.values()) {
    if (overlapping(list)) return reject('overlapping_edits');
  }

  return { ok: true, edits: stored, warnings: warningsAdded(clean), diffLines };
}
