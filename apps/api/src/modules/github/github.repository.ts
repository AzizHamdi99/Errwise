import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { Event, Issue } from '@prisma/client';

export interface GithubProjectLink {
  id: string;
  githubInstallationId: string | null;
  githubRepo: string | null;
}

@Injectable()
export class GithubRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Always scoped by organization, so a project from another tenant returns null. */
  findProject(
    organizationId: string,
    projectId: string,
  ): Promise<GithubProjectLink | null> {
    return this.prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      select: { id: true, githubInstallationId: true, githubRepo: true },
    });
  }

  /** A new installation invalidates any previously chosen repo. */
  async saveInstallation(
    projectId: string,
    installationId: string,
  ): Promise<void> {
    await this.prisma.project.update({
      where: { id: projectId },
      data: { githubInstallationId: installationId, githubRepo: null },
    });
  }

  async saveRepo(projectId: string, repo: string): Promise<void> {
    await this.prisma.project.update({
      where: { id: projectId },
      data: { githubRepo: repo },
    });
  }

  async disconnect(projectId: string): Promise<void> {
    await this.prisma.project.update({
      where: { id: projectId },
      data: { githubInstallationId: null, githubRepo: null },
    });
  }
  /** Scoped by project and organization, so another tenant's issue returns null. */
  findIssue(
    organizationId: string,
    projectId: string,
    issueId: string,
  ): Promise<Issue | null> {
    return this.prisma.issue.findFirst({
      where: {
        id: issueId,
        projectId,
        project: { organizationId, deletedAt: null },
      },
    });
  }

  findLatestEvent(issueId: string): Promise<Event | null> {
    return this.prisma.event.findFirst({
      where: { issueId },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Atomically claims the right to create the GitHub issue. Only one concurrent
   * request gets `true`. A claim older than `staleBefore` is considered dead
   * (the server crashed mid-request) and can be taken over.
   */
  async claimIssueCreation(
    issueId: string,
    staleBefore: Date,
  ): Promise<boolean> {
    const { count } = await this.prisma.issue.updateMany({
      where: {
        id: issueId,
        githubIssueNumber: null,
        OR: [
          { githubIssueClaimedAt: null },
          { githubIssueClaimedAt: { lt: staleBefore } },
        ],
      },
      data: { githubIssueClaimedAt: new Date() },
    });
    return count === 1;
  }

  async saveIssueLink(
    issueId: string,
    number: number,
    url: string,
  ): Promise<void> {
    await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        githubIssueNumber: number,
        githubIssueUrl: url,
        githubIssueClaimedAt: null,
      },
    });
  }

  async releaseIssueClaim(issueId: string): Promise<void> {
    await this.prisma.issue.updateMany({
      where: { id: issueId, githubIssueNumber: null },
      data: { githubIssueClaimedAt: null },
    });
  }
}
