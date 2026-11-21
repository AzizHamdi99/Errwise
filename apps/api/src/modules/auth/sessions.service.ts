import { Injectable, NotFoundException } from '@nestjs/common';
import type { PublicSession } from '@errwise/shared';
import { sha256 } from '../../common/utils/hash';
import { RefreshTokenRepository } from './refresh-token.repository';

/**
 * The signed-in devices of a user. A session is a refresh-token family: logging in starts one,
 * every refresh rotates its token, logging out revokes it. Everything is scoped by user id.
 */
@Injectable()
export class SessionsService {
  constructor(private readonly repo: RefreshTokenRepository) {}

  /** The family of the refresh cookie sent with this request, if it is a live one of the user. */
  async currentFamilyId(
    userId: string,
    rawRefreshToken: string | undefined,
  ): Promise<string | null> {
    if (!rawRefreshToken) return null;
    const record = await this.repo.findByHash(sha256(rawRefreshToken));
    return record && record.userId === userId && !record.revokedAt
      ? record.familyId
      : null;
  }

  async list(
    userId: string,
    rawRefreshToken: string | undefined,
  ): Promise<PublicSession[]> {
    const [tokens, currentId] = await Promise.all([
      this.repo.listLive(userId, new Date()),
      this.currentFamilyId(userId, rawRefreshToken),
    ]);
    // One row per family, even if a race ever left two live tokens in one.
    const seen = new Set<string>();
    const sessions: PublicSession[] = [];
    for (const token of tokens) {
      if (seen.has(token.familyId)) continue;
      seen.add(token.familyId);
      sessions.push({
        id: token.familyId,
        userAgent: token.userAgent,
        ip: token.ip,
        lastUsedAt: token.createdAt.toISOString(),
        current: token.familyId === currentId,
      });
    }
    return sessions;
  }

  /** Another user's session, or one already gone, answers 404. */
  async revoke(userId: string, familyId: string): Promise<void> {
    const revoked = await this.repo.revokeFamilyOfUser(userId, familyId);
    if (!revoked) throw new NotFoundException('Session not found');
  }

  /** Signs out every other device. Without a current session, that is every session. */
  async revokeOthers(
    userId: string,
    rawRefreshToken: string | undefined,
  ): Promise<void> {
    const keep = await this.currentFamilyId(userId, rawRefreshToken);
    await this.repo.revokeAllOfUserExcept(userId, keep);
  }
}
