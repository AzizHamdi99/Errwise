import { cn } from "@/lib/utils";
import type { DiffRow, FileDiff } from "../fix-view";

const MARKER: Record<DiffRow["kind"], string> = {
  context: " ",
  remove: "−",
  add: "+",
};

const SR_LABEL: Record<DiffRow["kind"], string> = {
  context: "",
  remove: " (removed)",
  add: " (added)",
};

/**
 * The change, as a diff per file. All of it comes from a model and a repository, so it is
 * rendered as text and nothing else: no HTML, no markdown, no links.
 */
export function FixDiff({ files }: { files: FileDiff[] }) {
  return (
    <div className="space-y-3">
      {files.map((file) => (
        <section
          key={file.file}
          aria-label={`Change in ${file.file}`}
          className="overflow-hidden rounded-lg border"
        >
          <header className="flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-1.5 font-mono text-xs">
            <span className="min-w-0 truncate" title={file.file}>
              {file.file}
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">
                +{file.added}
              </span>{" "}
              <span className="text-destructive">−{file.removed}</span>
            </span>
          </header>

          {/* tabIndex lets keyboard users scroll long lines */}
          <div
            role="region"
            aria-label={`Lines changed in ${file.file}`}
            tabIndex={0}
            className="overflow-x-auto py-1 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {file.hunks.map((rows, hunk) => (
              <div
                key={hunk}
                className={cn(hunk > 0 && "mt-1 border-t border-dashed pt-1")}
              >
                {rows.map((row, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex min-w-max",
                      row.kind === "add" && "bg-emerald-500/10",
                      row.kind === "remove" && "bg-destructive/10",
                    )}
                  >
                    <span
                      aria-hidden
                      className="w-10 shrink-0 pr-2 text-right tabular-nums select-none text-muted-foreground"
                    >
                      {row.oldNumber ?? ""}
                    </span>
                    <span
                      aria-hidden
                      className="w-10 shrink-0 pr-2 text-right tabular-nums select-none text-muted-foreground"
                    >
                      {row.newNumber ?? ""}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "w-5 shrink-0 text-center select-none",
                        row.kind === "add" &&
                          "text-emerald-600 dark:text-emerald-400",
                        row.kind === "remove" && "text-destructive",
                      )}
                    >
                      {MARKER[row.kind]}
                    </span>
                    <code className="pr-4 whitespace-pre">
                      {row.text || " "}
                    </code>
                    <span className="sr-only">{SR_LABEL[row.kind]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
