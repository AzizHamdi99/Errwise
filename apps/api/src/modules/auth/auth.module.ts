import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthCookieService } from './auth-cookie.service';
import { AuthController } from './auth.controller';
import { EmailVerificationRepository } from './email-verification.repository';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetRepository } from './password-reset.repository';
import { PasswordResetService } from './password-reset.service';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { RefreshTokenService } from './refresh-token.service';
import { GoogleStrategy } from './google.strategy';
import { GoogleAuthService } from './google-auth.service';

@Module({
  imports: [UsersModule, MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookieService,
    RefreshTokenService,
    RefreshTokenRepository,
    GoogleStrategy,
    GoogleAuthService,
    EmailVerificationService,
    EmailVerificationRepository,
    PasswordResetService,
    PasswordResetRepository,
  ],
})
export class AuthModule {}
