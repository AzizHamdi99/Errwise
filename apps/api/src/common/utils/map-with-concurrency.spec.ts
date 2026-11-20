import { mapWithConcurrency } from './map-with-concurrency';

describe('mapWithConcurrency', () => {
  it('keeps the order of the items', async () => {
    const out = await mapWithConcurrency([30, 10, 20], 3, async (ms, i) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return `${i}:${ms}`;
    });
    expect(out).toEqual(['0:30', '1:10', '2:20']);
  });

  it('never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }), 4, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
    });
    expect(peak).toBe(4);
  });

  it('handles an empty list and a limit larger than the list', async () => {
    await expect(
      mapWithConcurrency([], 4, () => Promise.resolve(1)),
    ).resolves.toEqual([]);
    await expect(
      mapWithConcurrency([1, 2], 10, (n) => Promise.resolve(n * 2)),
    ).resolves.toEqual([2, 4]);
  });

  it('rejects with the first failure and stops starting new items', async () => {
    const started: number[] = [];
    await expect(
      mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
        started.push(n);
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
    expect(started.length).toBeLessThan(6);
  });
});
