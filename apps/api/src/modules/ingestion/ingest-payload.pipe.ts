import { PipeTransform } from '@nestjs/common';
import { eventBatchSchema, eventSchema } from '@errwise/shared';
import type { IngestInput } from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

/** Accepts one event or an array. Errors point at the exact field, for example "2.message". */
export class IngestPayloadPipe implements PipeTransform<unknown, IngestInput> {
  private readonly single = new ZodValidationPipe(eventSchema);
  private readonly batch = new ZodValidationPipe(eventBatchSchema);

  transform(value: unknown): IngestInput {
    return Array.isArray(value)
      ? this.batch.transform(value)
      : this.single.transform(value);
  }
}
