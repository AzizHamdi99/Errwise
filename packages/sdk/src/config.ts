import type { ErrwiseEvent, ErrwiseOptions } from "./types";

// The same pattern the API enforces. Update both if the key format changes.
const API_KEY_PATTERN = /^ew_live_[A-Za-z0-9]{32}$/;
const MAX_ENVIRONMENT = 64;
const MAX_RELEASE = 128;

export interface ResolvedConfig {
  apiKey: string;
  eventsUrl: string;
  environment: string;
  release: string | undefined;
  enabled: boolean;
  debug: boolean;
  beforeSend: ((event: ErrwiseEvent) => ErrwiseEvent | null) | undefined;
}

export type ConfigResult =
  { ok: true; config: ResolvedConfig } | { ok: false; reason: string };

function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** "http://host:4000/" -> "http://host:4000/v1/events". The API version lives in the SDK. */
function buildEventsUrl(endpoint: unknown): string | undefined {
  if (typeof endpoint !== "string") return undefined;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}/v1/events`;
  } catch {
    return undefined;
  }
}

export function resolveConfig(options: ErrwiseOptions): ConfigResult {
  if (typeof options !== "object" || options === null) {
    return { ok: false, reason: "init() needs an options object." };
  }
  // never echo the key itself in a message
  if (
    typeof options.apiKey !== "string" ||
    !API_KEY_PATTERN.test(options.apiKey)
  ) {
    return {
      ok: false,
      reason:
        "apiKey is missing or malformed (expected ew_live_ followed by 32 characters).",
    };
  }
  const eventsUrl = buildEventsUrl(options.endpoint);
  if (!eventsUrl) {
    return {
      ok: false,
      reason:
        "endpoint must be the URL of your Errwise API, for example http://localhost:4000.",
    };
  }

  return {
    ok: true,
    config: {
      apiKey: options.apiKey,
      eventsUrl,
      environment:
        clean(options.environment, MAX_ENVIRONMENT) ??
        clean(process.env.NODE_ENV, MAX_ENVIRONMENT) ??
        "production",
      release:
        clean(options.release, MAX_RELEASE) ??
        clean(process.env.ERRWISE_RELEASE, MAX_RELEASE),
      enabled: options.enabled !== false,
      debug: options.debug === true,
      beforeSend:
        typeof options.beforeSend === "function"
          ? options.beforeSend
          : undefined,
    },
  };
}
