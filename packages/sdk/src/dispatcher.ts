import { computeBackoff } from "./backoff";
import type { Logger } from "./logger";
import { BoundedQueue } from "./queue";
import type { QueuedEvent } from "./queue";
import { RateLimiter } from "./rate-limiter";
import type { SendResult, Transport } from "./transport";
import type { ErrwiseEvent } from "./types";
import { describeError } from "./utils";

export interface DispatcherOptions {
  maxQueueSize: number;
  batchSize: number;
  maxBatchBytes: number;
  flushIntervalMs: number;
  maxEventsPerMinute: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  defaultRetryAfterMs: number;
  maxRetryAfterMs: number;
}

export const DEFAULT_DISPATCHER_OPTIONS: DispatcherOptions = {
  maxQueueSize: 100,
  batchSize: 50, // the API accepts at most 50 events per request
  maxBatchBytes: 900_000, // the API body limit is 1 MB
  flushIntervalMs: 2_000,
  maxEventsPerMinute: 120,
  backoffBaseMs: 1_000,
  backoffMaxMs: 60_000,
  defaultRetryAfterMs: 60_000,
  maxRetryAfterMs: 300_000,
};

type Outcome =
  | { kind: "sent" }
  | { kind: "retry"; delayMs: number; countsAsFailure: boolean }
  | { kind: "invalid"; status: number }
  | { kind: "unauthorized" };

const sumBytes = (items: readonly QueuedEvent[]) =>
  items.reduce((sum, item) => sum + item.bytes, 0);

/** Queues events, sends them in batches, and retries what failed. Never throws. */
export class Dispatcher {
  private readonly options: DispatcherOptions;
  private readonly queue: BoundedQueue<QueuedEvent>;
  private readonly limiter: RateLimiter;
  private readonly stopController = new AbortController();

  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | null = null;
  private wake: (() => void) | null = null;
  private nextAttemptAt = 0;
  private failures = 0;
  private singles = 0; // how many of the next batches are sent one event at a time
  private stopped = false;
  private disabled = false;
  private warnedRateCap = false;
  private warnedRejected = false;

  constructor(
    private readonly transport: Transport,
    private readonly logger: Logger,
    overrides: Partial<DispatcherOptions> = {},
  ) {
    this.options = { ...DEFAULT_DISPATCHER_OPTIONS, ...overrides };
    this.queue = new BoundedQueue(this.options.maxQueueSize);
    this.limiter = new RateLimiter(this.options.maxEventsPerMinute);
  }

  /** Events waiting to be sent. */
  get pending(): number {
    return this.queue.size;
  }

  /** Returns false if the event was not accepted. */
  enqueue(event: ErrwiseEvent): boolean {
    if (this.stopped || this.disabled) return false;

    // A crash report is never dropped by the cap.
    if (event.level !== "fatal" && !this.limiter.allow(Date.now())) {
      if (!this.warnedRateCap) {
        this.warnedRateCap = true;
        this.logger.warn(
          `More than ${this.options.maxEventsPerMinute} events in a minute: the extra events are dropped.`,
        );
      }
      return false;
    }

    const body = JSON.stringify(event);
    const droppedBefore = this.queue.dropped;
    this.queue.push({ body, bytes: Buffer.byteLength(body) });
    if (this.queue.dropped > droppedBefore) {
      this.logger.debug("the queue is full: the oldest event was dropped");
    }

    if (this.queue.size >= this.options.batchSize) {
      this.clearTimer();
      this.kick();
    } else {
      this.schedule();
    }
    return true;
  }

  /** Sends what is queued right now. Resolves true when nothing is left, false after the timeout. */
  async flush(timeoutMs: number): Promise<boolean> {
    if (this.disabled) return true;
    if (this.queue.size === 0 && !this.running) return true;

    this.clearTimer();
    this.nextAttemptAt = 0; // skip any backoff: the caller wants the events delivered now
    this.kick();
    this.wakeUp();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
      timer?.unref();
    });
    try {
      return await Promise.race([this.untilIdle(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Flushes, then stops the timers and aborts any request still in flight. */
  async close(timeoutMs: number): Promise<void> {
    try {
      await this.flush(timeoutMs);
    } finally {
      this.stopped = true;
      this.clearTimer();
      this.stopController.abort();
      this.wakeUp();
    }
  }

  private async untilIdle(): Promise<boolean> {
    while (this.running) await this.running;
    return this.queue.size === 0;
  }

  // ---- the sender loop ------------------------------------------------------

  private kick(): void {
    if (this.running || this.stopped || this.disabled || this.queue.size === 0)
      return;

    this.running = this.run()
      .catch((error: unknown) =>
        this.logger.debug(
          `the sender stopped unexpectedly: ${describeError(error)}`,
        ),
      )
      .finally(() => {
        this.running = null;
        if (this.queue.size > 0) this.schedule();
      });
  }

  private async run(): Promise<void> {
    while (!this.stopped && !this.disabled && this.queue.size > 0) {
      const wait = this.nextAttemptAt - Date.now();
      if (wait > 0) {
        await this.sleep(wait);
        continue;
      }

      const single = this.singles > 0;
      const limit = single ? 1 : this.options.batchSize;
      const items = this.queue.take(
        (item, taken) =>
          taken.length < limit &&
          sumBytes(taken) + item.bytes <= this.options.maxBatchBytes,
      );

      const body = `[${items.map((item) => item.body).join(",")}]`;
      const result = await this.transport.send(
        body,
        items.length,
        this.stopController.signal,
      );
      this.handle(this.classify(result), items, single);
    }
    if (this.queue.size === 0) this.singles = 0;
  }

  private classify(result: SendResult): Outcome {
    const { status } = result;
    if (status === undefined) return this.backoff(); // network error, timeout or abort
    if (status >= 200 && status < 300) return { kind: "sent" };
    if (status === 401 || status === 403) return { kind: "unauthorized" };
    if (status === 429) {
      const wait = result.retryAfterMs ?? this.options.defaultRetryAfterMs;
      return {
        kind: "retry",
        delayMs: Math.min(
          Math.max(wait, this.options.backoffBaseMs),
          this.options.maxRetryAfterMs,
        ),
        countsAsFailure: false,
      };
    }
    if (status >= 400 && status < 500 && status !== 408) {
      return { kind: "invalid", status };
    }
    return this.backoff(); // 408, 5xx, anything unexpected
  }

  private backoff(): Outcome {
    return {
      kind: "retry",
      delayMs: computeBackoff(
        this.failures + 1,
        this.options.backoffBaseMs,
        this.options.backoffMaxMs,
      ),
      countsAsFailure: true,
    };
  }

  private handle(
    outcome: Outcome,
    items: QueuedEvent[],
    single: boolean,
  ): void {
    switch (outcome.kind) {
      case "sent":
        this.failures = 0;
        this.nextAttemptAt = 0;
        if (single) this.singles -= 1;
        break;

      case "retry":
        this.queue.requeueFront(items);
        if (outcome.countsAsFailure) this.failures += 1;
        this.nextAttemptAt = Date.now() + outcome.delayMs;
        break;

      case "invalid":
        // the API answered, so it is reachable
        this.failures = 0;
        this.nextAttemptAt = 0;
        if (items.length > 1) {
          // The API rejects a whole batch for one bad event: send them one by one.
          this.queue.requeueFront(items);
          this.singles = items.length;
        } else {
          if (single) this.singles -= 1;
          this.dropRejected(outcome.status);
        }
        break;

      case "unauthorized":
        this.disable();
        break;
    }
  }

  private dropRejected(status: number): void {
    this.logger.debug(
      `the API rejected an event (${status}), so it was dropped`,
    );
    if (this.warnedRejected) return;
    this.warnedRejected = true;
    this.logger.warn(
      `The API rejected an event (${status}) and it was dropped. Check the endpoint and that the SDK is up to date.`,
    );
  }

  private disable(): void {
    if (this.disabled) return;
    this.disabled = true;
    this.queue.clear();
    this.clearTimer();
    this.wakeUp();
    this.logger.warn(
      "The API key was rejected, so events are no longer sent. Check the key and that it was not revoked.",
    );
  }

  // ---- timers ---------------------------------------------------------------

  private schedule(): void {
    if (this.timer || this.running || this.stopped || this.disabled) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.kick();
    }, this.options.flushIntervalMs);
    this.timer.unref(); // the SDK must never keep the app alive
  }

  private clearTimer(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** A sleep that can be interrupted by wakeUp(). */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      const done = () => {
        clearTimeout(timer);
        this.wake = null;
        resolve();
      };
      timer = setTimeout(done, ms);
      timer.unref();
      this.wake = done;
    });
  }

  private wakeUp(): void {
    this.wake?.();
  }
}
