import { Injectable } from '@nestjs/common';
import type { PasswordReset } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PasswordResetRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** One row per user: a new link replaces the previous one, which stops working. */
  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    sentAt: Date,
  ): Promise<void> {
    await this.prisma.passwordReset.upsert({
      where: { userId },
      create: { userId, tokenHash, expiresAt, sentAt },
      update: { tokenHash, expiresAt, sentAt },
    });
  }

  findByUserId(userId: string): Promise<PasswordReset | null> {
    return this.prisma.passwordReset.findUnique({ where: { userId } });
  }

  /** A cheap check before the slow password hash. `consume` still decides who wins. */
  async isUsable(tokenHash: string, now: Date): Promise<boolean> {
    const link = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
      select: { expiresAt: true },
    });
    return link !== null && link.expiresAt > now;
  }

  /**
   * Removes a link nobody received. The token is part of the condition, so a newer link that
   * was saved in the meantime is kept.
   */
  async deleteLink(userId: string, tokenHash: string): Promise<void> {
    await this.prisma.passwordReset.deleteMany({
      where: { userId, tokenHash },
    });
  }

  /**
   * Uses a link: sets the new password and signs the user out everywhere, in one transaction.
   * Returns false for a link that is unknown, expired or already used.
   *
   * The delete carries the token and the expiry in its `where`, so when two requests use the
   * same link only one deletes it (count 1): one winner, one new password. The password hash is
   * computed by the caller before this runs, so no slow work happens inside the transaction.
   *
   * Opening the link proves the user owns the address, so an unverified email becomes verified
   * (and its pending verification link is dropped). Every refresh token is revoked: whoever
   * knew the old password loses their session too. Access tokens still live until they expire.
   */
  consume(
    tokenHash: string,
    now: Date,
    passwordHash: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const link = await tx.passwordReset.findUnique({ where: { tokenHash } });
      if (!link) return false;

      const { count } = await tx.passwordReset.deleteMany({
        where: { tokenHash, expiresAt: { gt: now } },
      });
      if (count !== 1) return false;

      const userId = link.userId;
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.user.updateMany({
        where: { id: userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      });
      await tx.emailVerification.deleteMany({ where: { userId } });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });
  }
}
