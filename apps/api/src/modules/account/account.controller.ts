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
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  changePasswordSchema,
  idSchema,
  updateProfileSchema,
} from '@errwise/shared';
import type {
  ChangePasswordInput,
  PublicSession,
  PublicUser,
  UpdateProfileInput,
} from '@errwise/shared';
import { REFRESH_COOKIE } from '../../common/constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import {
  RateLimit,
  RateLimitGuard,
} from '../../common/security/rate-limit.guard';
import type { AuthUser } from '../../common/types/auth-user';
import { SessionsService } from '../auth/sessions.service';
import { AccountService } from './account.service';

/** The signed-in user's own account. Everything is scoped by the user id of the access token. */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly sessions: SessionsService,
  ) {}

  @Patch()
  updateProfile(
    @CurrentUser() auth: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<PublicUser> {
    return this.account.updateName(auth.id, body.name);
  }

  // Limits guessing the current password with a stolen access token.
  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RateLimitGuard)
  @RateLimit(5, 600)
  changePassword(
    @CurrentUser() auth: AuthUser,
    @Body(new ZodValidationPipe(changePasswordSchema))
    body: ChangePasswordInput,
    @Req() req: Request,
  ): Promise<void> {
    return this.account.changePassword(auth.id, body, refreshCookie(req));
  }

  @Get('sessions')
  listSessions(
    @CurrentUser() auth: AuthUser,
    @Req() req: Request,
  ): Promise<PublicSession[]> {
    return this.sessions.list(auth.id, refreshCookie(req));
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeOtherSessions(
    @CurrentUser() auth: AuthUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.sessions.revokeOthers(auth.id, refreshCookie(req));
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeSession(
    @CurrentUser() auth: AuthUser,
    @Param('sessionId', new ZodValidationPipe(idSchema)) sessionId: string,
  ): Promise<void> {
    return this.sessions.revoke(auth.id, sessionId);
  }
}

function refreshCookie(req: Request): string | undefined {
  return req.cookies?.[REFRESH_COOKIE] as string | undefined;
}
