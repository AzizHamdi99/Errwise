import { cn } from "@/lib/utils";

const BAR_WIDTH = 2;
const GAP = 1;
const HEIGHT = 20;
/** A single event in an hour must still be visible next to a busy one. */
const MIN_BAR = 2;

interface Props {
  /** Events per hour, oldest first; the last value is the current (unfinished) hour. */
  counts: number[];
  className?: string;
}

/**
 * The last 24 hours of an issue as hourly columns. Each row is scaled to its own peak (the shape
 * of the trend is what matters here; the row already shows the total), earlier hours are in a
 * recessive tone and the current hour is in the accent. An hour with no event is empty, not a
 * zero-height bar, over a hairline baseline. The size is too small for a hover tooltip per bar,
 * so the whole mark has one label.
 */
export function IssueSparkline({ counts, className }: Props) {
  const width = counts.length * BAR_WIDTH + (counts.length - 1) * GAP;
  const max = Math.max(0, ...counts);
  const total = counts.reduce((sum, count) => sum + count, 0);

  const label =
    total === 0
      ? "No events in the last 24 hours"
      : `${total.toLocaleString()} ${total === 1 ? "event" : "events"} in the last 24 hours, ` +
        `at most ${max.toLocaleString()} in one hour`;

  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={HEIGHT}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      className={cn("shrink-0", className)}
    >
      <title>{label}</title>
      <rect
        x={0}
        y={HEIGHT - 1}
        width={width}
        height={1}
        className="fill-border"
      />
      {counts.map((count, index) => {
        if (count === 0) return null;
        const height = Math.max(MIN_BAR, Math.round((count / max) * HEIGHT));
        const current = index === counts.length - 1;
        return (
          <rect
            key={index}
            x={index * (BAR_WIDTH + GAP)}
            y={HEIGHT - height}
            width={BAR_WIDTH}
            height={height}
            rx={1}
            className={current ? "fill-primary" : "fill-muted-foreground/70"}
          />
        );
      })}
    </svg>
  );
}
