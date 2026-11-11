import { z } from "zod";

/** Every message on the queue has this shape. */
export function envelopeSchema<T extends string, D extends z.ZodType>(
  type: T,
  data: D,
) {
  return z.object({
    id: z.uuid(), // unique per message: idempotency and tracing
    type: z.literal(type), // same value as the routing key
    version: z.literal(1), // bump when the payload changes in a breaking way
    occurredAt: z.iso.datetime({ offset: true }),
    data,
  });
}
