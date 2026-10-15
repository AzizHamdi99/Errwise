import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from '@errwise/shared';
import type {
  CreateOrganizationInput,
  PublicOrganization,
  UpdateOrganizationInput,
} from '@errwise/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import type { AuthUser } from '../../common/types/auth-user';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgRoles } from '../memberships/decorators/org-roles.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createOrganizationSchema))
    body: CreateOrganizationInput,
    @CurrentUser() user: AuthUser,
  ): Promise<PublicOrganization> {
    return this.organizations.create(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<PublicOrganization[]> {
    return this.organizations.listForUser(user.id);
  }

  @Get(':orgId')
  @UseGuards(OrgMemberGuard)
  get(
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicOrganization> {
    return this.organizations.getById(
      membership.organizationId,
      membership.role,
    );
  }

  @Patch(':orgId')
  @UseGuards(OrgMemberGuard)
  @OrgRoles('owner', 'admin')
  update(
    @Body(new ZodValidationPipe(updateOrganizationSchema))
    body: UpdateOrganizationInput,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicOrganization> {
    return this.organizations.update(
      membership.organizationId,
      membership.role,
      body,
    );
  }

  @Delete(':orgId')
  @UseGuards(OrgMemberGuard)
  @OrgRoles('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentMembership() membership: OrgMembership): Promise<void> {
    return this.organizations.remove(membership.organizationId);
  }
}
