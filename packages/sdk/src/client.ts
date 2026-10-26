import type { ResolvedConfig } from "./config";
import { buildEvent, enforceLimits } from "./event";
import type { Logger } from "./logger";
import type { Transport } from "./transport";
import type { CaptureOptions, ErrwiseEvent } from "./types";
import { describeError } from "./utils";

const DEFAULT_FLUSH_TIMEOUT_MS = 2_000;

function isEventLike(value: unknown): value is ErrwiseEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

export class ErrwiseClient {
  private readonly pending = new Set<Promise<unknown>>();
  private closed = false;

  constructor(
    private readonly config: ResolvedConfig,
    private readonly transport: Transport,
    private readonly logger: Logger,
  ) {}

  /** Never throws and never waits for the network. Returns the event id, or undefined if nothing was sent. */
  captureException(
    error: unknown,
    options?: CaptureOptions,
  ): string | undefined {
    if (this.closed) return undefined;
    try {
      const event = this.applyBeforeSend(
        buildEvent(error, this.config, options),
      );
      if (!event) return undefined;
      this.track(this.transport.send([event]));
      return event.eventId;
    } catch (caught) {
      this.logger.debug(
        `could not capture the error: ${describeError(caught)}`,
      );
      return undefined;
    }
  }

  /** Waits for events that are being sent. Returns false if the timeout was reached first. */
  async flush(timeoutMs: number = DEFAULT_FLUSH_TIMEOUT_MS): Promise<boolean> {
    if (this.pending.size === 0) return true;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
      timer?.unref(); // the timer must never keep the process alive
    });
    const drained = Promise.allSettled([...this.pending]).then(
      () => true as const,
    );

    try {
      return await Promise.race([drained, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async close(timeoutMs?: number): Promise<void> {
    this.closed = true;
    await this.flush(timeoutMs);
  }

  private applyBeforeSend(event: ErrwiseEvent): ErrwiseEvent | null {
    const hook = this.config.beforeSend;
    if (!hook) return event;

    try {
      const result: unknown = hook(event);
      if (result === null) {
        this.logger.debug("the event was dropped by beforeSend");
        return null;
      }
      if (!isEventLike(result)) {
        this.logger.warn(
          "beforeSend must synchronously return the event or null. The event was dropped.",
        );
        return null;
      }
      // eventId is the idempotency key: a hook must not change it
      return enforceLimits({ ...result, eventId: event.eventId });
    } catch (caught) {
      // fail closed: a broken scrubber must not leak data
      this.logger.warn(
        `beforeSend threw, so the event was dropped: ${describeError(caught)}`,
      );
      return null;
    }
  }

  private track(promise: Promise<unknown>): void {
    const tracked = promise
      .catch(() => undefined)
      .finally(() => this.pending.delete(tracked));
    this.pending.add(tracked);
  }
}
