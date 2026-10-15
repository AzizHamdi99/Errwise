import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
} from '../../common/constants';
import type { Env } from '../../config/env';

@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private base(path: string): CookieOptions {
    const isProd =
      this.config.get('NODE_ENV', { infer: true }) === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      // web and API are on different domains in production
      sameSite: isProd ? 'none' : 'lax',
      path,
    };
  }

  setSession(res: Response, accessToken: string, refreshToken: string): void {
    const accessSeconds = this.config.get('ACCESS_TOKEN_TTL_SECONDS', {
      infer: true,
    });
    const refreshDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', {
      infer: true,
    });

    res.cookie(ACCESS_COOKIE, accessToken, {
      ...this.base('/'),
      maxAge: accessSeconds * 1000,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.base(REFRESH_COOKIE_PATH),
      maxAge: refreshDays * 86_400_000,
    });
  }

  clear(res: Response): void {
    // clearCookie needs the same path (and flags) the cookie was set with
    res.clearCookie(ACCESS_COOKIE, this.base('/'));
    res.clearCookie(REFRESH_COOKIE, this.base(REFRESH_COOKIE_PATH));
  }
}
