import { Module } from '@nestjs/common';
import { AiQuotaModule } from '../ai-quota/ai-quota.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProjectsModule } from '../projects/projects.module';
import { SourceContextModule } from '../source-context/source-context.module';
import { AiClient } from './ai.client';
import { AnalysisController } from './analysis.controller';
import { AnalysisRepository } from './analysis.repository';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [
    MembershipsModule,
    ProjectsModule,
    SourceContextModule,
    AiQuotaModule,
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisRepository, AiClient],
  // StatsModule asks the same AiClient whether the feature is configured.
  exports: [AiClient],
})
export class AnalysisModule {}
