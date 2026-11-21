import { Injectable } from '@nestjs/common';
import type { RefreshToken } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateRefreshTokenData {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
  ip: string | null;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  /**
   * Revokes the old token and creates the new one in one transaction.
   * Returns false if the old token was already revoked (a concurrent or replayed request).
   */
  rotate(oldId: string, next: CreateRefreshTokenData): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: oldId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) return false;
      await tx.refreshToken.create({ data: next });
      return true;
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * The live token of every session (family) of a user. Rotation revokes the previous token, so
   * a family has at most one live token, and its creation time is when it was last refreshed.
   */
  listLive(userId: string, now: Date): Promise<RefreshToken[]> {
    return this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  /** Scoped by user: another user's family revokes nothing. Returns false when nothing was live. */
  async revokeFamilyOfUser(userId: string, familyId: string): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { userId, familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count > 0;
  }

  /** Every session of the user except `keepFamilyId` (all of them when it is null). */
  async revokeAllOfUserExcept(
    userId: string,
    keepFamilyId: string | null,
  ): Promise<number> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(keepFamilyId ? { familyId: { not: keepFamilyId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  async deleteExpired(): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }
}
