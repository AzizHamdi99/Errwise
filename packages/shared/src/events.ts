import { z } from "zod";

export const EVENT_LEVELS = ["fatal", "error", "warning", "info"] as const;
export type EventLevel = (typeof EVENT_LEVELS)[number];

export const MAX_BATCH_SIZE = 50;
const MAX_CONTEXT_CHARS = 16_384;

/**
 * There is no projectId here on purpose: the project always comes
 * from the API key. Unknown keys sent by a client are dropped.
 */
export const eventSchema = z.object({
  eventId: z.uuid(),
  type: z.string().trim().min(1).max(200).optional(),
  message: z.string().min(1).max(5_000),
  stack: z.string().max(50_000).optional(),
  level: z.enum(EVENT_LEVELS).default("error"),
  timestamp: z.iso.datetime({ offset: true }).optional(),
  environment: z.string().trim().min(1).max(64).default("production"),
  release: z.string().trim().min(1).max(128).optional(),
  platform: z.string().trim().min(1).max(32).default("node"),
  sdk: z.string().trim().min(1).max(64).optional(),
  context: z
    .record(z.string(), z.unknown())
    .refine((value) => JSON.stringify(value).length <= MAX_CONTEXT_CHARS, {
      message: `context must be at most ${MAX_CONTEXT_CHARS} characters`,
    })
    .optional(),
});

export const eventBatchSchema = z.array(eventSchema).min(1).max(MAX_BATCH_SIZE);

export type EventInput = z.infer<typeof eventSchema>;
/** A single event or a batch. */
export type IngestInput = EventInput | EventInput[];

export interface IngestResult {
  /** Events stored as new. */
  accepted: number;
  /** Events ignored because their eventId was already stored. */
  duplicates: number;
}
