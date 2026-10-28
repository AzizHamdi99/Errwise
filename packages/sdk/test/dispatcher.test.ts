import { afterEach, describe, expect, it, vi } from "vitest";
import { Dispatcher } from "../src/dispatcher";
import type { DispatcherOptions } from "../src/dispatcher";
import type { SendResult, Transport } from "../src/transport";
import type { ErrwiseEvent } from "../src/types";

const FAST: Partial<DispatcherOptions> = {
  flushIntervalMs: 10,
  backoffBaseMs: 10,
  backoffMaxMs: 40,
  defaultRetryAfterMs: 40,
};

let counter = 0;
function event(overrides: Partial<ErrwiseEvent> = {}): ErrwiseEvent {
  counter += 1;
  return {
    eventId: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    type: "Error",
    message: `message ${counter}`,
    level: "error",
    timestamp: new Date().toISOString(),
    environment: "test",
    platform: "node",
    sdk: "test/0",
    ...overrides,
  };
}

interface Call {
  events: ErrwiseEvent[];
  at: number;
}

/** Answers with the given results in order, then with 202. */
function scripted(results: SendResult[]) {
  const calls: Call[] = [];
  const transport: Transport = {
    send(body) {
      calls.push({
        events: JSON.parse(body) as ErrwiseEvent[],
        at: Date.now(),
      });
      return Promise.resolve(results[calls.length - 1] ?? { status: 202 });
    },
  };
  return { transport, calls };
}

const created: Dispatcher[] = [];
afterEach(async () => {
  for (const dispatcher of created.splice(0)) await dispatcher.close(10);
});

function setup(
  results: SendResult[] = [],
  overrides: Partial<DispatcherOptions> = {},
) {
  const logger = { debug: vi.fn(), warn: vi.fn() };
  const { transport, calls } = scripted(results);
  const dispatcher = new Dispatcher(transport, logger, {
    ...FAST,
    ...overrides,
  });
  created.push(dispatcher);
  return { dispatcher, calls, logger };
}

describe("batching", () => {
  it("sends queued events together in one request", async () => {
    const { dispatcher, calls } = setup();
    dispatcher.enqueue(event());
    dispatcher.enqueue(event());
    dispatcher.enqueue(event());

    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.events).toHaveLength(3);
  });

  it("sends right away when the batch is full", async () => {
    const { dispatcher, calls } = setup([], {
      batchSize: 2,
      flushIntervalMs: 10_000,
    });
    dispatcher.enqueue(event());
    dispatcher.enqueue(event());
    await vi.waitFor(() => expect(calls).toHaveLength(1));
  });

  it("keeps every request under the size budget", async () => {
    const size = Buffer.byteLength(JSON.stringify(event()));
    const { dispatcher, calls } = setup([], { maxBatchBytes: size * 2 + 20 });
    for (let i = 0; i < 5; i++) dispatcher.enqueue(event());

    await vi.waitFor(() =>
      expect(calls.flatMap((c) => c.events)).toHaveLength(5),
    );
    expect(Math.max(...calls.map((c) => c.events.length))).toBe(2);
  });
});

describe("failures", () => {
  it("retries after a network error with the same events", async () => {
    const { dispatcher, calls } = setup([{}, {}, { status: 202 }]);
    const sent = event();
    dispatcher.enqueue(sent);

    await vi.waitFor(() => expect(calls).toHaveLength(3));
    expect(calls.map((c) => c.events[0]?.eventId)).toEqual([
      sent.eventId,
      sent.eventId,
      sent.eventId,
    ]);
    await expect(dispatcher.flush(500)).resolves.toBe(true);
    expect(dispatcher.pending).toBe(0);
  });

  it("retries after a 503", async () => {
    const { dispatcher, calls } = setup([{ status: 503 }, { status: 202 }]);
    dispatcher.enqueue(event());
    await vi.waitFor(() => expect(calls).toHaveLength(2));
  });

  it("waits for Retry-After after a 429", async () => {
    const { dispatcher, calls } = setup([
      { status: 429, retryAfterMs: 80 },
      { status: 202 },
    ]);
    dispatcher.enqueue(event());

    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect((calls[1]?.at ?? 0) - (calls[0]?.at ?? 0)).toBeGreaterThanOrEqual(
      70,
    );
  });

  it("sends a rejected batch one event at a time and drops only the bad one", async () => {
    const { dispatcher, calls, logger } = setup([
      { status: 400 }, // the whole batch
      { status: 202 }, // event 1
      { status: 400 }, // event 2 is the bad one
      { status: 202 }, // event 3
    ]);
    [event(), event(), event()].forEach((e) => dispatcher.enqueue(e));

    await vi.waitFor(() => expect(calls).toHaveLength(4));
    expect(calls.map((c) => c.events.length)).toEqual([3, 1, 1, 1]);
    await expect(dispatcher.flush(500)).resolves.toBe(true);
    expect(calls).toHaveLength(4);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("stops for good when the key is rejected", async () => {
    const { dispatcher, calls, logger } = setup([{ status: 401 }]);
    dispatcher.enqueue(event());

    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledTimes(1));
    expect(dispatcher.enqueue(event())).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toHaveLength(1);
    expect(dispatcher.pending).toBe(0);
  });
});

describe("rate cap", () => {
  it("drops events over the cap, but never a crash", async () => {
    const { dispatcher, calls, logger } = setup([], { maxEventsPerMinute: 2 });
    expect(dispatcher.enqueue(event())).toBe(true);
    expect(dispatcher.enqueue(event())).toBe(true);
    expect(dispatcher.enqueue(event())).toBe(false);
    expect(dispatcher.enqueue(event({ level: "fatal" }))).toBe(true);

    await dispatcher.flush(500);
    expect(calls.flatMap((c) => c.events)).toHaveLength(3);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe("flush and close", () => {
  it("flush sends right away and resolves true", async () => {
    const { dispatcher, calls } = setup([], { flushIntervalMs: 10_000 });
    dispatcher.enqueue(event());
    await expect(dispatcher.flush(500)).resolves.toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("flush gives up after the timeout when the API is down", async () => {
    const { dispatcher } = setup(
      Array.from({ length: 100 }, () => ({}) as SendResult),
    );
    dispatcher.enqueue(event());

    const started = Date.now();
    await expect(dispatcher.flush(60)).resolves.toBe(false);
    expect(Date.now() - started).toBeLessThan(400);
  });

  it("flush resolves true when there is nothing to send", async () => {
    const { dispatcher } = setup();
    await expect(dispatcher.flush(10)).resolves.toBe(true);
  });

  it("close aborts a request in flight and refuses new events", async () => {
    const signals: AbortSignal[] = [];
    const hanging: Transport = {
      send: (_body, _count, signal) =>
        new Promise((resolve) => {
          if (!signal) return;
          signals.push(signal);
          signal.addEventListener("abort", () => resolve({}));
        }),
    };
    const dispatcher = new Dispatcher(
      hanging,
      { debug: vi.fn(), warn: vi.fn() },
      FAST,
    );
    created.push(dispatcher);

    dispatcher.enqueue(event());
    await vi.waitFor(() => expect(signals).toHaveLength(1));

    await dispatcher.close(30);
    expect(signals[0]?.aborted).toBe(true);
    expect(dispatcher.enqueue(event())).toBe(false);
  });
});
