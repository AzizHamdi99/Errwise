import { ErrwiseClient } from "./client";
import { resolveConfig } from "./config";
import { Dispatcher } from "./dispatcher";
import { installProcessHooks } from "./handlers";
import { createLogger } from "./logger";
import { createTransport } from "./transport";
import type { CaptureOptions, ErrwiseOptions } from "./types";

let client: ErrwiseClient | undefined;
let uninstallHooks: (() => void) | undefined;

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

    const dispatcher = new Dispatcher(createTransport(config, logger), logger);
    client = new ErrwiseClient(config, dispatcher, logger);
    uninstallHooks = installProcessHooks(client, {
      captureUncaughtErrors: config.captureUncaughtErrors,
    });
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

/** Resolves true when everything queued was sent, false if events are still queued after the timeout. */
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
  uninstallHooks?.();
  uninstallHooks = undefined;
  try {
    await current?.close(timeoutMs);
  } catch {
    /* never throw into the host app */
  }
}

export const Errwise = { init, captureException, flush, close } as const;
