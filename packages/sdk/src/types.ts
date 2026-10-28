export const EVENT_LEVELS = ["fatal", "error", "warning", "info"] as const;
export type EventLevel = (typeof EVENT_LEVELS)[number];

/** The payload sent to POST /v1/events. Keep in sync with eventSchema in @errwise/shared. */
export interface ErrwiseEvent {
  eventId: string;
  type: string;
  message: string;
  stack?: string;
  level: EventLevel;
  timestamp: string;
  environment: string;
  release?: string;
  platform: string;
  sdk: string;
  context?: Record<string, unknown>;
}

export interface CaptureOptions {
  level?: EventLevel;
  /** Extra data shown in the issue's context. Must be JSON-serializable. */
  extra?: Record<string, unknown>;
}

export interface ErrwiseOptions {
  /** Your project key: ew_live_... */
  apiKey: string;
  /** Base URL of the Errwise API, for example http://localhost:4000 */
  endpoint: string;
  /** Defaults to NODE_ENV, or "production". */
  environment?: string;
  /** Defaults to the ERRWISE_RELEASE environment variable. */
  release?: string;
  /** Set to false to turn the SDK off (tests, local development). */
  enabled?: boolean;
  /**
   * Scrub or drop an event before it is sent. Must be synchronous.
   * Return the event, or null to drop it. If it throws, the event is dropped.
   */
  beforeSend?: (event: ErrwiseEvent) => ErrwiseEvent | null;
  /** Print what the SDK is doing. */
  debug?: boolean;
  /**
   * Capture uncaught exceptions and unhandled promise rejections.
   * The SDK only takes over the crash when the app has no handler of its own:
   * it sends the event, then exits with code 1, like Node does. Default: true.
   */
  captureUncaughtErrors?: boolean;
}
