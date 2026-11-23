import { Injectable } from '@nestjs/common';
import type { Organization, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { wipeFixCode } from '../fixes/fix-wipe';

export type MembershipWithOrganization = Prisma.MembershipGetPayload<{
  include: { organization: true };
}>;

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** One nested write, so the organization and its owner are created atomically. */
  createWithOwner(data: {
    name: string;
    slug: string;
    ownerId: string;
  }): Promise<Organization> {
    return this.prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        members: { create: { userId: data.ownerId, role: 'owner' } },
      },
    });
  }

  listForUser(userId: string): Promise<MembershipWithOrganization[]> {
    return this.prisma.membership.findMany({
      where: { userId, organization: { deletedAt: null } },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
  }

  update(id: string, data: { name: string }): Promise<Organization> {
    return this.prisma.organization.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      // The code of the AI fixes does not outlive the organization (ADR-009).
      await wipeFixCode(tx, { organizationId: id });
    });
  }
}
