import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createProjectSchema,
  idSchema,
  updateProjectSchema,
} from '@errwise/shared';
import type {
  CreateProjectInput,
  PublicProject,
  UpdateProjectInput,
} from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgRoles } from '../memberships/decorators/org-roles.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { ProjectsService } from './projects.service';

@Controller('organizations/:orgId/projects')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @OrgRoles('owner')
  create(
    @Body(new ZodValidationPipe(createProjectSchema))
    body: CreateProjectInput,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicProject> {
    return this.projects.create(membership.organizationId, body);
  }

  @Get()
  list(
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicProject[]> {
    return this.projects.list(membership.organizationId);
  }

  @Get(':projectId')
  get(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicProject> {
    return this.projects.get(membership.organizationId, projectId);
  }

  @Patch(':projectId')
  @OrgRoles('owner')
  update(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Body(new ZodValidationPipe(updateProjectSchema))
    body: UpdateProjectInput,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicProject> {
    return this.projects.update(membership.organizationId, projectId, body);
  }

  @Delete(':projectId')
  @OrgRoles('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<void> {
    return this.projects.remove(membership.organizationId, projectId);
  }
}
