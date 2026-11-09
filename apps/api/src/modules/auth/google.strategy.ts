import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import type { Env } from '../../config/env';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService<Env, true>) {
    super({
      // placeholders keep the app booting when Google is not configured
      clientID: config.get('GOOGLE_CLIENT_ID', { infer: true }) ?? 'not-set',
      clientSecret:
        config.get('GOOGLE_CLIENT_SECRET', { infer: true }) ?? 'not-set',
      callbackURL:
        config.get('GOOGLE_CALLBACK_URL', { infer: true }) ??
        'http://localhost:4000/v1/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GoogleProfile {
    const email = profile.emails?.[0]?.value;
    const verified =
      (profile._json as { email_verified?: boolean }).email_verified === true;
    if (!email || !verified) {
      throw new UnauthorizedException('Google email is not verified');
    }
    return {
      googleId: profile.id,
      email: email.toLowerCase(),
      name: profile.displayName || null,
    };
  }
}
