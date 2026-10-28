import { describe, expect, it } from "vitest";
import type { ResolvedConfig } from "../src/config";
import { LIMITS, buildEvent, normalizeError } from "../src/event";

const config: ResolvedConfig = {
  apiKey: `ew_live_${"a".repeat(32)}`,
  eventsUrl: "http://localhost:4000/v1/events",
  environment: "production",
  release: "1.0.0",
  enabled: true,
  debug: false,
  beforeSend: undefined,
  captureUncaughtErrors: true,
};

describe("normalizeError", () => {
  it("reads an Error", () => {
    const error = new TypeError("boom");
    expect(normalizeError(error)).toEqual({
      type: "TypeError",
      message: "boom",
      stack: error.stack,
    });
  });

  it("falls back to the type when the message is empty", () => {
    expect(normalizeError(new RangeError("")).message).toBe("RangeError");
  });

  it("keeps the name of a custom error", () => {
    class PaymentError extends Error {
      override name = "PaymentError";
    }
    expect(normalizeError(new PaymentError("declined")).type).toBe(
      "PaymentError",
    );
  });

  it("describes values that are not errors", () => {
    expect(normalizeError("oops").message).toBe("Non-Error thrown: oops");
    expect(normalizeError({ code: "E1" }).message).toBe(
      'Non-Error thrown: {"code":"E1"}',
    );
    expect(normalizeError(undefined).message).toBe(
      "Non-Error thrown: undefined",
    );
    expect(normalizeError(42).stack).toBeUndefined();
  });

  it("does not throw on circular objects", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(normalizeError(circular).message).toContain("Non-Error thrown");
  });
});

describe("buildEvent", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");

  it("fills every field", () => {
    const event = buildEvent(new TypeError("boom"), config, {}, now);
    expect(event).toMatchObject({
      type: "TypeError",
      message: "boom",
      level: "error",
      timestamp: "2026-01-01T12:00:00.000Z",
      environment: "production",
      release: "1.0.0",
      platform: "node",
    });
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.sdk).toMatch(/^errwise-node\/\d+\.\d+\.\d+/);
    expect(event.context).toMatchObject({
      nodeVersion: process.version,
      os: process.platform,
    });
  });

  it("generates a different eventId every time", () => {
    const a = buildEvent(new Error("x"), config);
    const b = buildEvent(new Error("x"), config);
    expect(a.eventId).not.toBe(b.eventId);
  });

  it("truncates fields to the API limits", () => {
    const error = new Error("m".repeat(10_000));
    error.stack = "s".repeat(100_000);
    const event = buildEvent(error, config);
    expect(event.message).toHaveLength(LIMITS.message);
    expect(event.stack).toHaveLength(LIMITS.stack);
  });

  it("puts extra data under context.extra", () => {
    const event = buildEvent(new Error("x"), config, { extra: { userId: 7 } });
    expect(event.context?.extra).toEqual({ userId: 7 });
  });

  it("handles bigint in extra", () => {
    const event = buildEvent(new Error("x"), config, { extra: { big: 10n } });
    expect(event.context?.extra).toEqual({ big: "10" });
  });

  it("drops extra that cannot be serialized", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const event = buildEvent(new Error("x"), config, { extra: circular });
    expect(event.context?.extra).toBeUndefined();
    expect(event.context?.extraDropped).toBe("not serializable");
  });

  it("drops extra that is too large", () => {
    const event = buildEvent(new Error("x"), config, {
      extra: { blob: "x".repeat(20_000) },
    });
    expect(event.context?.extra).toBeUndefined();
    expect(event.context?.extraDropped).toBe("too large");
    expect(JSON.stringify(event.context).length).toBeLessThanOrEqual(
      LIMITS.context,
    );
  });

  it('falls back to "error" for an invalid level', () => {
    const event = buildEvent(new Error("x"), config, {
      level: "banana" as never,
    });
    expect(event.level).toBe("error");
  });
});
