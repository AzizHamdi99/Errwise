import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { LoginInput, PublicUser, RegisterInput } from '@errwise/shared';
import type { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { PasswordHasher } from '../../common/security/password-hasher.service';
import { TokenService } from '../../common/security/token.service';
import { toPublicUser } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { RefreshTokenService } from './refresh-token.service';

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
  ) {}

  async register(input: RegisterInput, meta: ClientMeta): Promise<Session> {
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });
    return this.startSession(user, meta);
  }

  async login(input: LoginInput, meta: ClientMeta): Promise<Session> {
    const user = await this.users.findByEmail(input.email);
    const valid = await this.hasher.verify(
      user?.passwordHash ?? null,
      input.password,
    );
    if (!user || !valid)
      throw new UnauthorizedException('Invalid email or password');

    const updated = await this.users.touchLastLogin(user.id);
    return this.startSession(updated, meta);
  }

  async refresh(rawRefreshToken: string, meta: ClientMeta): Promise<Session> {
    const { userId, refreshToken } = await this.refreshTokens.rotate(
      rawRefreshToken,
      meta,
    );

    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Invalid session');

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
