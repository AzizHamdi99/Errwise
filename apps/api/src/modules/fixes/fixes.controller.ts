import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { idSchema } from '@errwise/shared';
import type { PublicIssueFix } from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgRoles } from '../memberships/decorators/org-roles.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { FixPullRequestService } from './fix-pull-request.service';
import { FixesService } from './fixes.service';

@Controller('organizations/:orgId/projects/:projectId/issues/:issueId/fix')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class FixesController {
  constructor(
    private readonly fixes: FixesService,
    private readonly pullRequests: FixPullRequestService,
  ) {}

  @Get()
  get(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Param('issueId', new ZodValidationPipe(idSchema)) issueId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicIssueFix> {
    return this.fixes.get(membership.organizationId, projectId, issueId);
  }

  // Any member can ask for a suggestion, like for an analysis: it only costs a slot of the
  // organization's daily allowance, and it writes nothing. Opening a pull request does not
  // work like that (see the pull request route).
  @Post()
  @HttpCode(HttpStatus.OK)
  suggest(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Param('issueId', new ZodValidationPipe(idSchema)) issueId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicIssueFix> {
    return this.fixes.suggest(membership.organizationId, projectId, issueId);
  }

  /**
   * Opens a draft pull request with the stored fix. Owners and admins only: it pushes a
   * branch, so the customer's CI runs code that an AI wrote, and someone who can answer for
   * that must have read the diff first. Nothing is taken from the request body: the change
   * is the one stored in the database. Calling it again returns the same pull request.
   */
  @Post(':fixId/pull-request')
  @OrgRoles('owner', 'admin')
  @HttpCode(HttpStatus.OK)
  openPullRequest(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Param('issueId', new ZodValidationPipe(idSchema)) issueId: string,
    @Param('fixId', new ZodValidationPipe(idSchema)) fixId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicIssueFix> {
    return this.pullRequests.open(membership, projectId, issueId, fixId);
  }
}
