import { sha256 } from '../../common/utils/hash';

/**
 * Bump this when the algorithm changes, and store it on the issue,
 * so old and new groups are never mixed silently.
 */
export const FINGERPRINT_VERSION = 1;

const MAX_MESSAGE_CHARS = 1_000;
const MAX_FRAMES_SCANNED = 50;
const MAX_LINE_CHARS = 500;
const PATH_SEGMENTS = 3;
const TITLE_MAX_CHARS = 200;

// Quotes that open a value, not apostrophes inside words ("can't", "user's").
const QUOTED = /(?<![\p{L}\p{N}])(?:"[^"\n]*"|'[^'\n]*'|`[^`\n]*`)/gu;
const UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g;
const HEX_PREFIXED = /\b0x[0-9a-f]+\b/g;
const LONG_HEX = /\b[0-9a-f]{16,}\b/g;
const NUMBER = /\d+/g;

// "at fn (file:line:col)", "at file:line:col", "at async fn (...)", "at new Foo (...)"
const FRAME = /^\s*at\s+(?:async\s+)?(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;

/** Lowercases and replaces the parts of a message that change between occurrences. */
export function normalizeMessage(message: string): string {
  return message
    .slice(0, MAX_MESSAGE_CHARS)
    .toLowerCase()
    .replace(QUOTED, '<str>')
    .replace(UUID, '<uuid>')
    .replace(HEX_PREFIXED, '<hex>')
    .replace(LONG_HEX, '<hex>')
    .replace(NUMBER, '<n>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAppFile(file: string): boolean {
  const normalized = file.replace(/\\/g, '/');
  return (
    !/(^|\/)node_modules\//.test(normalized) &&
    !normalized.startsWith('node:') &&
    !normalized.startsWith('internal/') &&
    normalized !== '<anonymous>'
  );
}

/**
 * Keeps the last path segments only, so the same code gives the same
 * fingerprint on a laptop, in Docker and on Vercel.
 */
function shortPath(file: string): string {
  return file
    .replace(/^file:\/\//, '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .slice(-PATH_SEGMENTS)
    .join('/');
}

/**
 * First stack frame outside node_modules and Node internals, as
 * "function@path". No line number, so small edits don't split an issue.
 */
export function topAppFrame(stack: string | undefined): string | null {
  if (!stack) return null;

  const lines = stack.split('\n').slice(0, MAX_FRAMES_SCANNED);
  for (const raw of lines) {
    const match = FRAME.exec(raw.slice(0, MAX_LINE_CHARS));
    if (!match) continue;

    const fn = match[1];
    const file = match[2];
    if (!file || !isAppFile(file)) continue;

    const name = (fn ?? '<anonymous>').replace(/^new\s+/, '');
    return `${name}@${shortPath(file)}`;
  }
  return null;
}

export function computeFingerprint(input: {
  type: string;
  message: string;
  stack?: string;
}): string {
  const parts = [
    `v${FINGERPRINT_VERSION}`,
    input.type.trim(),
    normalizeMessage(input.message),
    topAppFrame(input.stack) ?? '',
  ];
  return sha256(parts.join('\n'));
}

export function buildTitle(type: string, message: string): string {
  const firstLine = message.split('\n')[0]?.trim() ?? '';
  return `${type}: ${firstLine}`.slice(0, TITLE_MAX_CHARS);
}
