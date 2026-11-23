import { Injectable } from '@nestjs/common';
import type { Project } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { wipeFixCode } from '../fixes/fix-wipe';

export interface CreateProjectData {
  organizationId: string;
  name: string;
  slug: string;
  platform: string;
  retentionDays: number;
}

export interface UpdateProjectData {
  name?: string;
  platform?: string;
  retentionDays?: number;
  sourceContextEnabled?: boolean;
  fixPullRequestsEnabled?: boolean;
}

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateProjectData, creatorId: string): Promise<Project> {
    return this.prisma.project.create({
      data: {
        ...data,
        // the creator follows the project from the start (opt-in for the others)
        subscriptions: { create: { userId: creatorId } },
      },
    });
  }

  listByOrganization(organizationId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Always scoped by organization, so a project id from another tenant returns null. */
  findInOrganization(
    organizationId: string,
    id: string,
  ): Promise<Project | null> {
    return this.prisma.project.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  }

  /**
   * Turning source code or fixes off removes the code of the stored fixes in the same
   * transaction (ADR-009): the consent they were made under is gone.
   */
  update(id: string, data: UpdateProjectData): Promise<Project> {
    const withdrawsConsent =
      data.sourceContextEnabled === false ||
      data.fixPullRequestsEnabled === false;
    if (!withdrawsConsent) {
      return this.prisma.project.update({ where: { id }, data });
    }
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({ where: { id }, data });
      await wipeFixCode(tx, { projectId: id });
      return project;
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await wipeFixCode(tx, { projectId: id });
    });
  }
}
