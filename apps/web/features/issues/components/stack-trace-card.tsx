"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { parseStack, shortPath } from "../stack-trace";
import type { StackFrame } from "../stack-trace";
import { CopyButton } from "@/components/shared/copy-button";

type Indexed = { frame: StackFrame; index: number };
type Segment =
  { kind: "app"; item: Indexed } | { kind: "lib"; items: Indexed[] };

function buildSegments(frames: StackFrame[]): Segment[] {
  const segments: Segment[] = [];
  frames.forEach((frame, index) => {
    const item = { frame, index };
    if (frame.inApp) {
      segments.push({ kind: "app", item });
      return;
    }
    const last = segments[segments.length - 1];
    if (last?.kind === "lib") last.items.push(item);
    else segments.push({ kind: "lib", items: [item] });
  });
  return segments;
}

function FrameRow({ frame, index }: Indexed) {
  const location = `${shortPath(frame.file)}${
    frame.line !== null ? `:${frame.line}:${frame.column}` : ""
  }`;

  return (
    <li className="flex items-baseline gap-3 px-4 py-1.5 font-mono text-xs">
      <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <span
        className={cn(
          "min-w-0 break-all",
          frame.inApp ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="text-muted-foreground">at </span>
        <span className="font-semibold">{frame.fn ?? "<anonymous>"}</span>{" "}
        <span className="text-primary" title={frame.file}>
          {location}
        </span>
      </span>
    </li>
  );
}

function LibraryGroup({
  items,
  defaultOpen,
}: {
  items: Indexed[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-left font-mono text-xs text-muted-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
          aria-hidden
        />
        {items.length} {items.length === 1 ? "frame" : "frames"} in node_modules
        and internals
      </button>
      {open ? (
        <ol>
          {items.map((item) => (
            <FrameRow key={item.index} {...item} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function StackTraceCard({
  stack,
  message,
}: {
  stack: string | null;
  message: string;
}) {
  const parsed = useMemo(() => (stack ? parseStack(stack) : null), [stack]);
  const segments = useMemo(
    () => (parsed ? buildSegments(parsed.frames) : []),
    [parsed],
  );
  const hasAppFrames = segments.some((segment) => segment.kind === "app");

  return (
    <section aria-label="Stack trace" className="rounded-xl border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="text-sm font-medium">Stack trace</h2>
        {stack ? <CopyButton value={stack} label="Copy" /> : null}
      </header>

      {!stack || !parsed ? (
        <div className="space-y-2 px-4 py-6 text-sm">
          <p className="font-mono text-xs break-words">{message}</p>
          <p className="text-muted-foreground">
            No stack trace was captured for this event.
          </p>
        </div>
      ) : parsed.frames.length === 0 ? (
        <pre className="overflow-x-auto px-4 py-4 font-mono text-xs">
          {stack}
        </pre>
      ) : (
        <div className="py-2">
          {parsed.header ? (
            <p className="border-b px-4 pb-2 font-mono text-xs break-words whitespace-pre-wrap text-muted-foreground">
              {parsed.header}
            </p>
          ) : null}
          <ol className="pt-1">
            {segments.map((segment, i) =>
              segment.kind === "app" ? (
                <FrameRow key={segment.item.index} {...segment.item} />
              ) : (
                <LibraryGroup
                  key={`lib-${i}`}
                  items={segment.items}
                  defaultOpen={!hasAppFrames}
                />
              ),
            )}
          </ol>
        </div>
      )}
    </section>
  );
}
