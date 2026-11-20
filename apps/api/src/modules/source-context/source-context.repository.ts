import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface SourceProject {
  githubInstallationId: string | null;
  githubRepo: string | null;
  sourceContextEnabled: boolean;
}

export interface SourceEvent {
  stack: string | null;
  commitSha: string | null;
}

@Injectable()
export class SourceContextRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Scoped by organization, so a project from another tenant returns null. */
  findProject(
    organizationId: string,
    projectId: string,
  ): Promise<SourceProject | null> {
    return this.prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      select: {
        githubInstallationId: true,
        githubRepo: true,
        sourceContextEnabled: true,
      },
    });
  }

  /** The event must belong to this issue and this project: ids alone prove nothing. */
  findEvent(
    projectId: string,
    issueId: string,
    eventId: string,
  ): Promise<SourceEvent | null> {
    return this.prisma.event.findFirst({
      where: { id: eventId, issueId, projectId },
      select: { stack: true, commitSha: true },
    });
  }
}
