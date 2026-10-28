import type { ResolvedConfig } from "./config";
import type { Dispatcher } from "./dispatcher";
import { buildEvent, enforceLimits } from "./event";
import type { Logger } from "./logger";
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
  private closed = false;

  constructor(
    private readonly config: ResolvedConfig,
    private readonly dispatcher: Dispatcher,
    private readonly logger: Logger,
  ) {}

  /** Never throws and never waits for the network. Returns the event id, or undefined if the event was not accepted. */
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
      return this.dispatcher.enqueue(event) ? event.eventId : undefined;
    } catch (caught) {
      this.logger.debug(
        `could not capture the error: ${describeError(caught)}`,
      );
      return undefined;
    }
  }

  /** Sends what is queued. Resolves false if events are still queued after the timeout. */
  flush(timeoutMs: number = DEFAULT_FLUSH_TIMEOUT_MS): Promise<boolean> {
    return this.dispatcher.flush(timeoutMs);
  }

  async close(timeoutMs: number = DEFAULT_FLUSH_TIMEOUT_MS): Promise<void> {
    this.closed = true;
    await this.dispatcher.close(timeoutMs);
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
}
