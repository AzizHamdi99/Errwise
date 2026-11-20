import { Controller, Get, UseGuards } from '@nestjs/common';
import type { PublicSubscription } from '@errwise/shared';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { SubscriptionsService } from './subscriptions.service';

@Controller('organizations/:orgId/subscriptions')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class OrgSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  /** My subscriptions across the organization's projects, in one request. */
  @Get()
  listMine(
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicSubscription[]> {
    return this.subscriptions.listMine(
      membership.organizationId,
      membership.userId,
    );
  }
}
