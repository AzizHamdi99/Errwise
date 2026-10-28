import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTransport, parseRetryAfter } from "../src/transport";
import { startFakeServer } from "./fake-server";
import type { FakeServer } from "./fake-server";

const logger = { debug: () => undefined, warn: () => undefined };
const apiKey = `ew_live_${"a".repeat(32)}`;
let server: FakeServer;

beforeEach(async () => {
  server = await startFakeServer();
});
afterEach(async () => {
  await server.close();
});

const transport = (url = server.url) =>
  createTransport({ apiKey, eventsUrl: `${url}/v1/events` }, logger);

describe("parseRetryAfter", () => {
  it("reads seconds and dates", () => {
    expect(parseRetryAfter("3")).toBe(3000);
    expect(parseRetryAfter("0")).toBe(0);
    const now = Date.UTC(2026, 0, 1);
    expect(parseRetryAfter(new Date(now + 5000).toUTCString(), now)).toBe(5000);
    expect(parseRetryAfter(new Date(now - 5000).toUTCString(), now)).toBe(0);
  });

  it("ignores missing or garbage values", () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("")).toBeUndefined();
    expect(parseRetryAfter("soon")).toBeUndefined();
  });
});

describe("transport", () => {
  it("posts the body as it is, with the key", async () => {
    const result = await transport().send('[{"a":1}]', 1);
    expect(result.status).toBe(202);
    expect(server.received[0]?.body).toEqual([{ a: 1 }]);
    expect(server.received[0]?.headers["x-api-key"]).toBe(apiKey);
  });

  it("reports the status and Retry-After of a failure", async () => {
    server.setStatus(429, { "retry-after": "3" });
    expect(await transport().send("[]", 0)).toEqual({
      status: 429,
      retryAfterMs: 3000,
    });
  });

  it("returns an empty result when the server is unreachable", async () => {
    const dead = await startFakeServer();
    const url = dead.url;
    await dead.close();
    expect(await transport(url).send("[]", 0)).toEqual({});
  });

  it("gives up when it is told to stop", async () => {
    server.setDelay(2_000);
    const stop = new AbortController();
    setTimeout(() => stop.abort(), 30);

    const started = Date.now();
    expect(await transport().send("[]", 0, stop.signal)).toEqual({});
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("does not send when it is already stopped", async () => {
    const stop = new AbortController();
    stop.abort();
    expect(await transport().send("[]", 0, stop.signal)).toEqual({});
    expect(server.received).toHaveLength(0);
  });
});
