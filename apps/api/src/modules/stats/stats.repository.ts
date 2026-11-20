import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Issue } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { BucketUnit, LevelCountRow, ProjectCountRow } from './stats-range';

export type IssueWithProject = Issue & {
  project: { id: string; name: string };
};

export interface ProjectEventCount {
  projectId: string;
  count: number;
}

export interface TimeSpan {
  from: Date;
  to: Date;
}

export interface TopIssueCount {
  issueId: string;
  count: number;
}

export interface EnvironmentRow {
  environment: string;
  count: number;
}

export interface ReleaseRow {
  release: string | null;
  count: number;
}

export interface ReleaseActivityRow {
  release: string | null;
  events: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface NewIssuesByRelease {
  release: string | null;
  count: number;
}

const TOP_LIMIT = 10;
const RELEASES_LIMIT = 20;

// Every query takes projectId first and a [from, to) span, so it stays on the
// (projectId, timestamp) index and can never read another project's events.
@Injectable()
export class StatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countEvents(projectId: string, span: TimeSpan): Promise<number> {
    return this.prisma.event.count({
      where: { projectId, timestamp: { gte: span.from, lt: span.to } },
    });
  }

  countUnresolvedIssues(projectId: string): Promise<number> {
    return this.prisma.issue.count({
      where: { projectId, status: 'unresolved' },
    });
  }

  countNewIssues(projectId: string, span: TimeSpan): Promise<number> {
    return this.prisma.issue.count({
      where: { projectId, firstSeenAt: { gte: span.from, lt: span.to } },
    });
  }

  countRegressedIssues(projectId: string, span: TimeSpan): Promise<number> {
    return this.prisma.issue.count({
      where: { projectId, lastRegressionAt: { gte: span.from, lt: span.to } },
    });
  }

  /**
   * Sparse rows (only buckets that have events). The unit is bound as a parameter
   * from a closed union, and date_trunc runs in UTC whatever the session time zone is.
   */
  async eventsByBucketAndLevel(
    projectId: string,
    span: TimeSpan,
    unit: BucketUnit,
    issueId?: string,
  ): Promise<LevelCountRow[]> {
    // A fragment, not string concatenation: the id is still a bound parameter.
    const issueFilter = issueId
      ? Prisma.sql`AND "issueId" = ${issueId}::uuid`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      { bucket: Date; level: string; count: bigint }[]
    >`
      SELECT date_trunc(${unit}, "timestamp", 'UTC') AS bucket,
             "level" AS level,
             COUNT(*) AS count
      FROM "Event"
      WHERE "projectId" = ${projectId}::uuid
        AND "timestamp" >= ${span.from}
        AND "timestamp" < ${span.to}
        ${issueFilter}
      GROUP BY 1, 2
    `;
    return rows.map((row) => ({ ...row, count: Number(row.count) }));
  }

  async eventsByEnvironment(
    projectId: string,
    span: TimeSpan,
    issueId?: string,
  ): Promise<EnvironmentRow[]> {
    const rows = await this.prisma.event.groupBy({
      by: ['environment'],
      where: {
        projectId,
        ...(issueId ? { issueId } : {}),
        timestamp: { gte: span.from, lt: span.to },
      },
      _count: { _all: true },
      orderBy: { _count: { environment: 'desc' } },
      take: TOP_LIMIT,
    });
    return rows.map((row) => ({
      environment: row.environment,
      count: row._count._all,
    }));
  }

  /** Releases seen in the span, most recently seen first. Null groups events without a release. */
  async releaseActivity(
    projectId: string,
    span: TimeSpan,
  ): Promise<ReleaseActivityRow[]> {
    const rows = await this.prisma.event.groupBy({
      by: ['release'],
      where: { projectId, timestamp: { gte: span.from, lt: span.to } },
      _count: { _all: true },
      _min: { timestamp: true },
      _max: { timestamp: true },
      orderBy: { _max: { timestamp: 'desc' } },
      take: RELEASES_LIMIT,
    });
    return rows.flatMap((row) =>
      // A group always has events, so both bounds exist; the check only satisfies the types.
      row._min.timestamp && row._max.timestamp
        ? [
            {
              release: row.release,
              events: row._count._all,
              firstSeenAt: row._min.timestamp,
              lastSeenAt: row._max.timestamp,
            },
          ]
        : [],
    );
  }

  /** Issues first seen in the span, by the release of their first event. */
  async newIssuesByRelease(
    projectId: string,
    span: TimeSpan,
  ): Promise<NewIssuesByRelease[]> {
    const rows = await this.prisma.issue.groupBy({
      by: ['firstRelease'],
      where: { projectId, firstSeenAt: { gte: span.from, lt: span.to } },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      release: row.firstRelease,
      count: row._count._all,
    }));
  }

  /** Events of one issue by release. `release` is null for events sent without one. */
  async eventsByRelease(
    projectId: string,
    issueId: string,
    span: TimeSpan,
  ): Promise<ReleaseRow[]> {
    const rows = await this.prisma.event.groupBy({
      by: ['release'],
      where: {
        projectId,
        issueId,
        timestamp: { gte: span.from, lt: span.to },
      },
      _count: { _all: true },
      orderBy: { _count: { release: 'desc' } },
      take: TOP_LIMIT,
    });
    return rows.map((row) => ({
      release: row.release,
      count: row._count._all,
    }));
  }

  async topIssueCounts(
    projectId: string,
    span: TimeSpan,
  ): Promise<TopIssueCount[]> {
    const rows = await this.prisma.event.groupBy({
      by: ['issueId'],
      where: { projectId, timestamp: { gte: span.from, lt: span.to } },
      _count: { _all: true },
      orderBy: { _count: { issueId: 'desc' } },
      take: TOP_LIMIT,
    });
    return rows.map((row) => ({
      issueId: row.issueId,
      count: row._count._all,
    }));
  }

  /** Scoped by projectId as well as the ids: an id from elsewhere finds nothing. */
  findIssues(projectId: string, ids: string[]): Promise<Issue[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.issue.findMany({
      where: { projectId, id: { in: ids } },
    });
  }

  /** AI analyses an organization started on one UTC day. No row yet means none. */
  async aiRequestsOn(organizationId: string, day: Date): Promise<number> {
    const row = await this.prisma.aiUsage.findUnique({
      where: { organizationId_day: { organizationId, day } },
    });
    return row?.requests ?? 0;
  }

  // ---- Organization scope ----
  // These take the organization id and filter through the project relation, so a
  // soft-deleted project drops out of every number and nothing needs an id list.

  countEventsInOrg(organizationId: string, span: TimeSpan): Promise<number> {
    return this.prisma.event.count({
      where: {
        project: activeProjectOf(organizationId),
        timestamp: { gte: span.from, lt: span.to },
      },
    });
  }

  countUnresolvedIssuesInOrg(organizationId: string): Promise<number> {
    return this.prisma.issue.count({
      where: {
        project: activeProjectOf(organizationId),
        status: 'unresolved',
      },
    });
  }

  countNewIssuesInOrg(organizationId: string, span: TimeSpan): Promise<number> {
    return this.prisma.issue.count({
      where: {
        project: activeProjectOf(organizationId),
        firstSeenAt: { gte: span.from, lt: span.to },
      },
    });
  }

  countRegressedIssuesInOrg(
    organizationId: string,
    span: TimeSpan,
  ): Promise<number> {
    return this.prisma.issue.count({
      where: {
        project: activeProjectOf(organizationId),
        lastRegressionAt: { gte: span.from, lt: span.to },
      },
    });
  }

  /** Sparse rows, like eventsByBucketAndLevel, but split by project. */
  async eventsByBucketAndProject(
    organizationId: string,
    span: TimeSpan,
    unit: BucketUnit,
  ): Promise<ProjectCountRow[]> {
    const rows = await this.prisma.$queryRaw<
      { bucket: Date; projectId: string; count: bigint }[]
    >`
      SELECT date_trunc(${unit}, e."timestamp", 'UTC') AS bucket,
             e."projectId" AS "projectId",
             COUNT(*) AS count
      FROM "Event" e
      JOIN "Project" p ON p."id" = e."projectId"
      WHERE p."organizationId" = ${organizationId}::uuid
        AND p."deletedAt" IS NULL
        AND e."timestamp" >= ${span.from}
        AND e."timestamp" < ${span.to}
      GROUP BY 1, 2
    `;
    return rows.map((row) => ({ ...row, count: Number(row.count) }));
  }

  async eventCountsByProject(
    organizationId: string,
    span: TimeSpan,
  ): Promise<ProjectEventCount[]> {
    const rows = await this.prisma.event.groupBy({
      by: ['projectId'],
      where: {
        project: activeProjectOf(organizationId),
        timestamp: { gte: span.from, lt: span.to },
      },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      projectId: row.projectId,
      count: row._count._all,
    }));
  }

  async unresolvedCountsByProject(
    organizationId: string,
  ): Promise<ProjectEventCount[]> {
    const rows = await this.prisma.issue.groupBy({
      by: ['projectId'],
      where: { project: activeProjectOf(organizationId), status: 'unresolved' },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      projectId: row.projectId,
      count: row._count._all,
    }));
  }

  async topIssueCountsInOrg(
    organizationId: string,
    span: TimeSpan,
  ): Promise<TopIssueCount[]> {
    const rows = await this.prisma.event.groupBy({
      by: ['issueId'],
      where: {
        project: activeProjectOf(organizationId),
        timestamp: { gte: span.from, lt: span.to },
      },
      _count: { _all: true },
      orderBy: { _count: { issueId: 'desc' } },
      take: TOP_LIMIT,
    });
    return rows.map((row) => ({
      issueId: row.issueId,
      count: row._count._all,
    }));
  }

  /** Scoped by organization as well as the ids: an id from another tenant finds nothing. */
  findIssuesInOrg(
    organizationId: string,
    ids: string[],
  ): Promise<IssueWithProject[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.issue.findMany({
      where: { id: { in: ids }, project: activeProjectOf(organizationId) },
      include: { project: { select: { id: true, name: true } } },
    });
  }
}

const activeProjectOf = (organizationId: string) => ({
  organizationId,
  deletedAt: null,
});
