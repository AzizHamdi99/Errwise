import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { idSchema, setGithubRepoSchema } from '@errwise/shared';
import type {
  GithubConnection,
  GithubInstallUrl,
  GithubRepo,
  SetGithubRepoInput,
} from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgRoles } from '../memberships/decorators/org-roles.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { GithubIntegrationService } from './github-integration.service';

@Controller('organizations/:orgId/projects/:projectId/github')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class GithubController {
  constructor(private readonly integration: GithubIntegrationService) {}

  /** Read-only status, visible to every member. */
  @Get()
  getConnection(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<GithubConnection> {
    return this.integration.getConnection(membership.organizationId, projectId);
  }

  @Post('install-url')
  @OrgRoles('owner')
  @HttpCode(HttpStatus.OK)
  createInstallUrl(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<GithubInstallUrl> {
    return this.integration.createInstallUrl(membership, projectId);
  }

  @Get('repositories')
  @OrgRoles('owner')
  listRepositories(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<GithubRepo[]> {
    return this.integration.listRepositories(
      membership.organizationId,
      projectId,
    );
  }

  @Put('repository')
  @OrgRoles('owner')
  selectRepository(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Body(new ZodValidationPipe(setGithubRepoSchema)) body: SetGithubRepoInput,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<GithubConnection> {
    return this.integration.selectRepository(
      membership.organizationId,
      projectId,
      body.repo,
    );
  }

  @Delete()
  @OrgRoles('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<void> {
    return this.integration.disconnect(membership.organizationId, projectId);
  }
}
