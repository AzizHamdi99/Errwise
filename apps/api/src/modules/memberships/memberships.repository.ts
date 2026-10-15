import { Injectable } from '@nestjs/common';
import type { Membership, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const memberInclude = {
  user: { select: { id: true, email: true, name: true } },
} satisfies Prisma.MembershipInclude;

export type MembershipWithUser = Prisma.MembershipGetPayload<{
  include: typeof memberInclude;
}>;

@Injectable()
export class MembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Only returns a membership if the organization is not deleted. */
  findActive(
    userId: string,
    organizationId: string,
  ): Promise<Membership | null> {
    return this.prisma.membership.findFirst({
      where: { userId, organizationId, organization: { deletedAt: null } },
    });
  }

  find(userId: string, organizationId: string): Promise<Membership | null> {
    return this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
  }

  listByOrganization(organizationId: string): Promise<MembershipWithUser[]> {
    return this.prisma.membership.findMany({
      where: { organizationId },
      include: memberInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  updateRole(
    userId: string,
    organizationId: string,
    role: string,
  ): Promise<MembershipWithUser> {
    return this.prisma.membership.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { role },
      include: memberInclude,
    });
  }

  async delete(userId: string, organizationId: string): Promise<void> {
    await this.prisma.membership.delete({
      where: { userId_organizationId: { userId, organizationId } },
    });
  }
}
