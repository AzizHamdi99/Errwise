import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { IngestInput, IngestResult } from '@errwise/shared';
import type { ApiKeyContext } from '../api-keys/api-key.types';
import { CurrentApiKey } from '../api-keys/decorators/current-api-key.decorator';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard';
import { IngestPayloadPipe } from './ingest-payload.pipe';
import { IngestRateLimitGuard } from './ingest-rate-limit.guard';
import { IngestionService } from './ingestion.service';

// No "v1" here: the global default version adds it, giving /v1/events.
@Controller('events')
@UseGuards(ApiKeyGuard, IngestRateLimitGuard)
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  ingest(
    @Body(new IngestPayloadPipe()) body: IngestInput,
    @CurrentApiKey() apiKey: ApiKeyContext,
  ): Promise<IngestResult> {
    return this.ingestion.ingest(apiKey, body);
  }
}
