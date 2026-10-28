import { describe, expect, it } from "vitest";
import { computeBackoff } from "../src/backoff";

describe("computeBackoff", () => {
  it("grows exponentially, between half and the full delay", () => {
    expect(computeBackoff(1, 1000, 60_000, () => 0)).toBe(500);
    expect(computeBackoff(1, 1000, 60_000, () => 1)).toBe(1000);
    expect(computeBackoff(2, 1000, 60_000, () => 0)).toBe(1000);
    expect(computeBackoff(2, 1000, 60_000, () => 1)).toBe(2000);
    expect(computeBackoff(4, 1000, 60_000, () => 1)).toBe(8000);
  });

  it("never exceeds the cap", () => {
    expect(computeBackoff(20, 1000, 60_000, () => 1)).toBe(60_000);
    expect(computeBackoff(200, 1000, 60_000, () => 1)).toBe(60_000);
    expect(computeBackoff(20, 1000, 60_000, () => 0)).toBe(30_000);
  });

  it("treats an attempt below 1 as the first", () => {
    expect(computeBackoff(0, 1000, 60_000, () => 1)).toBe(1000);
  });
});
