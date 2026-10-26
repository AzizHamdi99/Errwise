import type { ResolvedConfig } from "./config";
import type { Logger } from "./logger";
import type { ErrwiseEvent } from "./types";
import { describeError } from "./utils";
import { SDK_NAME, SDK_VERSION } from "./version";

const REQUEST_TIMEOUT_MS = 5_000;

export interface SendResult {
  ok: boolean;
  status?: number;
}

export interface Transport {
  send(events: ErrwiseEvent[]): Promise<SendResult>;
}

export function createTransport(
  config: Pick<ResolvedConfig, "apiKey" | "eventsUrl">,
  logger: Logger,
): Transport {
  let warnedUnauthorized = false;

  return {
    async send(events) {
      try {
        const response = await fetch(config.eventsUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": config.apiKey,
            "user-agent": `${SDK_NAME}/${SDK_VERSION}`,
          },
          body: JSON.stringify(events),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        const text = await response.text().catch(() => "");

        if (response.ok) {
          logger.debug(`sent ${events.length} event(s)`);
          return { ok: true, status: response.status };
        }

        if (response.status === 401 && !warnedUnauthorized) {
          warnedUnauthorized = true; // warn once, not for every error
          logger.warn(
            "The API key was rejected (401), so events are not delivered. Check the key and that it was not revoked.",
          );
        } else {
          logger.debug(
            `the API answered ${response.status}: ${text.slice(0, 500)}`,
          );
        }
        return { ok: false, status: response.status };
      } catch (error) {
        logger.debug(`could not reach the API: ${describeError(error)}`);
        return { ok: false };
      }
    },
  };
}
