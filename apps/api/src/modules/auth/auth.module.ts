import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthCookieService } from './auth-cookie.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { RefreshTokenService } from './refresh-token.service';
import { GoogleStrategy } from './google.strategy';
import { GoogleAuthService } from './google-auth.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookieService,
    RefreshTokenService,
    RefreshTokenRepository,
    GoogleStrategy,
    GoogleAuthService,
  ],
})
export class AuthModule {}
