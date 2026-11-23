import {
  BadRequestException,
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
import { AuditService } from '../audit/audit.service';
import { toPublicProject } from './projects.mapper';
import { ProjectsRepository } from './projects.repository';

const MAX_SLUG_ATTEMPTS = 5;

/** The settings that make a "project.updated" entry. Source code has its own events. */
const UPDATABLE_FIELDS = ['name', 'platform', 'retentionDays'] as const;

interface ProjectFields {
  name: string;
  platform: string;
  retentionDays: number;
  sourceContextEnabled: boolean;
  fixPullRequestsEnabled: boolean;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repo: ProjectsRepository,
    private readonly audit: AuditService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    input: CreateProjectInput,
  ): Promise<PublicProject> {
    const base = slugify(input.name);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${randomSlugSuffix()}`;
      try {
        const project = await this.repo.create(
          {
            organizationId,
            name: input.name,
            slug,
            platform: input.platform,
            retentionDays: input.retentionDays,
          },
          userId,
        );
        await this.audit.record({
          organizationId,
          actorId: userId,
          action: 'project.created',
          targetType: 'project',
          targetId: project.id,
          projectId: project.id,
          metadata: { name: project.name, platform: project.platform },
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
    actorId: string,
  ): Promise<PublicProject> {
    // 404 if missing, deleted or in another organization
    const before = await this.getOrThrow(organizationId, id);
    const project = await this.repo.update(
      id,
      this.applyFixRules(before, input),
    );
    await this.recordUpdate(organizationId, actorId, before, project);
    return toPublicProject(project);
  }

  async remove(
    organizationId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    const project = await this.getOrThrow(organizationId, id);
    await this.repo.softDelete(id);
    await this.audit.record({
      organizationId,
      actorId,
      action: 'project.deleted',
      targetType: 'project',
      targetId: id,
      projectId: id,
      metadata: { name: project.name },
    });
  }

  /**
   * AI fixes (ADR-009) read and write code, so they need the source code switch: they cannot be
   * turned on without it, and turning it off turns them off. The check and the forced change
   * are made here, and the stored fixes are wiped by the repository in the same transaction.
   */
  private applyFixRules(
    before: ProjectFields,
    input: UpdateProjectInput,
  ): UpdateProjectInput {
    const sourceEnabled =
      input.sourceContextEnabled ?? before.sourceContextEnabled;
    if (input.fixPullRequestsEnabled === true && !sourceEnabled) {
      throw new BadRequestException(
        'Turn on source code before turning on AI fix pull requests',
      );
    }
    if (input.sourceContextEnabled === false) {
      return { ...input, fixPullRequestsEnabled: false };
    }
    return input;
  }

  /**
   * Turning source code on or off is its own event: it decides whether code leaves for the AI
   * (ADR-005). Other changes are one "updated" entry listing the fields that really changed.
   */
  private async recordUpdate(
    organizationId: string,
    actorId: string,
    before: ProjectFields,
    after: ProjectFields & { id: string },
  ): Promise<void> {
    const base = {
      organizationId,
      actorId,
      targetType: 'project' as const,
      targetId: after.id,
      projectId: after.id,
    };
    if (before.sourceContextEnabled !== after.sourceContextEnabled) {
      await this.audit.record({
        ...base,
        action: after.sourceContextEnabled
          ? 'project.source_context_enabled'
          : 'project.source_context_disabled',
        metadata: { name: after.name },
      });
    }
    if (before.fixPullRequestsEnabled !== after.fixPullRequestsEnabled) {
      await this.audit.record({
        ...base,
        action: after.fixPullRequestsEnabled
          ? 'project.fix_pull_requests_enabled'
          : 'project.fix_pull_requests_disabled',
        metadata: { name: after.name },
      });
    }
    const changed = UPDATABLE_FIELDS.filter((f) => before[f] !== after[f]);
    if (changed.length > 0) {
      await this.audit.record({
        ...base,
        action: 'project.updated',
        metadata: {
          name: after.name,
          fields: changed.join(', '),
          ...(changed.includes('name') ? { previousName: before.name } : {}),
        },
      });
    }
  }

  private async getOrThrow(organizationId: string, id: string) {
    const project = await this.repo.findInOrganization(organizationId, id);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
