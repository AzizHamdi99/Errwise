import { Injectable } from '@nestjs/common';
import type { Event, Issue, Prisma } from '@prisma/client';
import { escapeLike } from '../../common/utils/like';
import { PrismaService } from '../../database/prisma.service';
import type { IssueAge, IssueFacets, IssueSort } from '@errwise/shared';
import type { HourlyCount } from './issue-trend';
import { SORT_FIELD } from './issues.cursor';
import type { IssueCursor } from './issues.cursor';

export interface IssueFilter {
  status?: string;
  environment?: string;
  level?: string;
  /** The release the issue was first seen in. */
  release?: string;
  /** Only true narrows the list; false or absent means "no condition". */
  regressed?: boolean;
  age?: IssueAge;
  search?: string;
  sort: IssueSort;
  /** Must have been made for the same sort (the service checks it). */
  cursor?: IssueCursor;
  limit: number;
}

const AGE_MS: Record<IssueAge, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

/** Each facet lists at most this many values: it feeds a dropdown, not a report. */
const FACET_LIMIT = 20;

@Injectable()
export class IssuesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns up to limit + 1 rows: the extra one tells the service there is a next page.
   *
   * With a cursor, the rows "after (value, id)" in "value desc, id desc" order are read as two
   * exact index ranges, never as one OR condition:
   *   1. the rows tied with the cursor on the sort value, with a smaller id;
   *   2. only if the page is not full yet, the rows with a smaller value.
   * A single `value < X OR (value = X AND id < Y)` is not an index range: Postgres starts at the
   * first row of the tie group and discards rows until it reaches the cursor, so a page deep
   * inside a big tie group (most issues have the same event count) reads thousands of rows.
   * The column is a closed set (SORT_FIELD), never user input.
   *
   * The cursor conditions go in `AND`, not next to the filters: with sort "firstSeen" and the
   * "new issues" filter, both are about firstSeenAt, and one would overwrite the other.
   */
  async list(projectId: string, filter: IssueFilter): Promise<Issue[]> {
    const where = this.filterWhere(projectId, filter);
    const take = filter.limit + 1;
    const field = SORT_FIELD[filter.sort];
    const orderBy = [
      { [field]: 'desc' },
      { id: 'desc' },
    ] as Prisma.IssueOrderByWithRelationInput[];

    const { cursor } = filter;
    if (!cursor) return this.prisma.issue.findMany({ where, orderBy, take });

    const tied = await this.prisma.issue.findMany({
      where: {
        ...where,
        AND: [{ [field]: cursor.value, id: { lt: cursor.id } }],
      },
      orderBy: { id: 'desc' },
      take,
    });
    if (tied.length >= take) return tied;

    const after = await this.prisma.issue.findMany({
      where: { ...where, AND: [{ [field]: { lt: cursor.value } }] },
      orderBy,
      take: take - tied.length,
    });
    return [...tied, ...after];
  }

  private filterWhere(
    projectId: string,
    filter: IssueFilter,
  ): Prisma.IssueWhereInput {
    const where: Prisma.IssueWhereInput = { projectId };

    if (filter.status) where.status = filter.status;
    if (filter.environment) {
      // projectId lets Postgres use the (projectId, environment) index of IssueEnvironment.
      where.environments = {
        some: { projectId, environment: filter.environment },
      };
    }
    if (filter.level) where.level = filter.level;
    if (filter.release) where.firstRelease = filter.release;
    if (filter.regressed) where.regressionCount = { gt: 0 };
    if (filter.age) {
      where.firstSeenAt = { gte: new Date(Date.now() - AGE_MS[filter.age]) };
    }
    if (filter.search) {
      where.title = {
        contains: escapeLike(filter.search),
        mode: 'insensitive',
      };
    }
    return where;
  }

  /**
   * Events per UTC hour since `since`, for the issues of one page, in ONE grouped query (not one
   * per issue). Sparse: only hours that have events come back (see buildTrends). It reads the
   * events of those issues inside the window, through the (issueId, timestamp) index, so its cost
   * follows how many events the page's issues had in the last 24 hours, not their whole history.
   * projectId keeps it tenant-scoped even though the ids already came from a project query.
   */
  async hourlyCounts(
    projectId: string,
    issueIds: string[],
    since: Date,
  ): Promise<HourlyCount[]> {
    if (issueIds.length === 0) return [];

    return this.prisma.$queryRaw<HourlyCount[]>`
      SELECT "issueId",
             date_trunc('hour', "timestamp", 'UTC') AS bucket,
             COUNT(*)::int AS count
      FROM "Event"
      WHERE "projectId" = ${projectId}::uuid
        AND "issueId" = ANY(${issueIds}::uuid[])
        AND "timestamp" >= ${since}
      GROUP BY 1, 2`;
  }

  /**
   * The values the list filters can offer. Both read every row of the project (an index-only scan
   * of IssueEnvironment, a scan of Issue): about 10 ms at 50 000 issues, so the dashboard asks
   * once and keeps the answer instead of polling it.
   */
  async facets(projectId: string): Promise<IssueFacets> {
    const [environments, releases] = await Promise.all([
      this.prisma.issueEnvironment.groupBy({
        by: ['environment'],
        where: { projectId },
        _count: { _all: true },
        orderBy: [{ _count: { environment: 'desc' } }, { environment: 'asc' }],
        take: FACET_LIMIT,
      }),
      this.prisma.issue.groupBy({
        by: ['firstRelease'],
        where: { projectId, firstRelease: { not: null } },
        _max: { firstSeenAt: true },
        orderBy: [{ _max: { firstSeenAt: 'desc' } }, { firstRelease: 'asc' }],
        take: FACET_LIMIT,
      }),
    ]);

    return {
      environments: environments.map((row) => row.environment),
      releases: releases.flatMap((row) =>
        row.firstRelease === null ? [] : [row.firstRelease],
      ),
    };
  }

  /**
   * Reads IssueEnvironment, not Event: the events of one issue can be millions, and this runs on
   * every list and detail request. Sorted, so the order does not change between refreshes.
   */
  async environmentsByIssue(
    projectId: string,
    issueIds: string[],
  ): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (issueIds.length === 0) return result;

    const rows = await this.prisma.issueEnvironment.findMany({
      where: { projectId, issueId: { in: issueIds } },
      select: { issueId: true, environment: true },
      orderBy: { environment: 'asc' },
    });
    for (const row of rows) {
      const list = result.get(row.issueId) ?? [];
      list.push(row.environment);
      result.set(row.issueId, list);
    }
    return result;
  }

  /** Scoped by project, so an id from another tenant returns null. */
  findInProject(projectId: string, id: string): Promise<Issue | null> {
    return this.prisma.issue.findFirst({ where: { id, projectId } });
  }

  recentEvents(issueId: string, limit: number): Promise<Event[]> {
    return this.prisma.event.findMany({
      where: { issueId },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }

  /**
   * Scoped by project like every read, so an id from another tenant changes nothing and returns
   * null. updateMany + read, not update(): no exception to translate, and no row of another
   * project can be reached even if a caller forgot to check it first.
   */
  async updateStatus(
    projectId: string,
    id: string,
    status: string,
  ): Promise<Issue | null> {
    const { count } = await this.prisma.issue.updateMany({
      where: { id, projectId },
      data: statusChange(status),
    });
    if (count === 0) return null;
    return this.prisma.issue.findFirst({ where: { id, projectId } });
  }

  /**
   * Changes the status of many issues of ONE project with one UPDATE. Returns how many really
   * changed. Ids of other projects match nothing (no error, nothing leaks), and an issue that
   * already has the status is left alone: `status: { not }` keeps its resolvedAt, and when two
   * requests race for the same issues each issue is counted once, by the one that wins.
   */
  async bulkUpdateStatus(
    projectId: string,
    issueIds: string[],
    status: string,
  ): Promise<number> {
    const { count } = await this.prisma.issue.updateMany({
      where: { projectId, id: { in: issueIds }, status: { not: status } },
      data: statusChange(status),
    });
    return count;
  }
}

/** Same rule for one issue or many: resolved remembers when, any other status forgets it. */
function statusChange(status: string): {
  status: string;
  resolvedAt: Date | null;
} {
  return { status, resolvedAt: status === 'resolved' ? new Date() : null };
}
