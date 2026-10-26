import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveConfig } from "../src/config";
import type { ErrwiseOptions } from "../src/types";

const apiKey = `ew_live_${"a".repeat(32)}`;
const valid: ErrwiseOptions = { apiKey, endpoint: "http://localhost:4000" };

afterEach(() => vi.unstubAllEnvs());

describe("resolveConfig", () => {
  it("accepts valid options", () => {
    const result = resolveConfig(valid);
    expect(result.ok).toBe(true);
  });

  it("builds the events url from the endpoint", () => {
    const url = (endpoint: string) => {
      const result = resolveConfig({ ...valid, endpoint });
      return result.ok ? result.config.eventsUrl : null;
    };
    expect(url("http://localhost:4000")).toBe(
      "http://localhost:4000/v1/events",
    );
    expect(url("http://localhost:4000/")).toBe(
      "http://localhost:4000/v1/events",
    );
    expect(url("https://example.com/errwise/")).toBe(
      "https://example.com/errwise/v1/events",
    );
    expect(url("https://example.com/?x=1#y")).toBe(
      "https://example.com/v1/events",
    );
  });

  it("rejects a missing or malformed key without echoing it", () => {
    const result = resolveConfig({ ...valid, apiKey: "ew_live_secretvalue" });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secretvalue");
    expect(resolveConfig({ ...valid, apiKey: undefined as never }).ok).toBe(
      false,
    );
  });

  it("rejects invalid endpoints", () => {
    for (const endpoint of [
      "",
      "localhost:4000",
      "ftp://example.com",
      "nope",
      undefined,
    ]) {
      expect(resolveConfig({ ...valid, endpoint: endpoint as never }).ok).toBe(
        false,
      );
    }
  });

  it("does not throw on garbage options", () => {
    expect(resolveConfig(undefined as never).ok).toBe(false);
    expect(resolveConfig(null as never).ok).toBe(false);
  });

  it("resolves the environment: option, then NODE_ENV, then production", () => {
    const env = (options: Partial<ErrwiseOptions>) => {
      const result = resolveConfig({ ...valid, ...options });
      return result.ok ? result.config.environment : null;
    };
    expect(env({ environment: "staging" })).toBe("staging");
    vi.stubEnv("NODE_ENV", "development");
    expect(env({})).toBe("development");
    vi.stubEnv("NODE_ENV", "");
    expect(env({})).toBe("production");
  });

  it("resolves the release from the option or ERRWISE_RELEASE", () => {
    const release = (options: Partial<ErrwiseOptions>) => {
      const result = resolveConfig({ ...valid, ...options });
      return result.ok ? result.config.release : null;
    };
    expect(release({ release: "1.0.0" })).toBe("1.0.0");
    vi.stubEnv("ERRWISE_RELEASE", "2.0.0");
    expect(release({})).toBe("2.0.0");
  });

  it("keeps enabled on unless it is false", () => {
    const enabled = (value: boolean | undefined) => {
      const result = resolveConfig({ ...valid, enabled: value });
      return result.ok ? result.config.enabled : null;
    };
    expect(enabled(undefined)).toBe(true);
    expect(enabled(false)).toBe(false);
  });
});
