import { Module } from '@nestjs/common';
import { AiQuotaModule } from '../ai-quota/ai-quota.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { GithubModule } from '../github/github.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { SourceContextModule } from '../source-context/source-context.module';
import { FixPullRequestService } from './fix-pull-request.service';
import { FixesController } from './fixes.controller';
import { FixesRepository } from './fixes.repository';
import { FixesService } from './fixes.service';

@Module({
  // AnalysisModule exports the AiClient: there is one door to apps/ai.
  imports: [
    MembershipsModule,
    GithubModule,
    SourceContextModule,
    AnalysisModule,
    AiQuotaModule,
  ],
  controllers: [FixesController],
  providers: [FixesService, FixPullRequestService, FixesRepository],
})
export class FixesModule {}
