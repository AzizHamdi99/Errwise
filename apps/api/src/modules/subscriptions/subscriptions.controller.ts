import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { idSchema, updateSubscriptionSchema } from '@errwise/shared';
import type {
  PublicSubscription,
  UpdateSubscriptionInput,
} from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { SubscriptionsService } from './subscriptions.service';

@Controller('organizations/:orgId/projects/:projectId/subscription')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  get(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicSubscription> {
    return this.subscriptions.get(
      membership.organizationId,
      projectId,
      membership.userId,
    );
  }

  // Any member can manage their own subscription (no @OrgRoles).
  @Put()
  update(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Body(new ZodValidationPipe(updateSubscriptionSchema))
    body: UpdateSubscriptionInput,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicSubscription> {
    return this.subscriptions.update(
      membership.organizationId,
      projectId,
      membership.userId,
      body.emailNewIssues,
    );
  }
}
