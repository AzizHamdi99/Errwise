import type { StatsRange } from "@errwise/shared";

// Buckets are aligned to UTC, so the labels are shown in UTC too: a bar never
// disagrees with the boundary the server used.
const hourFormat = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});
const dayFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "14:00" for the 24h range, "Nov 20" for the daily ones. */
export function bucketLabel(range: StatsRange): (bucket: string) => string {
  const format = range === "24h" ? hourFormat : dayFormat;
  return (bucket) => format.format(new Date(bucket));
}
