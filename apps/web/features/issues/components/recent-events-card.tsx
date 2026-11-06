"use client";

import type { PublicEvent } from "@errwise/shared";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RecentEventsCard({
  events,
  total,
  selectedId,
  onSelect,
}: {
  events: PublicEvent[];
  total: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section aria-label="Recent events" className="rounded-xl border bg-card">
      <header className="flex items-baseline justify-between border-b px-4 py-2">
        <h2 className="text-sm font-medium">Recent events</h2>
        <p className="text-xs text-muted-foreground">
          Showing the latest {events.length}
          {total > events.length ? ` of ${total.toLocaleString()}` : ""}
        </p>
      </header>

      <ul className="p-2">
        {events.map((event) => {
          const selected = event.id === selectedId;
          return (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onSelect(event.id)}
                aria-pressed={selected}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full border",
                    selected
                      ? "border-primary bg-primary"
                      : "border-muted-foreground",
                  )}
                  aria-hidden
                />
                <span
                  className="font-medium"
                  title={new Date(event.timestamp).toLocaleString()}
                >
                  {formatRelative(event.timestamp)}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {event.environment} · {event.release ?? "no release"}
                </span>
                {selected ? (
                  <span className="text-muted-foreground">Selected</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
