import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { invitationTokenSchema } from '@errwise/shared';
import type {
  InvitationPreview,
  InvitationTokenInput,
  PublicOrganization,
} from '@errwise/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import type { AuthUser } from '../../common/types/auth-user';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  /** Public: lets the accept page show who invited you and to what. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(
    @Body(new ZodValidationPipe(invitationTokenSchema))
    body: InvitationTokenInput,
  ): Promise<InvitationPreview> {
    return this.invitations.preview(body.token);
  }

  @Post('accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  accept(
    @Body(new ZodValidationPipe(invitationTokenSchema))
    body: InvitationTokenInput,
    @CurrentUser() user: AuthUser,
  ): Promise<PublicOrganization> {
    return this.invitations.accept(user.id, body.token);
  }
}
