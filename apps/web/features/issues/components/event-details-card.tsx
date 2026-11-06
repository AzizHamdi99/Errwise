"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { PublicEvent } from "@errwise/shared";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/shared/copy-button";

const display = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "unknown";
  return typeof value === "string" ? value : JSON.stringify(value);
};

function requestOf(context: Record<string, unknown> | null): string | null {
  const request = context?.request as
    { method?: unknown; path?: unknown } | undefined;
  if (
    request &&
    typeof request.method === "string" &&
    typeof request.path === "string"
  ) {
    return `${request.method} ${request.path}`;
  }
  return null;
}

export function EventDetailsCard({ event }: { event: PublicEvent }) {
  const [contextOpen, setContextOpen] = useState(false);
  const request = requestOf(event.context);
  const contextJson = event.context
    ? JSON.stringify(event.context, null, 2)
    : null;

  const rows: [string, string][] = [
    ["Environment", display(event.environment)],
    ["Release", event.release ?? "none"],
    ["Level", display(event.level)],
    ["Platform", display(event.platform)],
    ["SDK", display(event.sdk)],
    ["Time", formatRelative(event.timestamp)],
  ];
  if (request) rows.push(["Request", request]);

  return (
    <section aria-label="Event details" className="rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <h2 className="text-sm font-medium">Event</h2>
        <span className="flex min-w-0 items-center gap-1">
          <span
            className="truncate font-mono text-xs text-muted-foreground"
            title={event.eventId}
          >
            {event.eventId}
          </span>
          <CopyButton value={event.eventId} aria-label="Copy event id" />
        </span>
      </header>

      <dl className="space-y-3 px-4 py-4 text-xs">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd
              className="min-w-0 text-right font-medium wrap-break"
              title={
                label === "Time"
                  ? new Date(event.timestamp).toLocaleString()
                  : undefined
              }
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="border-t px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setContextOpen((value) => !value)}
            aria-expanded={contextOpen}
            disabled={!contextJson}
            className="flex items-center gap-1.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                contextOpen && "rotate-90",
              )}
              aria-hidden
            />
            Context
            {!contextJson ? <span className="font-normal">(none)</span> : null}
          </button>
          {contextJson ? (
            <CopyButton value={contextJson} aria-label="Copy context" />
          ) : null}
        </div>
        {contextOpen && contextJson ? (
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">
            {contextJson}
          </pre>
        ) : null}
      </div>
    </section>
  );
}
