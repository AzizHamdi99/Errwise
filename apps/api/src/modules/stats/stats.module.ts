import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProjectsModule } from '../projects/projects.module';
import { IssueStatsController } from './issue-stats.controller';
import { OrgStatsController } from './org-stats.controller';
import { StatsController } from './stats.controller';
import { StatsRepository } from './stats.repository';
import { StatsService } from './stats.service';

@Module({
  imports: [MembershipsModule, ProjectsModule],
  controllers: [StatsController, OrgStatsController, IssueStatsController],
  providers: [StatsService, StatsRepository],
})
export class StatsModule {}
