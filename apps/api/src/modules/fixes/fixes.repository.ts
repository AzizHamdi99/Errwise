import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Event, Issue, IssueFix } from '@prisma/client';
import type { StoredFixEdit, StoredFixResult } from '@errwise/shared';
import { PrismaService } from '../../database/prisma.service';

/** A fix with its issue: what opening a pull request needs. */
export type FixWithIssue = IssueFix & { issue: Issue };

export interface FixProject {
  githubInstallationId: string | null;
  githubRepo: string | null;
  sourceContextEnabled: boolean;
  fixPullRequestsEnabled: boolean;
}

export interface SaveFixData {
  organizationId: string;
  projectId: string;
  issueId: string;
  inputHash: string;
  promptVersion: string;
  model: string;
  repo: string;
  installationId: string;
  commitSha: string;
  result: StoredFixResult;
  edits: StoredFixEdit[];
}

export type SaveFixOutcome =
  /** `created` is false when the same input was stored first by another request. */
  | { status: 'saved'; fix: IssueFix; created: boolean }
  /** A switch, the repository or the project changed while the fix was being made. */
  | { status: 'project_changed' };

interface LockedProject {
  sourceContextEnabled: boolean;
  fixPullRequestsEnabled: boolean;
  githubRepo: string | null;
  githubInstallationId: string | null;
  deletedAt: Date | null;
}

@Injectable()
export class FixesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Scoped by organization, so a project from another tenant returns null. */
  findProject(
    organizationId: string,
    projectId: string,
  ): Promise<FixProject | null> {
    return this.prisma.project.findFirst({
      where: { id: projectId, organizationId, deletedAt: null },
      select: {
        githubInstallationId: true,
        githubRepo: true,
        sourceContextEnabled: true,
        fixPullRequestsEnabled: true,
      },
    });
  }

  /** Scoped by project, so an issue from another tenant returns null. */
  findIssue(projectId: string, issueId: string): Promise<Issue | null> {
    return this.prisma.issue.findFirst({ where: { id: issueId, projectId } });
  }

  latestEvent(issueId: string): Promise<Event | null> {
    return this.prisma.event.findFirst({
      where: { issueId },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    });
  }

  findFix(issueId: string, inputHash: string): Promise<IssueFix | null> {
    return this.prisma.issueFix.findUnique({
      where: { issueId_inputHash: { issueId, inputHash } },
    });
  }

  latestFix(issueId: string): Promise<IssueFix | null> {
    return this.prisma.issueFix.findFirst({
      where: { issueId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  /**
   * One fix of the issue, scoped by organization, project and issue, with the issue (for the
   * link back and the GitHub issue number). Another tenant's fix returns null.
   */
  findFixInProject(
    organizationId: string,
    projectId: string,
    issueId: string,
    fixId: string,
  ): Promise<FixWithIssue | null> {
    return this.prisma.issueFix.findFirst({
      where: {
        id: fixId,
        issueId,
        issue: { projectId, project: { organizationId, deletedAt: null } },
      },
      include: { issue: true },
    });
  }

  /**
   * A fix that may still become a pull request: it has code, no pull request, and the
   * project still allows it (both switches on, not deleted, organization not deleted).
   */
  private openable(fixId: string): Prisma.IssueFixWhereInput {
    return {
      id: fixId,
      prNumber: null,
      edits: { not: Prisma.DbNull },
      issue: {
        project: {
          deletedAt: null,
          sourceContextEnabled: true,
          fixPullRequestsEnabled: true,
          organization: { deletedAt: null },
        },
      },
    };
  }

  /**
   * Atomically takes the right to open the pull request, like the claim on a GitHub issue:
   * one concurrent request gets `true`. A claim older than `staleBefore` belongs to a request
   * that died, and can be taken over. The settings are part of the `where`, so a fix whose
   * consent was withdrawn cannot be claimed.
   */
  async claimPullRequest(fixId: string, staleBefore: Date): Promise<boolean> {
    const { count } = await this.prisma.issueFix.updateMany({
      where: {
        ...this.openable(fixId),
        OR: [{ prClaimedAt: null }, { prClaimedAt: { lt: staleBefore } }],
      },
      data: { prClaimedAt: new Date() },
    });
    return count === 1;
  }

  /**
   * Asked right before the first thing that cannot be undone (a branch, a pull request): the
   * owner may have turned the feature off since the claim.
   */
  async isStillOpenable(fixId: string): Promise<boolean> {
    const count = await this.prisma.issueFix.count({
      where: { ...this.openable(fixId), prClaimedAt: { not: null } },
    });
    return count === 1;
  }

  async releasePullRequestClaim(fixId: string): Promise<void> {
    await this.prisma.issueFix.updateMany({
      where: { id: fixId, prNumber: null },
      data: { prClaimedAt: null },
    });
  }

  /**
   * Keeps the link and ends the claim. `saved` is false if the row already had a pull
   * request (it is returned as it is), so the caller records the audit entry only once.
   */
  async savePullRequest(
    fixId: string,
    link: { number: number; url: string; userId: string },
  ): Promise<{ fix: IssueFix; saved: boolean }> {
    const { count } = await this.prisma.issueFix.updateMany({
      where: { id: fixId, prNumber: null },
      data: {
        prNumber: link.number,
        prUrl: link.url,
        prOpenedById: link.userId,
        prClaimedAt: null,
      },
    });
    const fix = await this.prisma.issueFix.findUniqueOrThrow({
      where: { id: fixId },
    });
    return { fix, saved: count === 1 };
  }

  /**
   * Stores the fix, but only if the project still allows it.
   *
   * The model call takes seconds, and the owner can turn a switch off meanwhile. Whatever
   * turns one off runs `wipeFixCode` in its own transaction after updating the project row,
   * so it waits for the row lock below if a save is running, and wipes what the save wrote.
   * If it ran first, the rows are read after it and the save is refused. Either way no code
   * survives a switch that is off.
   *
   * Two requests with the same input are safe too: the second insert is skipped by the unique
   * key, and a row whose code was wiped earlier is given its code back.
   */
  saveFix(data: SaveFixData): Promise<SaveFixOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const [project] = await tx.$queryRaw<LockedProject[]>(Prisma.sql`
        SELECT "sourceContextEnabled", "fixPullRequestsEnabled", "githubRepo",
               "githubInstallationId", "deletedAt"
        FROM "Project"
        WHERE "id" = ${data.projectId}::uuid
          AND "organizationId" = ${data.organizationId}::uuid
        FOR SHARE`);

      if (
        !project ||
        project.deletedAt !== null ||
        !project.sourceContextEnabled ||
        !project.fixPullRequestsEnabled ||
        project.githubInstallationId !== data.installationId ||
        project.githubRepo?.toLowerCase() !== data.repo.toLowerCase()
      ) {
        return { status: 'project_changed' } as const;
      }

      const fields = {
        promptVersion: data.promptVersion,
        model: data.model,
        repo: data.repo,
        installationId: data.installationId,
        commitSha: data.commitSha,
        result: data.result as unknown as Prisma.InputJsonObject,
        edits: data.edits as unknown as Prisma.InputJsonArray,
      };
      const { count } = await tx.issueFix.createMany({
        data: [{ issueId: data.issueId, inputHash: data.inputHash, ...fields }],
        skipDuplicates: true,
      });
      const row = await tx.issueFix.findUniqueOrThrow({
        where: {
          issueId_inputHash: {
            issueId: data.issueId,
            inputHash: data.inputHash,
          },
        },
      });
      if (count === 1) return { status: 'saved', fix: row, created: true };

      // The same input is already there. If its code was wiped, this is the same fix again.
      if (row.edits === null) {
        const fix = await tx.issueFix.update({
          where: { id: row.id },
          data: fields,
        });
        return { status: 'saved', fix, created: true };
      }
      return { status: 'saved', fix: row, created: false };
    });
  }
}
