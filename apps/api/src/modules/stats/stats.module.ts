import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProjectsModule } from '../projects/projects.module';
import { IssueStatsController } from './issue-stats.controller';
import { OrgStatsController } from './org-stats.controller';
import { StatsController } from './stats.controller';
import { StatsRepository } from './stats.repository';
import { StatsService } from './stats.service';
import { UsageService } from './usage.service';

@Module({
  imports: [MembershipsModule, ProjectsModule, AnalysisModule],
  controllers: [StatsController, OrgStatsController, IssueStatsController],
  providers: [StatsService, UsageService, StatsRepository],
})
export class StatsModule {}
