import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { idSchema } from '@errwise/shared';
import type { GithubIssueLink } from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { GithubIssueService } from './github-issue.service';

@Controller('organizations/:orgId/projects/:projectId/issues/:issueId/github')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class GithubIssuesController {
  constructor(private readonly issues: GithubIssueService) {}

  /** Any member can call it. Returns the existing link if the issue was already created. */
  @Post()
  @HttpCode(HttpStatus.OK)
  create(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Param('issueId', new ZodValidationPipe(idSchema)) issueId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<GithubIssueLink> {
    return this.issues.createForIssue(
      membership.organizationId,
      projectId,
      issueId,
    );
  }
}
