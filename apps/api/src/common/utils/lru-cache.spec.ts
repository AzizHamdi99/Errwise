import { LruCache } from './lru-cache';

function make(
  overrides: Partial<ConstructorParameters<typeof LruCache<string>>[0]> = {},
) {
  let time = 1_000;
  const cache = new LruCache<string>({
    maxEntries: 3,
    maxBytes: 100,
    ttlMs: 60_000,
    sizeOf: (value) => value.length,
    now: () => time,
    ...overrides,
  });
  return {
    cache,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('LruCache', () => {
  it('stores and returns values', () => {
    const { cache } = make();
    cache.set('a', 'one');
    expect(cache.get('a')).toBe('one');
    expect(cache.get('missing')).toBeUndefined();
  });

  it('forgets an entry after its time to live', () => {
    const { cache, advance } = make({ ttlMs: 1_000 });
    cache.set('a', 'one');
    advance(999);
    expect(cache.get('a')).toBe('one');
    advance(1);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('drops the least recently used entry when it is full', () => {
    const { cache } = make({ maxEntries: 2 });
    cache.set('a', '1');
    cache.set('b', '2');
    cache.get('a'); // a is now the most recent
    cache.set('c', '3');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('1');
    expect(cache.get('c')).toBe('3');
  });

  it('respects the size budget, not just the entry count', () => {
    const { cache } = make({ maxBytes: 10, maxEntries: 100 });
    cache.set('a', 'aaaa'); // 4
    cache.set('b', 'bbbb'); // 8
    cache.set('c', 'cccc'); // 12: evicts a
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('bbbb');
    expect(cache.get('c')).toBe('cccc');
  });

  it('does not empty the cache for a value larger than the whole budget', () => {
    const { cache } = make({ maxBytes: 10 });
    cache.set('a', 'small');
    cache.set('huge', 'x'.repeat(11));
    expect(cache.get('huge')).toBeUndefined();
    expect(cache.get('a')).toBe('small');
  });

  it('replaces a key without double counting its size', () => {
    const { cache } = make({ maxBytes: 10, maxEntries: 100 });
    cache.set('a', 'aaaaaa'); // 6
    cache.set('a', 'bbbbbb'); // still 6 in total, not 12
    cache.set('b', 'cccc'); // 10 in total: fits
    expect(cache.get('a')).toBe('bbbbbb');
    expect(cache.get('b')).toBe('cccc');
  });
});

describe('LruCache.getOrLoad', () => {
  it('loads once and serves the stored value afterwards', async () => {
    const { cache } = make();
    const loader = jest.fn().mockResolvedValue('value');

    await expect(cache.getOrLoad('k', loader)).resolves.toBe('value');
    await expect(cache.getOrLoad('k', loader)).resolves.toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('merges simultaneous loads of the same key into one', async () => {
    const { cache } = make();
    let release!: (value: string) => void;
    const loader = jest.fn(
      () => new Promise<string>((resolve) => (release = resolve)),
    );

    const first = cache.getOrLoad('k', loader);
    const second = cache.getOrLoad('k', loader);
    release('value');

    await expect(Promise.all([first, second])).resolves.toEqual([
      'value',
      'value',
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not keep a failure: the next call tries again', async () => {
    const { cache } = make();
    const loader = jest
      .fn()
      .mockRejectedValueOnce(new Error('upstream down'))
      .mockResolvedValueOnce('recovered');

    await expect(cache.getOrLoad('k', loader)).rejects.toThrow('upstream down');
    await expect(cache.getOrLoad('k', loader)).resolves.toBe('recovered');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('keeps different keys apart', async () => {
    const { cache } = make();
    await cache.getOrLoad('a', () => Promise.resolve('1'));
    await expect(
      cache.getOrLoad('b', () => Promise.resolve('2')),
    ).resolves.toBe('2');
  });
});
