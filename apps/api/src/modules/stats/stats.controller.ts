import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  idSchema,
  projectOverviewQuerySchema,
  releasesQuerySchema,
} from '@errwise/shared';
import type {
  ProjectOverview,
  ProjectOverviewQuery,
  ReleasesOverview,
  ReleasesQuery,
} from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { StatsService } from './stats.service';

@Controller('organizations/:orgId/projects/:projectId/stats')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  overview(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Query(new ZodValidationPipe(projectOverviewQuerySchema))
    query: ProjectOverviewQuery,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<ProjectOverview> {
    return this.stats.projectOverview(
      membership.organizationId,
      projectId,
      query.range,
    );
  }

  @Get('releases')
  releases(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Query(new ZodValidationPipe(releasesQuerySchema)) query: ReleasesQuery,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<ReleasesOverview> {
    return this.stats.releases(
      membership.organizationId,
      projectId,
      query.range,
    );
  }
}
