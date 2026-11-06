export interface StackFrame {
  fn: string | null;
  file: string;
  line: number | null;
  column: number | null;
  inApp: boolean;
}

export interface ParsedStack {
  header: string;
  frames: StackFrame[];
}

const FRAME_RE = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;
const LIBRARY_RE = /node_modules|^node:/;

const normalize = (file: string) =>
  file.replace(/^file:\/\//, "").replace(/\\/g, "/");

export function parseStack(stack: string): ParsedStack {
  const header: string[] = [];
  const frames: StackFrame[] = [];

  for (const raw of stack.split("\n")) {
    const text = raw.trimEnd();
    if (!text.trim()) continue;

    const match = FRAME_RE.exec(text);
    if (match) {
      const file = normalize(match[2] ?? "");
      frames.push({
        fn: match[1] ?? null,
        file,
        line: Number(match[3]),
        column: Number(match[4]),
        inApp: !LIBRARY_RE.test(file),
      });
    } else if (/^\s*at\s/.test(text)) {
      frames.push({
        fn: null,
        file: text.trim().slice(3),
        line: null,
        column: null,
        inApp: false,
      });
    } else if (frames.length === 0) {
      header.push(text);
    }
  }

  return { header: header.join("\n"), frames };
}

/** Keeps the end of long absolute paths readable. */
export function shortPath(file: string): string {
  const idx = file.lastIndexOf("node_modules/");
  if (idx !== -1) return file.slice(idx);
  const parts = file.split("/").filter(Boolean);
  return parts.length > 3 ? parts.slice(-3).join("/") : parts.join("/");
}
