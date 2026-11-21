import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { EMAIL_NOT_VERIFIED } from '@errwise/shared';
import type {
  LoginInput,
  PublicUser,
  RegisterInput,
  RegisterResult,
} from '@errwise/shared';
import type { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { PasswordHasher } from '../../common/security/password-hasher.service';
import { TokenService } from '../../common/security/token.service';
import { toPublicUser } from '../users/users.mapper';
import { EmailVerificationService } from './email-verification.service';
import { UsersService } from '../users/users.service';
import type { GoogleProfile } from './google.strategy';
import { RefreshTokenService } from './refresh-token.service';
import { GoogleAuthService } from './google-auth.service';

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly google: GoogleAuthService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  /**
   * Creates the account and mails the verification link. It does NOT sign anyone in: the address
   * is not proven yet, and login refuses the account until the link is opened.
   */
  async register(input: RegisterInput): Promise<RegisterResult> {
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });
    const verificationEmailSent = await this.emailVerification.send(user);
    return { email: user.email, verificationEmailSent };
  }

  async login(input: LoginInput, meta: ClientMeta): Promise<Session> {
    const user = await this.users.findByEmail(input.email);
    const valid = await this.hasher.verify(
      user?.passwordHash ?? null,
      input.password,
    );
    if (!user || !valid)
      throw new UnauthorizedException('Invalid email or password');

    // After the password check, so only someone who knows the password learns that the account
    // exists but is not verified. The code lets the web offer to send the link again.
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        message: 'Verify your email before signing in',
        code: EMAIL_NOT_VERIFIED,
      });
    }

    const updated = await this.users.touchLastLogin(user.id);
    return this.startSession(updated, meta);
  }

  async googleLogin(
    profile: GoogleProfile,
    meta: ClientMeta,
  ): Promise<Session> {
    const user = await this.google.resolveUser(profile);
    return this.startSession(user, meta);
  }

  async refresh(rawRefreshToken: string, meta: ClientMeta): Promise<Session> {
    const { userId, refreshToken } = await this.refreshTokens.rotate(
      rawRefreshToken,
      meta,
    );

    const user = await this.users.findById(userId);
    // An unverified account has no session; this closes the gap for one that got a session
    // before verification became required.
    if (!user || !user.emailVerifiedAt) {
      throw new UnauthorizedException('Invalid session');
    }

    const accessToken = await this.signAccess(user);
    return { accessToken, refreshToken, user: toPublicUser(user) };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) await this.refreshTokens.revoke(rawRefreshToken);
  }

  private async startSession(user: User, meta: ClientMeta): Promise<Session> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccess(user),
      this.refreshTokens.issue(user.id, meta),
    ]);
    return { accessToken, refreshToken, user: toPublicUser(user) };
  }

  private signAccess(user: User): Promise<string> {
    return this.tokens.signAccessToken({ sub: user.id, email: user.email });
  }
}
