import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { idSchema, updateMemberRoleSchema } from '@errwise/shared';
import type { PublicMember, UpdateMemberRoleInput } from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from './decorators/current-membership.decorator';
import { OrgRoles } from './decorators/org-roles.decorator';
import { OrgMemberGuard } from './guards/org-member.guard';
import { MembershipsService } from './memberships.service';
import type { OrgMembership } from './memberships.types';

@Controller('organizations/:orgId/members')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  list(
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicMember[]> {
    return this.memberships.list(membership.organizationId);
  }

  @Patch(':userId')
  @OrgRoles('owner')
  changeRole(
    @Param('userId', new ZodValidationPipe(idSchema)) userId: string,
    @Body(new ZodValidationPipe(updateMemberRoleSchema))
    body: UpdateMemberRoleInput,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicMember> {
    return this.memberships.changeRole(
      membership.organizationId,
      userId,
      body.role,
    );
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('userId', new ZodValidationPipe(idSchema)) userId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<void> {
    return this.memberships.remove(membership, userId);
  }
}
