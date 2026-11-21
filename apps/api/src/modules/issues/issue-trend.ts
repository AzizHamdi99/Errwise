import { TREND_HOURS } from '@errwise/shared';

const HOUR_MS = 60 * 60 * 1000;

/** One row of the grouped query: only hours that have events are returned. */
export interface HourlyCount {
  issueId: string;
  /** The start of a UTC hour. */
  bucket: Date;
  count: number;
}

/**
 * The first hour of the window: the current UTC hour and the 23 before it. Whole hours, so the
 * SQL buckets (`date_trunc('hour', ..., 'UTC')`) and these indexes line up exactly, and the
 * current, unfinished hour is the last value.
 */
export function trendStart(now: Date): Date {
  const currentHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  return new Date(currentHour - (TREND_HOURS - 1) * HOUR_MS);
}

/**
 * Turns the sparse rows into TREND_HOURS values per issue, oldest first. Every requested issue
 * gets an array (all zeros when it had no event), so callers never have to handle a missing one.
 * A row outside the window (an event timestamped after the current hour) is ignored.
 */
export function buildTrends(
  issueIds: string[],
  rows: HourlyCount[],
  since: Date,
): Map<string, number[]> {
  const trends = new Map<string, number[]>(
    issueIds.map((id) => [id, new Array<number>(TREND_HOURS).fill(0)]),
  );

  for (const row of rows) {
    const trend = trends.get(row.issueId);
    const offset = (row.bucket.getTime() - since.getTime()) / HOUR_MS;
    if (
      trend &&
      Number.isInteger(offset) &&
      offset >= 0 &&
      offset < TREND_HOURS
    ) {
      trend[offset] += row.count;
    }
  }
  return trends;
}
