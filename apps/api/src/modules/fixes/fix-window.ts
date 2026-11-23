import { scrubText } from '../../common/utils/scrub';

/** Lines on each side of the failing one, before the code is cut to fit its budget. */
const START_RADIUS = 30;

export interface CodeWindow {
  /** 1-based, inclusive. These are the lines the model may edit (see fix-patch.ts). */
  startLine: number;
  endLine: number;
  failingLine: number;
  /** The lines as they are in the file. Never sent anywhere: used to compare. */
  raw: string;
  /** The same lines with secrets and personal data removed. This is what leaves for the AI. */
  code: string;
}

function linesOf(text: string): string[] {
  if (text === '') return []; // an empty file has no lines at all
  const lines = text.split('\n');
  // A file that ends with a newline has no extra empty line.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * The lines around `failingLine` of a "\n" text, as many as fit in `maxChars` once scrubbed
 * (a placeholder can be longer than the secret it replaces, so the limit is checked after).
 * The window shrinks around the failing line, and is never cut inside a line: the model
 * copies text from it, and a half line would never match the file.
 * Null when the line is not in the file, or when the line alone is too long (minified code).
 */
export function cutWindow(
  text: string,
  failingLine: number,
  maxChars: number,
): CodeWindow | null {
  const lines = linesOf(text);
  if (!Number.isInteger(failingLine) || failingLine < 1) return null;
  if (failingLine > lines.length) return null;

  for (let radius = START_RADIUS; ; radius = Math.floor(radius * 0.7)) {
    const startLine = Math.max(1, failingLine - radius);
    const endLine = Math.min(lines.length, failingLine + radius);
    const raw = lines.slice(startLine - 1, endLine).join('\n');
    // Nothing to show is not a window: the contract needs real code in it.
    if (raw.trim() === '') return null;
    const code = scrubText(raw);
    if (code.length <= maxChars) {
      return { startLine, endLine, failingLine, raw, code };
    }
    if (radius === 0) return null;
  }
}
