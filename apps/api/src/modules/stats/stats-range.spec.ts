import { fillSeries, resolveWindow } from './stats-range';

const NOW = new Date('2026-11-20T15:42:10.000Z');

describe('resolveWindow', () => {
  it('7d: 7 daily buckets, today is the last one', () => {
    const w = resolveWindow('7d', NOW);
    expect(w.unit).toBe('day');
    expect(w.to.toISOString()).toBe('2026-11-21T00:00:00.000Z');
    expect(w.from.toISOString()).toBe('2026-11-14T00:00:00.000Z');
  });

  it('24h: 24 hourly buckets, the current hour is the last one', () => {
    const w = resolveWindow('24h', NOW);
    expect(w.unit).toBe('hour');
    expect(w.to.toISOString()).toBe('2026-11-20T16:00:00.000Z');
    expect(w.from.toISOString()).toBe('2026-11-19T16:00:00.000Z');
  });

  it('30d spans 30 days and the previous window has the same length', () => {
    const w = resolveWindow('30d', NOW);
    const span = w.to.getTime() - w.from.getTime();
    expect(span).toBe(30 * 24 * 3600 * 1000);
    expect(w.from.getTime() - w.previousFrom.getTime()).toBe(span);
  });

  it('exactly on a boundary, the new bucket is the current one', () => {
    const w = resolveWindow('7d', new Date('2026-11-20T00:00:00.000Z'));
    expect(w.to.toISOString()).toBe('2026-11-21T00:00:00.000Z');
  });

  it('crosses a month and year boundary', () => {
    const w = resolveWindow('14d', new Date('2027-01-03T10:00:00.000Z'));
    expect(w.from.toISOString()).toBe('2026-12-21T00:00:00.000Z');
  });
});

describe('fillSeries', () => {
  const window = resolveWindow('7d', NOW);

  it('returns one point per bucket, all zeros when there are no rows', () => {
    const series = fillSeries([], window);
    expect(series).toHaveLength(7);
    expect(series.every((p) => p.error === 0 && p.fatal === 0)).toBe(true);
    expect(series[0].bucket).toBe('2026-11-14T00:00:00.000Z');
    expect(series[6].bucket).toBe('2026-11-20T00:00:00.000Z');
  });

  it('places counts in the right bucket and level', () => {
    const series = fillSeries(
      [
        {
          bucket: new Date('2026-11-20T00:00:00.000Z'),
          level: 'error',
          count: 5,
        },
        {
          bucket: new Date('2026-11-20T00:00:00.000Z'),
          level: 'fatal',
          count: 1,
        },
        {
          bucket: new Date('2026-11-16T00:00:00.000Z'),
          level: 'warning',
          count: 2,
        },
      ],
      window,
    );
    expect(series[6]).toMatchObject({ error: 5, fatal: 1, warning: 0 });
    expect(series[2]).toMatchObject({ warning: 2, error: 0 });
  });

  it('ignores unknown levels and rows outside the window', () => {
    const series = fillSeries(
      [
        {
          bucket: new Date('2026-11-20T00:00:00.000Z'),
          level: 'debug',
          count: 9,
        },
        {
          bucket: new Date('2026-01-01T00:00:00.000Z'),
          level: 'error',
          count: 9,
        },
      ],
      window,
    );
    expect(series.reduce((sum, p) => sum + p.error + p.fatal + p.info, 0)).toBe(
      0,
    );
  });
});
