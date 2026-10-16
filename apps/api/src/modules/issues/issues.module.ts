import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProjectsModule } from '../projects/projects.module';
import { IssuesController } from './issues.controller';
import { IssuesRepository } from './issues.repository';
import { IssuesService } from './issues.service';

@Module({
  imports: [MembershipsModule, ProjectsModule],
  controllers: [IssuesController],
  providers: [IssuesService, IssuesRepository],
})
export class IssuesModule {}
