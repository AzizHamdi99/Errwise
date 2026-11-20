export const CONTEXT_RADIUS = 5;
const MAX_LINE_LENGTH = 300;

export interface LineWindow {
  /** 1-based number of the first returned line. */
  startLine: number;
  lines: string[];
}

function toLines(text: string): string[] {
  if (text === '') return []; // an empty file has no lines at all
  const lines = text
    .split('\n')
    .map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
  // A file that ends with a newline has no extra empty line.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * The lines around `line` (1-based), `radius` before and after. Null when the file is
 * shorter than `line`: that means the file is not the one that ran, so show nothing.
 * Very long lines (minified code) are cut so a response can not become huge.
 */
export function sliceAround(
  text: string,
  line: number,
  radius: number = CONTEXT_RADIUS,
): LineWindow | null {
  const all = toLines(text);
  if (!Number.isInteger(line) || line < 1 || line > all.length) return null;

  const startLine = Math.max(1, line - radius);
  const endLine = Math.min(all.length, line + radius);
  return {
    startLine,
    lines: all
      .slice(startLine - 1, endLine)
      .map((l) =>
        l.length > MAX_LINE_LENGTH ? `${l.slice(0, MAX_LINE_LENGTH)}…` : l,
      ),
  };
}
