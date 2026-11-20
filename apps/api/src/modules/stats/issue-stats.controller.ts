import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { idSchema, issueStatsQuerySchema } from '@errwise/shared';
import type { IssueStats, IssueStatsQuery } from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { StatsService } from './stats.service';

@Controller('organizations/:orgId/projects/:projectId/issues/:issueId/stats')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class IssueStatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  get(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Param('issueId', new ZodValidationPipe(idSchema)) issueId: string,
    @Query(new ZodValidationPipe(issueStatsQuerySchema))
    query: IssueStatsQuery,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<IssueStats> {
    return this.stats.issueStats(
      membership.organizationId,
      projectId,
      issueId,
      query.range,
    );
  }
}
