import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { Event, Issue, IssueAnalysis } from '@prisma/client';
import { wipeFixCode } from '../fixes/fix-wipe';

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

  /**
   * A new installation invalidates any previously chosen repo. Fix suggestions were made for
   * the old one, so their code goes too (ADR-009), in the same transaction.
   */
  async saveInstallation(
    projectId: string,
    installationId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { githubInstallationId: installationId, githubRepo: null },
      });
      await wipeFixCode(tx, { projectId });
    });
  }

  /**
   * Always wipes, even when the same repository is chosen again: reselecting is rare, and a
   * comparison here could only be stale.
   */
  async saveRepo(projectId: string, repo: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { githubRepo: repo },
      });
      await wipeFixCode(tx, { projectId });
    });
  }

  async disconnect(projectId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        // Disconnecting also withdraws the consent to read code from that repository, and
        // the one to write to it.
        data: {
          githubInstallationId: null,
          githubRepo: null,
          sourceContextEnabled: false,
          fixPullRequestsEnabled: false,
        },
      });
      await wipeFixCode(tx, { projectId });
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
   * Read here, not through AnalysisModule: that module imports SourceContextModule, which
   * imports this one, so the other way round would be a cycle. Same order as
   * AnalysisRepository.latestAnalysis. The caller owns the issue already (findIssue).
   */
  findLatestAnalysis(issueId: string): Promise<IssueAnalysis | null> {
    return this.prisma.issueAnalysis.findFirst({
      where: { issueId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

  /**
   * Syncs the GitHub state onto every Errwise issue linked to this GitHub issue.
   * closed   -> unresolved issues become resolved (resolvedAt = now)
   * reopened -> resolved issues become unresolved (resolvedAt = null)
   * Ignored issues keep their status, but githubState is always updated.
   */
  async applyGithubIssueState(
    ref: { repo: string; installationId: string; number: number },
    state: 'open' | 'closed',
  ): Promise<void> {
    const where = {
      githubIssueNumber: ref.number,
      project: {
        githubRepo: { equals: ref.repo, mode: 'insensitive' as const },
        githubInstallationId: ref.installationId,
        deletedAt: null,
      },
    };

    if (state === 'closed') {
      await this.prisma.$transaction([
        this.prisma.issue.updateMany({
          where: { ...where, status: 'unresolved' },
          data: {
            status: 'resolved',
            resolvedAt: new Date(),
            githubState: 'closed',
          },
        }),
        this.prisma.issue.updateMany({
          where: { ...where, status: { not: 'unresolved' } },
          data: { githubState: 'closed' },
        }),
      ]);
      return;
    }

    await this.prisma.$transaction([
      this.prisma.issue.updateMany({
        where: { ...where, status: 'resolved' },
        data: { status: 'unresolved', resolvedAt: null, githubState: 'open' },
      }),
      this.prisma.issue.updateMany({
        where: { ...where, status: { not: 'resolved' } },
        data: { githubState: 'open' },
      }),
    ]);
  }
  /** What the regression sync needs: the GitHub link and the project connection. */
  findRegressionContext(issueId: string) {
    return this.prisma.issue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        projectId: true,
        githubIssueNumber: true,
        githubState: true,
        lastRelease: true,
        regressionCount: true,
        project: {
          select: {
            organizationId: true,
            deletedAt: true,
            githubInstallationId: true,
            githubRepo: true,
          },
        },
      },
    });
  }

  /**
   * Atomically claims the right to reopen the GitHub issue. Only one concurrent
   * caller gets `true`, so a retry never posts a second comment.
   */
  async claimGithubReopen(issueId: string): Promise<boolean> {
    const { count } = await this.prisma.issue.updateMany({
      where: { id: issueId, githubState: 'closed' },
      data: { githubState: 'open' },
    });
    return count === 1;
  }

  /** Gives the claim back when GitHub could not be updated, so a retry can try again. */
  async releaseGithubReopen(issueId: string): Promise<void> {
    await this.prisma.issue.updateMany({
      where: { id: issueId, githubState: 'open' },
      data: { githubState: 'closed' },
    });
  }
}
