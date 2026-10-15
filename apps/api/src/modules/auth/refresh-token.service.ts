import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'node:crypto';
import type { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { sha256 } from '../../common/utils/hash';
import type { Env } from '../../config/env';
import {
  CreateRefreshTokenData,
  RefreshTokenRepository,
} from './refresh-token.repository';

const DAY_MS = 86_400_000;

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly repo: RefreshTokenRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Starts a new token family (a new login). Returns the raw token for the cookie. */
  async issue(userId: string, meta: ClientMeta): Promise<string> {
    const { raw, data } = this.build(userId, randomUUID(), meta);
    await this.repo.create(data);
    return raw;
  }

  /** Validates the token, revokes it, and returns a new one in the same family. */
  async rotate(
    raw: string,
    meta: ClientMeta,
  ): Promise<{ userId: string; refreshToken: string }> {
    const record = await this.repo.findByHash(sha256(raw));
    if (!record) throw new UnauthorizedException('Invalid session');

    // A revoked token being used again means it may have been stolen: kill the family.
    if (record.revokedAt) {
      await this.repo.revokeFamily(record.familyId);
      throw new UnauthorizedException('Invalid session');
    }
    if (record.expiresAt < new Date())
      throw new UnauthorizedException('Session expired');

    const next = this.build(record.userId, record.familyId, meta);
    const rotated = await this.repo.rotate(record.id, next.data);
    if (!rotated) {
      await this.repo.revokeFamily(record.familyId);
      throw new UnauthorizedException('Invalid session');
    }
    return { userId: record.userId, refreshToken: next.raw };
  }

  /** Logout: revokes the whole family of this token. */
  async revoke(raw: string): Promise<void> {
    const record = await this.repo.findByHash(sha256(raw));
    if (record) await this.repo.revokeFamily(record.familyId);
  }

  private build(userId: string, familyId: string, meta: ClientMeta) {
    const raw = randomBytes(48).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const data: CreateRefreshTokenData = {
      userId,
      familyId,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
      userAgent: meta.userAgent,
      ip: meta.ip,
    };
    return { raw, data };
  }
}
