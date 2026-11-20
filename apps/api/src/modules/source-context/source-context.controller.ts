import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { idSchema } from '@errwise/shared';
import type { SourceContextResult } from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { SourceContextService } from './source-context.service';

@Controller(
  'organizations/:orgId/projects/:projectId/issues/:issueId/events/:eventId/source',
)
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class SourceContextController {
  constructor(private readonly sourceContext: SourceContextService) {}

  // Any member can read it: the owner's switch is the consent for the whole project.
  @Get()
  get(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Param('issueId', new ZodValidationPipe(idSchema)) issueId: string,
    @Param('eventId', new ZodValidationPipe(idSchema)) eventId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<SourceContextResult> {
    return this.sourceContext.get(
      membership.organizationId,
      projectId,
      issueId,
      eventId,
    );
  }
}
