import { Injectable } from '@nestjs/common';
import type { Project } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

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
}

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateProjectData): Promise<Project> {
    return this.prisma.project.create({ data });
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

  update(id: string, data: UpdateProjectData): Promise<Project> {
    return this.prisma.project.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
