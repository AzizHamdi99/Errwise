import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { IngestRateLimitGuard } from './ingest-rate-limit.guard';
import { IngestionController } from './ingestion.controller';
import { IngestionRepository } from './ingestion.repository';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [ApiKeysModule],
  controllers: [IngestionController],
  providers: [IngestionService, IngestionRepository, IngestRateLimitGuard],
})
export class IngestionModule {}
