import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Errwise } from "../src";
import type { ErrwiseEvent, ErrwiseOptions } from "../src";
import { startFakeServer } from "./fake-server";
import type { FakeServer } from "./fake-server";

const API_KEY = `ew_live_${"a".repeat(32)}`;
let server: FakeServer;

beforeEach(async () => {
  server = await startFakeServer();
});

afterEach(async () => {
  await Errwise.close();
  await server.close();
  vi.restoreAllMocks();
});

const init = (extra: Partial<ErrwiseOptions> = {}) =>
  Errwise.init({
    apiKey: API_KEY,
    endpoint: server.url,
    environment: "test",
    release: "1.2.3",
    ...extra,
  });

const sentEvents = () =>
  server.received.flatMap((r) => r.body as ErrwiseEvent[]);

describe("captureException", () => {
  it("sends the event to /v1/events with the key", async () => {
    init();
    const id = Errwise.captureException(new TypeError("boom"));
    await Errwise.flush();

    expect(server.received).toHaveLength(1);
    const [request] = server.received;
    expect(request?.url).toBe("/v1/events");
    expect(request?.headers["x-api-key"]).toBe(API_KEY);
    expect(request?.headers["content-type"]).toBe("application/json");
    expect(request?.headers["user-agent"]).toMatch(/^errwise-node\//);

    const [event] = sentEvents();
    expect(event).toMatchObject({
      eventId: id,
      type: "TypeError",
      message: "boom",
      environment: "test",
      release: "1.2.3",
    });
  });

  it("accepts anything that can be thrown", async () => {
    init();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    for (const value of [undefined, null, "text", 42, circular, Symbol("s")]) {
      expect(typeof Errwise.captureException(value)).toBe("string");
    }
    await Errwise.flush();
    expect(sentEvents()).toHaveLength(6);
  });

  it("never throws when the API is down", async () => {
    const dead = await startFakeServer();
    const url = dead.url;
    await dead.close(); // nothing listens on this port anymore

    init({ endpoint: url });
    expect(() => Errwise.captureException(new Error("x"))).not.toThrow();
    await expect(Errwise.flush()).resolves.toBe(true);
  });

  it("warns only once when the key is rejected", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    server.setStatus(401);
    init();
    Errwise.captureException(new Error("a"));
    Errwise.captureException(new Error("b"));
    await Errwise.flush();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("beforeSend", () => {
  it("can scrub an event", async () => {
    init({
      beforeSend: (e) => ({ ...e, message: e.message.replace(/\d+/g, "<n>") }),
    });
    Errwise.captureException(new Error("user 42 not found"));
    await Errwise.flush();
    expect(sentEvents()[0]?.message).toBe("user <n> not found");
  });

  it("can drop an event", async () => {
    init({ beforeSend: () => null });
    expect(Errwise.captureException(new Error("x"))).toBeUndefined();
    await Errwise.flush();
    expect(server.received).toHaveLength(0);
  });

  it("drops the event when the hook throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    init({
      beforeSend: () => {
        throw new Error("bug in the hook");
      },
    });
    expect(Errwise.captureException(new Error("x"))).toBeUndefined();
    await Errwise.flush();
    expect(server.received).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
  });

  it("drops the event when the hook is async", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    init({
      beforeSend: (async (e: ErrwiseEvent) =>
        e) as unknown as ErrwiseOptions["beforeSend"],
    });
    expect(Errwise.captureException(new Error("x"))).toBeUndefined();
  });

  it("cannot change the eventId", async () => {
    init({ beforeSend: (e) => ({ ...e, eventId: "not-a-uuid" }) });
    const id = Errwise.captureException(new Error("x"));
    await Errwise.flush();
    expect(sentEvents()[0]?.eventId).toBe(id);
  });
});

describe("init, enabled and close", () => {
  it("does nothing when enabled is false", async () => {
    init({ enabled: false });
    expect(Errwise.captureException(new Error("x"))).toBeUndefined();
    await Errwise.flush();
    expect(server.received).toHaveLength(0);
  });

  it("does not throw on a bad config and stays off", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() =>
      Errwise.init({ apiKey: "nope", endpoint: server.url }),
    ).not.toThrow();
    expect(Errwise.captureException(new Error("x"))).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it("ignores a second init until close() is called", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    init({ environment: "first" });
    init({ environment: "second" });
    expect(warn).toHaveBeenCalledTimes(1);

    Errwise.captureException(new Error("x"));
    await Errwise.flush();
    expect(sentEvents()[0]?.environment).toBe("first");

    await Errwise.close();
    init({ environment: "third" });
    Errwise.captureException(new Error("y"));
    await Errwise.flush();
    expect(sentEvents()[1]?.environment).toBe("third");
  });

  it("captures nothing after close()", async () => {
    init();
    await Errwise.close();
    expect(Errwise.captureException(new Error("x"))).toBeUndefined();
  });

  it("can be called before init without throwing", async () => {
    expect(Errwise.captureException(new Error("x"))).toBeUndefined();
    await expect(Errwise.flush()).resolves.toBe(true);
  });
});
