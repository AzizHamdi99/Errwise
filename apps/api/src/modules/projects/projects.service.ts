import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateProjectInput,
  PublicProject,
  UpdateProjectInput,
} from '@errwise/shared';
import { randomSlugSuffix, slugify } from '../../common/utils/slug';
import { toPublicProject } from './projects.mapper';
import { ProjectsRepository } from './projects.repository';

const MAX_SLUG_ATTEMPTS = 5;

@Injectable()
export class ProjectsService {
  constructor(private readonly repo: ProjectsRepository) {}

  async create(
    organizationId: string,
    input: CreateProjectInput,
  ): Promise<PublicProject> {
    const base = slugify(input.name);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${randomSlugSuffix()}`;
      try {
        const project = await this.repo.create({
          organizationId,
          name: input.name,
          slug,
          platform: input.platform,
          retentionDays: input.retentionDays,
        });
        return toPublicProject(project);
      } catch (e) {
        const taken =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002';
        if (!taken) throw e;
      }
    }
    throw new ConflictException('Could not generate a unique slug');
  }

  async list(organizationId: string): Promise<PublicProject[]> {
    const projects = await this.repo.listByOrganization(organizationId);
    return projects.map(toPublicProject);
  }

  async get(organizationId: string, id: string): Promise<PublicProject> {
    return toPublicProject(await this.getOrThrow(organizationId, id));
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateProjectInput,
  ): Promise<PublicProject> {
    await this.getOrThrow(organizationId, id); // 404 if missing, deleted or another tenant's
    const project = await this.repo.update(id, input);
    return toPublicProject(project);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.getOrThrow(organizationId, id);
    await this.repo.softDelete(id);
  }

  private async getOrThrow(organizationId: string, id: string) {
    const project = await this.repo.findInOrganization(organizationId, id);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
