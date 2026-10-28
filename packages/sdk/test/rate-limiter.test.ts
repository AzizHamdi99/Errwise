import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/rate-limiter";

describe("RateLimiter", () => {
  const t0 = 1_000_000;

  it("allows up to the limit in a window, then starts over", () => {
    const limiter = new RateLimiter(2);
    expect(limiter.allow(t0)).toBe(true);
    expect(limiter.allow(t0 + 10)).toBe(true);
    expect(limiter.allow(t0 + 20)).toBe(false);
    expect(limiter.allow(t0 + 59_999)).toBe(false);
    expect(limiter.allow(t0 + 60_000)).toBe(true);
  });
});
