import { Injectable } from '@nestjs/common';
import type { EmailVerification } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class EmailVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** One row per user: a new link replaces the previous one, which stops working. */
  async save(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    sentAt: Date,
  ): Promise<void> {
    await this.prisma.emailVerification.upsert({
      where: { userId },
      create: { userId, tokenHash, expiresAt, sentAt },
      update: { tokenHash, expiresAt, sentAt },
    });
  }

  findByUserId(userId: string): Promise<EmailVerification | null> {
    return this.prisma.emailVerification.findUnique({ where: { userId } });
  }

  /**
   * Removes a link nobody received. The token is part of the condition, so a newer link that
   * was saved in the meantime is kept.
   */
  async deleteLink(userId: string, tokenHash: string): Promise<void> {
    await this.prisma.emailVerification.deleteMany({
      where: { userId, tokenHash },
    });
  }

  /**
   * Uses a link: deletes it and marks the user's email as verified, in one transaction. Returns
   * false for a link that is unknown, expired or already used.
   *
   * The delete carries the token and the expiry in its `where`, so when two requests use the same
   * link only one deletes it (count 1) and the other finds nothing: one winner, and the email is
   * verified once. The user update only touches a user that is not verified yet, so a user who
   * verified another way (Google, an invitation) is not changed.
   */
  consume(tokenHash: string, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const link = await tx.emailVerification.findUnique({
        where: { tokenHash },
      });
      if (!link) return false;

      const { count } = await tx.emailVerification.deleteMany({
        where: { tokenHash, expiresAt: { gt: now } },
      });
      if (count !== 1) return false;

      await tx.user.updateMany({
        where: { id: link.userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      });
      return true;
    });
  }
}
