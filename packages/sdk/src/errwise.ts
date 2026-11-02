import { ErrwiseClient } from "./client";
import { resolveConfig } from "./config";
import { Dispatcher } from "./dispatcher";
import { installProcessHooks } from "./handlers";
import { createExpressErrorHandler } from "./integrations/express";
import type {
  ExpressErrorHandler,
  ExpressHandlerOptions,
} from "./integrations/express";
import { createLogger } from "./logger";
import { createTransport } from "./transport";
import type { CaptureOptions, ErrwiseOptions } from "./types";

interface SdkState {
  client?: ErrwiseClient;
  uninstallHooks?: () => void;
}

/**
 * One client per process. The state lives on globalThis because the main entry and
 * the nestjs entry are bundled separately in CommonJS, and a monorepo can also end
 * up with two copies of this package. They must all talk to the same client.
 */
const STATE_KEY = Symbol.for("errwise.node.state");
type StateHolder = typeof globalThis & { [STATE_KEY]?: SdkState };

const state = (): SdkState => ((globalThis as StateHolder)[STATE_KEY] ??= {});

function init(options: ErrwiseOptions): void {
  try {
    const sdk = state();
    const debug =
      typeof options === "object" && options !== null && options.debug === true;
    const logger = createLogger(debug);

    if (sdk.client) {
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
    sdk.client = new ErrwiseClient(config, dispatcher, logger);
    sdk.uninstallHooks = installProcessHooks(sdk.client, {
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
  return state().client?.captureException(error, options);
}

/** Resolves true when everything queued was sent, false if events are still queued after the timeout. */
async function flush(timeoutMs?: number): Promise<boolean> {
  try {
    const { client } = state();
    return client ? await client.flush(timeoutMs) : true;
  } catch {
    return false;
  }
}

async function close(timeoutMs?: number): Promise<void> {
  const sdk = state();
  const current = sdk.client;
  sdk.client = undefined; // allows init() again
  sdk.uninstallHooks?.();
  sdk.uninstallHooks = undefined;
  try {
    await current?.close(timeoutMs);
  } catch {
    /* never throw into the host app */
  }
}

/** Express error middleware. Register it after your routes and before your own error handler. */
function expressErrorHandler(
  options?: ExpressHandlerOptions,
): ExpressErrorHandler {
  return createExpressErrorHandler(captureException, options);
}

export const Errwise = {
  init,
  captureException,
  flush,
  close,
  expressErrorHandler,
} as const;
