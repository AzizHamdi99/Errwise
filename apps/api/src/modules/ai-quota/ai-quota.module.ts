import { Module } from '@nestjs/common';
import { AiQuotaRepository } from './ai-quota.repository';
import { AiQuotaService } from './ai-quota.service';

@Module({
  providers: [AiQuotaService, AiQuotaRepository],
  exports: [AiQuotaService],
})
export class AiQuotaModule {}
