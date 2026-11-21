import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  Get,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from '@errwise/shared';
import type {
  LoginInput,
  PublicUser,
  RegisterInput,
  RegisterResult,
  ResendVerificationInput,
  VerifyEmailInput,
} from '@errwise/shared';
import { REFRESH_COOKIE } from '../../common/constants';
import { Client } from '../../common/decorators/client-meta.decorator';
import type { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  RateLimit,
  RateLimitGuard,
} from '../../common/security/rate-limit.guard';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import type { GoogleProfile } from './google.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly cookies: AuthCookieService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Starts the flow: Passport redirects the browser to Google. */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleStart(): void {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req() req: Request & { user?: GoogleProfile | false },
    @Client() meta: ClientMeta,
    @Res() res: Response,
  ): Promise<void> {
    const webUrl = this.config.get('WEB_URL', { infer: true });
    if (!req.user) {
      res.redirect(`${webUrl}/login?error=google`);
      return;
    }
    try {
      const { accessToken, refreshToken } = await this.auth.googleLogin(
        req.user,
        meta,
      );
      this.cookies.setSession(res, accessToken, refreshToken);
      res.redirect(`${webUrl}/organizations`);
    } catch {
      res.redirect(`${webUrl}/login?error=google`);
    }
  }

  // Each call sends an email to the address typed in, so it is limited like the other public
  // routes of this flow.
  @Post('register')
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 600)
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<RegisterResult> {
    return this.auth.register(body);
  }

  // A POST (the web page sends it), so a mail scanner that only opens the link cannot use it up.
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RateLimitGuard)
  @RateLimit(20, 600)
  verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) body: VerifyEmailInput,
  ): Promise<void> {
    return this.emailVerification.verify(body.token);
  }

  // Always the same answer, whether or not the email has an account waiting for a link.
  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RateLimitGuard)
  @RateLimit(10, 600)
  resendVerification(
    @Body(new ZodValidationPipe(resendVerificationSchema))
    body: ResendVerificationInput,
  ): Promise<void> {
    return this.emailVerification.resend(body.email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Client() meta: ClientMeta,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const { accessToken, refreshToken, user } = await this.auth.login(
      body,
      meta,
    );
    this.cookies.setSession(res, accessToken, refreshToken);
    return { user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Client() meta: ClientMeta,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) throw new UnauthorizedException('Missing refresh token');

    try {
      const { accessToken, refreshToken, user } = await this.auth.refresh(
        raw,
        meta,
      );
      this.cookies.setSession(res, accessToken, refreshToken);
      return { user };
    } catch (e) {
      this.cookies.clear(res);
      throw e;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    this.cookies.clear(res);
  }
}
