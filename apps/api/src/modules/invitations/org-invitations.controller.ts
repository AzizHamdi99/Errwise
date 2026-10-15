import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { createInvitationSchema, idSchema } from '@errwise/shared';
import type { CreateInvitationInput, PublicInvitation } from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgRoles } from '../memberships/decorators/org-roles.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { InvitationsService } from './invitations.service';

@Controller('organizations/:orgId/invitations')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
@OrgRoles('owner', 'admin')
export class OrgInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createInvitationSchema))
    body: CreateInvitationInput,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicInvitation> {
    return this.invitations.create(membership, body);
  }

  @Get()
  list(
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicInvitation[]> {
    return this.invitations.list(membership.organizationId);
  }

  @Post(':invitationId/resend')
  @HttpCode(HttpStatus.OK)
  resend(
    @Param('invitationId', new ZodValidationPipe(idSchema))
    invitationId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicInvitation> {
    return this.invitations.resend(membership, invitationId);
  }

  @Delete(':invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @Param('invitationId', new ZodValidationPipe(idSchema))
    invitationId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<void> {
    return this.invitations.revoke(membership, invitationId);
  }
}
