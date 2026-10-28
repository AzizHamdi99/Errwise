import type { ResolvedConfig } from "./config";
import type { Logger } from "./logger";
import { describeError } from "./utils";
import { SDK_NAME, SDK_VERSION } from "./version";

const REQUEST_TIMEOUT_MS = 5_000;

export interface SendResult {
  /** HTTP status. Undefined when the request itself failed (network error, timeout, abort). */
  status?: number;
  /** From the Retry-After header, in milliseconds. */
  retryAfterMs?: number;
}

export interface Transport {
  /** `body` is a JSON array of events. Never throws. */
  send(body: string, count: number, stop?: AbortSignal): Promise<SendResult>;
}

/** Retry-After is either a number of seconds or an HTTP date. */
export function parseRetryAfter(
  value: string | null,
  now: number = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.round(seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

export function createTransport(
  config: Pick<ResolvedConfig, "apiKey" | "eventsUrl">,
  logger: Logger,
): Transport {
  return {
    async send(body, count, stop) {
      if (stop?.aborted) return {};

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      timer.unref();
      const onStop = () => controller.abort();
      stop?.addEventListener("abort", onStop, { once: true });

      try {
        const response = await fetch(config.eventsUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": config.apiKey,
            "user-agent": `${SDK_NAME}/${SDK_VERSION}`,
          },
          body,
          signal: controller.signal,
        });
        const text = await response.text().catch(() => "");

        if (response.ok) logger.debug(`sent ${count} event(s)`);
        else
          logger.debug(
            `the API answered ${response.status}: ${text.slice(0, 500)}`,
          );

        return {
          status: response.status,
          retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
        };
      } catch (error) {
        logger.debug(`could not reach the API: ${describeError(error)}`);
        return {};
      } finally {
        clearTimeout(timer);
        stop?.removeEventListener("abort", onStop);
      }
    },
  };
}
