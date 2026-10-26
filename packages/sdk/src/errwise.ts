import { ErrwiseClient } from "./client";
import { resolveConfig } from "./config";
import { createLogger } from "./logger";
import { createTransport } from "./transport";
import type { CaptureOptions, ErrwiseOptions } from "./types";

let client: ErrwiseClient | undefined;

function init(options: ErrwiseOptions): void {
  try {
    const debug =
      typeof options === "object" && options !== null && options.debug === true;
    const logger = createLogger(debug);

    if (client) {
      logger.warn(
        "init() was already called. Call close() first to initialize again.",
      );
      return;
    }

    const resolved = resolveConfig(options);
    if (!resolved.ok) {
      logger.warn(`Not initialized: ${resolved.reason}`);
      return;
    }
    const { config } = resolved;
    if (!config.enabled) {
      logger.debug("disabled (enabled: false)");
      return;
    }

    client = new ErrwiseClient(config, createTransport(config, logger), logger);
    logger.debug(
      `initialized (environment: ${config.environment}, release: ${config.release ?? "none"})`,
    );
  } catch {
    /* never throw into the host app */
  }
}

function captureException(
  error: unknown,
  options?: CaptureOptions,
): string | undefined {
  return client?.captureException(error, options);
}

async function flush(timeoutMs?: number): Promise<boolean> {
  try {
    return client ? await client.flush(timeoutMs) : true;
  } catch {
    return false;
  }
}

async function close(timeoutMs?: number): Promise<void> {
  const current = client;
  client = undefined; // allows init() again
  try {
    await current?.close(timeoutMs);
  } catch {
    /* never throw into the host app */
  }
}

export const Errwise = { init, captureException, flush, close } as const;
