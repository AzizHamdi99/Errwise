import { ExternalLink } from "lucide-react";
import type { FoundSourceFrame } from "@errwise/shared";
import { cn } from "@/lib/utils";

// The API builds this link, but it ends up in an href: only ever link to GitHub.
const GITHUB_PREFIX = "https://github.com/";

/**
 * The code around one frame, the failing line highlighted. Everything is rendered as text:
 * the file comes from a repository, so it is never treated as markup.
 */
export function SourceCode({ frame }: { frame: FoundSourceFrame }) {
  const url = frame.url.startsWith(GITHUB_PREFIX) ? frame.url : null;

  return (
    <div className="border-y bg-muted/30">
      <div
        role="region"
        aria-label={`Source of ${frame.repoPath}`}
        className="overflow-x-auto py-2 font-mono text-xs leading-5"
      >
        {frame.lines.map((text, i) => {
          const number = frame.startLine + i;
          const failing = number === frame.line;
          return (
            <div
              key={number}
              className={cn(
                "flex min-w-max border-l-2 border-transparent px-4",
                failing && "border-destructive bg-destructive/10",
              )}
            >
              <span
                aria-hidden
                className="w-10 shrink-0 pr-4 text-right tabular-nums select-none text-muted-foreground"
              >
                {number}
              </span>
              <code className="whitespace-pre">{text || " "}</code>
              {failing ? (
                <span className="sr-only"> (failing line)</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <footer className="flex items-center justify-between gap-3 border-t px-4 py-1.5 text-[11px] text-muted-foreground">
        <span className="min-w-0 truncate" title={frame.repoPath}>
          {frame.repoPath}:{frame.line}
        </span>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            View on GitHub
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </footer>
    </div>
  );
}
