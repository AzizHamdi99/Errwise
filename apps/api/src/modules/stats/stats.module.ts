import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProjectsModule } from '../projects/projects.module';
import { StatsController } from './stats.controller';
import { StatsRepository } from './stats.repository';
import { StatsService } from './stats.service';

@Module({
  imports: [MembershipsModule, ProjectsModule],
  controllers: [StatsController],
  providers: [StatsService, StatsRepository],
})
export class StatsModule {}
