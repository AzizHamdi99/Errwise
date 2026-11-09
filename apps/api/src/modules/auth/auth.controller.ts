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
import { loginSchema, registerSchema } from '@errwise/shared';
import type { LoginInput, PublicUser, RegisterInput } from '@errwise/shared';
import { REFRESH_COOKIE } from '../../common/constants';
import { Client } from '../../common/decorators/client-meta.decorator';
import type { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthCookieService } from './auth-cookie.service';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import type { GoogleProfile } from './google.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
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

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Client() meta: ClientMeta,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const { accessToken, refreshToken, user } = await this.auth.register(
      body,
      meta,
    );
    this.cookies.setSession(res, accessToken, refreshToken);
    return { user };
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
