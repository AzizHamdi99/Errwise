export type CodeLanguage = "ts" | "bash" | "json" | "text";

const TOKEN = new RegExp(
  [
    // At a line start or after a space, so the "//" of a URL is not a comment.
    "(?<comment>(?<=^|\\s)(?:\\/\\/|#).*$)",
    "(?<string>\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)",
    "(?<keyword>\\b(?:import|from|export|const|let|async|await|function|return|new|class|try|catch|finally|throw|if|else|null|true|false|undefined)\\b)",
    "(?<call>\\b[A-Za-z_$][\\w$]*(?=\\())",
  ].join("|"),
  "g",
);

const COLORS: Record<string, string> = {
  comment: "text-muted-foreground italic",
  string: "text-code-string",
  keyword: "text-brand-text",
  call: "text-code-call",
};

/** A small highlighter for our own snippets, one line at a time. Not a parser. */
export function highlightLine(
  line: string,
  language: CodeLanguage,
): React.ReactNode {
  if (language === "text") return line;

  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    const kind = Object.keys(match.groups ?? {}).find(
      (name) => match.groups?.[name] !== undefined,
    );
    if (!kind) continue;
    // In a shell only comments and strings mean anything, and JSON has no calls or comments.
    if (language === "bash" && (kind === "keyword" || kind === "call")) continue;
    if (language === "json" && (kind === "comment" || kind === "call")) continue;

    if (match.index > last) parts.push(line.slice(last, match.index));
    parts.push(
      <span key={match.index} className={COLORS[kind]}>
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}
