"use client";

import { STATS_RANGES, type StatsRange } from "@errwise/shared";
import { cn } from "@/lib/utils";

const LABELS: Record<StatsRange, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "14d": "14 days",
  "30d": "30 days",
};

export const rangeLabel = (range: StatsRange) => LABELS[range];

interface Props {
  value: StatsRange;
  onChange: (range: StatsRange) => void;
}

export function RangeSelect({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Time range"
      className="inline-flex rounded-lg border bg-background/40 p-0.5"
    >
      {STATS_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            value === range && "bg-accent text-foreground",
          )}
        >
          {range}
        </button>
      ))}
    </div>
  );
}
