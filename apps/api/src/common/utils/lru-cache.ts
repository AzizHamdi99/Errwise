interface Entry<V> {
  value: V;
  size: number;
  expiresAt: number;
}

export interface LruCacheOptions<V> {
  maxEntries: number;
  /** Total size budget, in whatever unit `sizeOf` returns. */
  maxBytes: number;
  /** Entries older than this are gone, even if nothing evicted them. */
  ttlMs: number;
  sizeOf: (value: V) => number;
  /** Only tests pass this. */
  now?: () => number;
}

/**
 * In-memory cache bounded by entry count and total size, with a time limit per entry.
 * Least recently used entries leave first.
 *
 * `getOrLoad` also merges simultaneous loads of the same key into one, and never keeps a
 * failure, so a flaky upstream is retried by the next caller.
 */
export class LruCache<V> {
  // A Map iterates in insertion order, so the first key is always the least recently used.
  private readonly entries = new Map<string, Entry<V>>();
  private readonly loading = new Map<string, Promise<V>>();
  private totalSize = 0;
  private readonly now: () => number;

  constructor(private readonly options: LruCacheOptions<V>) {
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.remove(key, entry);
      return undefined;
    }
    // Re-insert so the key becomes the most recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    const existing = this.entries.get(key);
    if (existing) this.remove(key, existing);

    const size = this.options.sizeOf(value);
    // A value larger than the whole budget is not worth emptying the cache for.
    if (size > this.options.maxBytes) return;

    this.entries.set(key, {
      value,
      size,
      expiresAt: this.now() + this.options.ttlMs,
    });
    this.totalSize += size;

    while (
      this.entries.size > this.options.maxEntries ||
      this.totalSize > this.options.maxBytes
    ) {
      const oldest = this.entries.entries().next();
      if (oldest.done) break;
      this.remove(oldest.value[0], oldest.value[1]);
    }
  }

  async getOrLoad(key: string, loader: () => Promise<V>): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const running = this.loading.get(key);
    if (running) return running;

    const promise = loader()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => this.loading.delete(key));
    this.loading.set(key, promise);
    return promise;
  }

  private remove(key: string, entry: Entry<V>): void {
    this.entries.delete(key);
    this.totalSize -= entry.size;
  }
}
