import type { SeriesPoint, StatsRange } from '@errwise/shared';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type BucketUnit = 'hour' | 'day';

const RANGE_SPECS: Record<StatsRange, { unit: BucketUnit; buckets: number }> = {
  '24h': { unit: 'hour', buckets: 24 },
  '7d': { unit: 'day', buckets: 7 },
  '14d': { unit: 'day', buckets: 14 },
  '30d': { unit: 'day', buckets: 30 },
};

export interface StatsWindow {
  unit: BucketUnit;
  /** Inclusive start, aligned to a bucket boundary (UTC). */
  from: Date;
  /** Exclusive end: the start of the bucket after the current one. */
  to: Date;
  /** The window of the same length right before `from`, for the delta. */
  previousFrom: Date;
}

function bucketMs(unit: BucketUnit): number {
  return unit === 'hour' ? HOUR_MS : DAY_MS;
}

/**
 * Buckets are aligned to UTC and the current, still incomplete bucket is included,
 * so "7d" always shows 7 bars with today as the last one.
 */
export function resolveWindow(range: StatsRange, now: Date): StatsWindow {
  const { unit, buckets } = RANGE_SPECS[range];
  const size = bucketMs(unit);
  const to = new Date((Math.floor(now.getTime() / size) + 1) * size);
  const from = new Date(to.getTime() - buckets * size);
  const previousFrom = new Date(from.getTime() - buckets * size);
  return { unit, from, to, previousFrom };
}

export interface LevelCountRow {
  bucket: Date;
  level: string;
  count: number;
}

const EMPTY_LEVELS = { fatal: 0, error: 0, warning: 0, info: 0 } as const;

/** Turns sparse grouped rows into one point per bucket; empty buckets are zeros. */
export function fillSeries(
  rows: LevelCountRow[],
  window: StatsWindow,
): SeriesPoint[] {
  const size = bucketMs(window.unit);
  const points = new Map<number, SeriesPoint>();

  for (let t = window.from.getTime(); t < window.to.getTime(); t += size) {
    points.set(t, { bucket: new Date(t).toISOString(), ...EMPTY_LEVELS });
  }

  for (const row of rows) {
    const point = points.get(row.bucket.getTime());
    if (!point || !(row.level in EMPTY_LEVELS)) continue;
    point[row.level as keyof typeof EMPTY_LEVELS] += row.count;
  }

  return [...points.values()];
}
