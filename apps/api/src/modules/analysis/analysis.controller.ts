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
import type { PublicIssueAnalysis } from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { AnalysisService } from './analysis.service';

@Controller('organizations/:orgId/projects/:projectId/issues/:issueId/analysis')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Get()
  get(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Param('issueId', new ZodValidationPipe(idSchema)) issueId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicIssueAnalysis> {
    return this.analysis.get(membership.organizationId, projectId, issueId);
  }

  // Any member can ask: the cost is bounded by the organization's daily allowance.
  @Post()
  @HttpCode(HttpStatus.OK)
  analyze(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Param('issueId', new ZodValidationPipe(idSchema)) issueId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicIssueAnalysis> {
    return this.analysis.analyze(membership.organizationId, projectId, issueId);
  }
}
