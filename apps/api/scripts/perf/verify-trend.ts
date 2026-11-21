/**
 * Checks the list's 24-hour trend against the real local database, through the real
 * IssuesService, IssuesRepository and the real SQL bucketing:
 *  1. a throw-away issue with events placed on exact hour boundaries (inside the window, on its
 *     first instant, 1 ms before it, and in a future hour) must give a known array;
 *  2. for real issues of the perf data, the sum of each trend must equal an independent count of
 *     the events inside the window.
 * The throw-away issue (fingerprint prefix "verify-env-") is deleted at the end.
 *
 *   yarn workspace @errwise/api exec tsx scripts/perf/verify-trend.ts
 */
import { randomUUID } from 'node:crypto';
import { TREND_HOURS } from '@errwise/shared';
import { trendStart } from '../../src/modules/issues/issue-trend';
import { IssuesRepository } from '../../src/modules/issues/issues.repository';
import { IssuesService } from '../../src/modules/issues/issues.service';
import { createPerfClient, PERF_PROJECT_SLUG } from './perf-guard';

const prisma = createPerfClient();
const repo = new IssuesRepository(prisma as never);
const service = new IssuesService(repo, {
  get: () => Promise.resolve({}),
} as never);
const HOUR = 60 * 60 * 1000;
let failed = false;

function check(ok: boolean, text: string): void {
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${text}`);
}

async function boundaryCase(projectId: string): Promise<void> {
  // The hour can change between building the events and the service reading the clock: retry once.
  for (let attempt = 0; attempt < 2; attempt++) {
    const currentHour = Math.floor(Date.now() / HOUR) * HOUR;
    const marker = `verify-trend-${randomUUID()}`;
    const issue = await prisma.issue.create({
      data: {
        projectId,
        fingerprint: `verify-env-trend-${marker}`,
        title: `Error: ${marker}`,
        type: 'Error',
        firstSeenAt: new Date(currentHour - 30 * HOUR),
        lastSeenAt: new Date(currentHour),
      },
    });

    const at = (ms: number, count: number) =>
      Array.from({ length: count }, () => ({
        eventId: randomUUID(),
        projectId,
        issueId: issue.id,
        message: marker,
        timestamp: new Date(ms),
      }));
    await prisma.event.createMany({
      data: [
        ...at(currentHour, 2), // the current hour, its first instant      -> index 23
        ...at(currentHour - HOUR + 30 * 60_000, 3), // previous hour       -> index 22
        ...at(currentHour - 5 * HOUR + HOUR - 1, 1), // last ms of hour -5 -> index 18
        ...at(currentHour - 23 * HOUR, 1), // first instant of the window  -> index 0
        ...at(currentHour - 23 * HOUR - 1, 4), // 1 ms before the window   -> ignored
        ...at(currentHour + HOUR, 5), // a future hour                     -> ignored
      ],
    });

    const page = await service.list('org', projectId, {
      sort: 'lastSeen',
      limit: 25,
      search: marker,
    });
    await prisma.issue.delete({ where: { id: issue.id } });

    if (Math.floor(Date.now() / HOUR) * HOUR !== currentHour) continue;

    const expected = new Array<number>(TREND_HOURS).fill(0);
    expected[0] = 1;
    expected[18] = 1;
    expected[22] = 3;
    expected[23] = 2;
    const trend = page.items[0]?.trend24h ?? [];
    check(page.items.length === 1, 'the throw-away issue is the only match');
    check(
      trend.length === TREND_HOURS && trend.every((n, i) => n === expected[i]),
      `trend on exact hour boundaries = ${JSON.stringify(trend)}`,
    );
    return;
  }
  check(false, 'the hour changed twice during the check: run it again');
}

async function realIssuesCase(projectId: string): Promise<void> {
  const since = trendStart(new Date());
  for (const sort of ['lastSeen', 'events'] as const) {
    const page = await service.list('org', projectId, { sort, limit: 25 });
    const counts = await prisma.$queryRawUnsafe<{ id: string; n: bigint }[]>(
      `SELECT i.id, count(e.id) AS n FROM "Issue" i
       LEFT JOIN "Event" e ON e."issueId" = i.id AND e."timestamp" >= $2::timestamptz
       WHERE i.id = ANY($1::uuid[]) GROUP BY i.id`,
      page.items.map((item) => item.id),
      since,
    );
    const expected = new Map(counts.map((row) => [row.id, Number(row.n)]));
    const wrong = page.items.filter(
      (item) =>
        item.trend24h.length !== TREND_HOURS ||
        item.trend24h.reduce((a, b) => a + b, 0) !== expected.get(item.id),
    );
    const total = page.items.reduce(
      (sum, item) => sum + item.trend24h.reduce((a, b) => a + b, 0),
      0,
    );
    check(
      wrong.length === 0,
      `page of ${page.items.length} issues (sort=${sort}): every trend sums to the independent count (${total} events in the window)`,
    );
  }
}

async function main(): Promise<void> {
  const project = await prisma.project.findFirstOrThrow({
    where: { slug: PERF_PROJECT_SLUG },
  });
  await prisma.issue.deleteMany({
    where: {
      projectId: project.id,
      fingerprint: { startsWith: 'verify-env-trend-' },
    },
  });
  await boundaryCase(project.id);
  await realIssuesCase(project.id);
}

main()
  .catch((error: unknown) => {
    failed = true;
    console.error(error instanceof Error ? error.message : error);
  })
  .finally(async () => {
    const project = await prisma.project.findFirst({
      where: { slug: PERF_PROJECT_SLUG },
    });
    if (project) {
      await prisma.issue.deleteMany({
        where: {
          projectId: project.id,
          fingerprint: { startsWith: 'verify-env-' },
        },
      });
    }
    await prisma.$disconnect();
    process.exitCode = failed ? 1 : 0;
  });
