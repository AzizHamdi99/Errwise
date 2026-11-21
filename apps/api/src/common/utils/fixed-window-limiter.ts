interface Window {
  count: number;
  resetAt: number;
}

/** Bounds the memory: an attacker with many addresses cannot grow the map without limit. */
const MAX_KEYS = 10_000;

export interface LimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Counts hits per key in a fixed window, in memory. It resets on restart and each instance has
 * its own counters (serverless), so it is a brake against abuse, not an exact quota. Move to a
 * shared store when a hard guarantee is needed. The clock is injectable for tests.
 */
export class FixedWindowLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Counts one hit and says whether it is still within the limit. */
  hit(key: string): LimitResult {
    const now = this.now();
    this.makeRoom(now);

    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;

    return {
      allowed: window.count <= this.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    };
  }

  private makeRoom(now: number): void {
    if (this.windows.size < MAX_KEYS) return;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
    // Still full of live windows: drop the oldest one (a Map keeps insertion order).
    if (this.windows.size >= MAX_KEYS) {
      const oldest = this.windows.keys().next();
      if (!oldest.done) this.windows.delete(oldest.value);
    }
  }
}
