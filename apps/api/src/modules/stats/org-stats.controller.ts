import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { orgOverviewQuerySchema } from '@errwise/shared';
import type { OrgOverview, OrgOverviewQuery } from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { StatsService } from './stats.service';

@Controller('organizations/:orgId/stats')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class OrgStatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  overview(
    @Query(new ZodValidationPipe(orgOverviewQuerySchema))
    query: OrgOverviewQuery,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<OrgOverview> {
    return this.stats.orgOverview(membership.organizationId, query.range);
  }
}
