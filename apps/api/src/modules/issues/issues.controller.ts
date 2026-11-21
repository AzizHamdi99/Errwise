import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  bulkUpdateIssuesSchema,
  idSchema,
  listIssuesQuerySchema,
  updateIssueSchema,
} from '@errwise/shared';
import type {
  BulkUpdateIssuesInput,
  BulkUpdateIssuesResult,
  IssueDetail,
  IssueFacets,
  IssueListItem,
  ListIssuesQuery,
  Paginated,
  PublicIssue,
  UpdateIssueInput,
} from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { IssuesService } from './issues.service';

@Controller('organizations/:orgId/projects/:projectId/issues')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Get()
  list(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Query(new ZodValidationPipe(listIssuesQuerySchema)) query: ListIssuesQuery,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<Paginated<IssueListItem>> {
    return this.issues.list(membership.organizationId, projectId, query);
  }

  // Declared before ':issueId', or "facets" would be read as an issue id.
  @Get('facets')
  facets(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<IssueFacets> {
    return this.issues.facets(membership.organizationId, projectId);
  }

  @Get(':issueId')
  get(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Param('issueId', new ZodValidationPipe(idSchema)) issueId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<IssueDetail> {
    return this.issues.get(membership.organizationId, projectId, issueId);
  }

  // Any member can change statuses, one or many: it is daily work, not administration.
  @Patch()
  bulkUpdateStatus(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Body(new ZodValidationPipe(bulkUpdateIssuesSchema))
    body: BulkUpdateIssuesInput,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<BulkUpdateIssuesResult> {
    return this.issues.bulkUpdateStatus(
      membership.organizationId,
      projectId,
      body,
    );
  }

  @Patch(':issueId')
  updateStatus(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Param('issueId', new ZodValidationPipe(idSchema)) issueId: string,
    @Body(new ZodValidationPipe(updateIssueSchema)) body: UpdateIssueInput,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicIssue> {
    return this.issues.updateStatus(
      membership.organizationId,
      projectId,
      issueId,
      body,
    );
  }
}
