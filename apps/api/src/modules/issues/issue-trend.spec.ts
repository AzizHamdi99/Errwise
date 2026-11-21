import { TREND_HOURS } from '@errwise/shared';
import { buildTrends, trendStart } from './issue-trend';
import type { HourlyCount } from './issue-trend';

const HOUR = 60 * 60 * 1000;
// 12:34:56 UTC: the current hour is 12:00, so the window is 13:00 yesterday .. 12:00 today.
const NOW = new Date('2026-11-21T12:34:56.789Z');
const SINCE = new Date('2026-11-20T13:00:00.000Z');

const hour = (offset: number) => new Date(SINCE.getTime() + offset * HOUR);
const row = (issueId: string, offset: number, count: number): HourlyCount => ({
  issueId,
  bucket: hour(offset),
  count,
});

describe('trendStart', () => {
  it('is the start of the hour 23 hours before the current one', () => {
    expect(trendStart(NOW)).toEqual(SINCE);
  });

  it('treats the exact start of an hour as the current hour', () => {
    expect(trendStart(new Date('2026-11-21T12:00:00.000Z'))).toEqual(SINCE);
    expect(trendStart(new Date('2026-11-21T11:59:59.999Z'))).toEqual(
      new Date('2026-11-20T12:00:00.000Z'),
    );
  });

  it('crosses midnight and a month end in UTC', () => {
    expect(trendStart(new Date('2026-12-01T00:10:00.000Z'))).toEqual(
      new Date('2026-11-30T01:00:00.000Z'),
    );
  });

  it('always spans TREND_HOURS hours up to the current one', () => {
    const start = trendStart(NOW).getTime();
    const currentHour = Math.floor(NOW.getTime() / HOUR) * HOUR;
    expect((currentHour - start) / HOUR + 1).toBe(TREND_HOURS);
  });
});

describe('buildTrends', () => {
  it('gives every issue TREND_HOURS values, all zero when it had no event', () => {
    const trends = buildTrends(['a', 'b'], [], SINCE);

    expect(trends.get('a')).toEqual(new Array(TREND_HOURS).fill(0));
    expect(trends.get('b')).toHaveLength(TREND_HOURS);
  });

  it('puts each count at its hour, oldest first, current hour last', () => {
    const trends = buildTrends(
      ['a'],
      [row('a', 0, 5), row('a', 12, 2), row('a', TREND_HOURS - 1, 9)],
      SINCE,
    );

    const trend = trends.get('a') ?? [];
    expect(trend[0]).toBe(5);
    expect(trend[12]).toBe(2);
    expect(trend[TREND_HOURS - 1]).toBe(9);
    expect(trend.reduce((a, b) => a + b, 0)).toBe(16);
  });

  it('keeps issues apart, and their arrays are not shared', () => {
    const trends = buildTrends(['a', 'b'], [row('a', 3, 1)], SINCE);

    expect(trends.get('a')?.[3]).toBe(1);
    expect(trends.get('b')?.[3]).toBe(0);
  });

  it('ignores rows outside the window (before it, or after the current hour)', () => {
    const trends = buildTrends(
      ['a'],
      [row('a', -1, 7), row('a', TREND_HOURS, 7)],
      SINCE,
    );

    expect(trends.get('a')?.every((count) => count === 0)).toBe(true);
  });

  it('ignores a bucket that is not on a whole hour, and an issue that was not asked for', () => {
    const trends = buildTrends(
      ['a'],
      [
        {
          issueId: 'a',
          bucket: new Date(SINCE.getTime() + 30 * 60_000),
          count: 4,
        },
        row('someone-else', 2, 4),
      ],
      SINCE,
    );

    expect(trends.get('a')?.every((count) => count === 0)).toBe(true);
    expect(trends.has('someone-else')).toBe(false);
  });

  it('adds up two rows of the same hour', () => {
    const trends = buildTrends(['a'], [row('a', 5, 2), row('a', 5, 3)], SINCE);

    expect(trends.get('a')?.[5]).toBe(5);
  });

  it('works with no issue at all', () => {
    expect(buildTrends([], [row('a', 1, 1)], SINCE).size).toBe(0);
  });
});
