import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const invitationInclude = {
  organization: true,
  invitedBy: { select: { name: true, email: true } },
} satisfies Prisma.InvitationInclude;

export type InvitationWithRelations = Prisma.InvitationGetPayload<{
  include: typeof invitationInclude;
}>;

export interface CreateInvitationData {
  organizationId: string;
  email: string;
  role: string;
  tokenHash: string;
  invitedById: string;
  expiresAt: Date;
}

@Injectable()
export class InvitationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Revokes older pending invitations to the same email, then creates the new one. */
  replacePending(data: CreateInvitationData): Promise<InvitationWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: {
          organizationId: data.organizationId,
          email: data.email,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      return tx.invitation.create({ data, include: invitationInclude });
    });
  }

  countPending(organizationId: string): Promise<number> {
    return this.prisma.invitation.count({
      where: {
        organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  listPending(organizationId: string): Promise<InvitationWithRelations[]> {
    return this.prisma.invitation.findMany({
      where: {
        organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: invitationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  findInOrganization(
    id: string,
    organizationId: string,
  ): Promise<InvitationWithRelations | null> {
    return this.prisma.invitation.findFirst({
      where: { id, organizationId },
      include: invitationInclude,
    });
  }

  findByTokenHash(tokenHash: string): Promise<InvitationWithRelations | null> {
    return this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: invitationInclude,
    });
  }

  async isMember(organizationId: string, email: string): Promise<boolean> {
    const count = await this.prisma.membership.count({
      where: { organizationId, user: { email } },
    });
    return count > 0;
  }

  /** New token and new expiry for the same invitation (resend). */
  refresh(
    id: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<InvitationWithRelations> {
    return this.prisma.invitation.update({
      where: { id },
      data: { tokenHash, expiresAt },
      include: invitationInclude,
    });
  }

  /** Returns false if it was already accepted, revoked or expired. */
  async revoke(id: string): Promise<boolean> {
    const { count } = await this.prisma.invitation.updateMany({
      where: { id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count > 0;
  }

  /**
   * Marks the invitation accepted, creates the membership and verifies the
   * user's email, all in one transaction. Returns false if the invitation
   * is no longer usable (for example a concurrent accept).
   */
  accept(params: {
    invitationId: string;
    userId: string;
    organizationId: string;
    role: string;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const { count } = await tx.invitation.updateMany({
        where: {
          id: params.invitationId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { acceptedAt: now },
      });
      if (count === 0) return false;

      // skipDuplicates: an existing membership keeps its current role
      await tx.membership.createMany({
        data: [
          {
            userId: params.userId,
            organizationId: params.organizationId,
            role: params.role,
          },
        ],
        skipDuplicates: true,
      });

      await tx.user.updateMany({
        where: { id: params.userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      });
      return true;
    });
  }
}
