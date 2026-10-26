import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { types } from "node:util";
import type { ResolvedConfig } from "./config";
import { EVENT_LEVELS } from "./types";
import type { CaptureOptions, ErrwiseEvent } from "./types";
import { SDK_NAME, SDK_VERSION } from "./version";

/** The same limits as eventSchema in @errwise/shared. */
export const LIMITS = {
  type: 200,
  message: 5_000,
  stack: 50_000,
  context: 16_384,
  environment: 64,
  release: 128,
} as const;

export interface NormalizedError {
  type: string;
  message: string;
  stack?: string;
}

export function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

const asString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value ? value : fallback;

// instanceof alone fails for errors created in another realm (vm, some test runners)
function isError(value: unknown): value is Error {
  return value instanceof Error || types.isNativeError(value);
}

function describeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    try {
      const json: string | undefined = JSON.stringify(value);
      return json ?? Object.prototype.toString.call(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
  return String(value);
}

export function normalizeError(input: unknown): NormalizedError {
  if (isError(input)) {
    const type = asString(input.name, "Error");
    return {
      type,
      message: asString(input.message, type),
      stack: typeof input.stack === "string" ? input.stack : undefined,
    };
  }
  return {
    type: "Error",
    message: `Non-Error thrown: ${describeValue(input)}`,
  };
}

/** JSON round-trip: drops functions, turns bigint into text, fails on circular structures. */
function toJsonSafe(value: unknown): unknown {
  try {
    const json = JSON.stringify(value, (_key, v: unknown) =>
      typeof v === "bigint" ? v.toString() : v,
    ) as string | undefined;
    return json === undefined ? undefined : (JSON.parse(json) as unknown);
  } catch {
    return undefined;
  }
}

function buildContext(
  extra: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const context: Record<string, unknown> = {
    nodeVersion: process.version,
    os: process.platform,
    hostname: hostname(),
  };
  if (extra === undefined) return context;

  const safeExtra = toJsonSafe(extra);
  if (safeExtra === undefined)
    return { ...context, extraDropped: "not serializable" };

  const withExtra = { ...context, extra: safeExtra };
  return JSON.stringify(withExtra).length <= LIMITS.context
    ? withExtra
    : { ...context, extraDropped: "too large" };
}

function fitContext(context: unknown): Record<string, unknown> | undefined {
  if (
    typeof context !== "object" ||
    context === null ||
    Array.isArray(context)
  ) {
    return undefined;
  }
  try {
    if (JSON.stringify(context).length <= LIMITS.context) {
      return context as Record<string, unknown>;
    }
  } catch {
    /* not serializable: fall through */
  }
  return { contextDropped: "too large or not serializable" };
}

/** Clamps every field to what the API accepts. Also runs again after beforeSend. */
export function enforceLimits(event: ErrwiseEvent): ErrwiseEvent {
  const type = truncate(asString(event.type, "Error"), LIMITS.type);
  const release = asString(event.release, "");

  return {
    ...event,
    type,
    message: truncate(asString(event.message, ""), LIMITS.message) || type,
    stack:
      typeof event.stack === "string"
        ? truncate(event.stack, LIMITS.stack)
        : undefined,
    level: EVENT_LEVELS.includes(event.level) ? event.level : "error",
    environment: truncate(
      asString(event.environment, "production"),
      LIMITS.environment,
    ),
    release: release ? truncate(release, LIMITS.release) : undefined,
    context: fitContext(event.context),
  };
}

export function buildEvent(
  input: unknown,
  config: ResolvedConfig,
  options: CaptureOptions = {},
  now: Date = new Date(),
): ErrwiseEvent {
  const error = normalizeError(input);
  return enforceLimits({
    eventId: randomUUID(),
    type: error.type,
    message: error.message,
    stack: error.stack,
    level: options.level ?? "error",
    timestamp: now.toISOString(),
    environment: config.environment,
    release: config.release,
    platform: "node",
    sdk: `${SDK_NAME}/${SDK_VERSION}`,
    context: buildContext(options.extra),
  });
}
