/**
 * Builds a large, repeatable dataset in the LOCAL database to measure the issue list.
 *
 *   yarn workspace @errwise/api exec tsx scripts/perf/seed-perf.ts
 *
 * Everything lives in one organization (slug "perf-org"). The script deletes that organization
 * first (cascade), so it can run again and never touches other data.
 *
 * Shape of the data, chosen so each query we want to measure has a hard case:
 *  - 50 000 issues: 70% unresolved, 20% resolved, 10% ignored.
 *  - 5 "hot" issues with 100 000 events each, every other issue has 10 (about 1M events).
 *  - 500 issues share the exact same lastSeenAt, so the cursor tie-breaker (id) is exercised.
 *  - environments: production (~70%), development (~29%), staging (~1%), and "canary", which
 *    exists on 3 issues only (a rare value: the worst case for filtering by environment).
 *  - titles: the word "timeout" is common (~17%), "zxqrare" appears on 5 issues only.
 *  - 500 unresolved issues have regressed (1%); one issue was first seen in release "v9.9-rare"
 *    and 50 in "v2.0-beta" (rare values for the release filter); the other 20 releases are common.
 */
import {
  createPerfClient,
  PERF_ORG_SLUG,
  PERF_PROJECT_SLUG,
} from './perf-guard';

const ISSUES = 50_000;
const HOT_ISSUES = 5;
const HOT_EVENTS = 100_000;
const EVENTS_PER_ISSUE = 10;

const prisma = createPerfClient();

async function timed<T>(label: string, work: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const result = await work();
  console.log(`${label} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  return result;
}

async function main(): Promise<void> {
  await timed('Deleted the previous perf organization', () =>
    prisma.$executeRawUnsafe(
      `DELETE FROM "Organization" WHERE slug = $1`,
      PERF_ORG_SLUG,
    ),
  );

  const [{ id: orgId }] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Organization" (id, name, slug, "updatedAt")
     VALUES (gen_random_uuid(), 'Perf org', $1, now()) RETURNING id`,
    PERF_ORG_SLUG,
  );
  const [{ id: projectId }] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "Project" (id, "organizationId", name, slug, "updatedAt")
     VALUES (gen_random_uuid(), $1::uuid, 'Perf project', $2, now()) RETURNING id`,
    orgId,
    PERF_PROJECT_SLUG,
  );

  await timed(`Inserted ${ISSUES} issues`, () =>
    prisma.$executeRawUnsafe(
      `INSERT INTO "Issue"
         (id, "projectId", fingerprint, title, type, level, status, "eventCount",
          "firstSeenAt", "lastSeenAt", "firstRelease", "lastRelease",
          "regressionCount", "lastRegressionAt")
       SELECT gen_random_uuid(), $1::uuid, md5(n::text),
              type || ': ' || msg || ' #' || n, type, level, status, cnt,
              last_seen - random() * interval '14 days', last_seen,
              CASE WHEN n = 4242 THEN 'v9.9-rare'
                   WHEN n % 1000 = 5 THEN 'v2.0-beta'
                   ELSE 'v1.' || (n % 20) END,
              'v1.' || (n % 20),
              CASE WHEN n % 100 = 3 THEN 1 ELSE 0 END,
              CASE WHEN n % 100 = 3 THEN last_seen END
       FROM (
         SELECT n,
                (ARRAY['TypeError','RangeError','Error','ReferenceError'])[1 + n % 4] AS type,
                CASE WHEN n IN (7, 13, 21, 34, 55) THEN 'zxqrare failure in worker'
                     ELSE (ARRAY[
                       'timeout while calling payment provider',
                       'Cannot read properties of undefined',
                       'connection reset by peer',
                       'invalid token signature',
                       'unexpected end of JSON input',
                       'maximum call stack size exceeded'
                     ])[1 + n % 6] END AS msg,
                CASE WHEN n % 10 = 0 THEN 'fatal' WHEN n % 5 = 0 THEN 'warning' ELSE 'error' END AS level,
                CASE WHEN n % 10 = 0 THEN 'ignored' WHEN n % 10 IN (1, 2) THEN 'resolved' ELSE 'unresolved' END AS status,
                CASE WHEN n <= $2 THEN $3::int ELSE $4::int END AS cnt,
                CASE WHEN n BETWEEN 1000 AND 1499
                     THEN date_trunc('hour', now()) - interval '1 day'
                     ELSE date_trunc('minute', now() - random() * interval '30 days') END AS last_seen
         FROM generate_series(1, $5::int) AS n
       ) AS src`,
      projectId,
      HOT_ISSUES,
      HOT_EVENTS,
      EVENTS_PER_ISSUE,
      ISSUES,
    ),
  );

  await timed('Inserted the events', () =>
    prisma.$executeRawUnsafe(
      `INSERT INTO "Event"
         (id, "eventId", "projectId", "issueId", level, type, message, platform,
          environment, release, "timestamp")
       SELECT gen_random_uuid(), gen_random_uuid(), i."projectId", i.id, i.level, i.type,
              i.title, 'node',
              CASE WHEN i.fingerprint IN (md5('100'), md5('200'), md5('300')) THEN 'canary'
                   WHEN s.r < 0.01 THEN 'staging'
                   WHEN s.r < 0.30 THEN 'development'
                   ELSE 'production' END,
              i."lastRelease",
              i."lastSeenAt" - s.r * (i."lastSeenAt" - i."firstSeenAt")
       FROM "Issue" i
       CROSS JOIN LATERAL (
         SELECT random() AS r FROM generate_series(1, i."eventCount")
       ) AS s
       WHERE i."projectId" = $1::uuid`,
      projectId,
    ),
  );

  // The planner needs fresh statistics, or the EXPLAIN output describes an empty table.
  await timed('Analyzed the tables', async () => {
    await prisma.$executeRawUnsafe(`ANALYZE "Issue"`);
    await prisma.$executeRawUnsafe(`ANALYZE "Event"`);
  });

  const [counts] = await prisma.$queryRawUnsafe<
    { issues: bigint; events: bigint }[]
  >(
    `SELECT (SELECT count(*) FROM "Issue" WHERE "projectId" = $1::uuid) AS issues,
            (SELECT count(*) FROM "Event" WHERE "projectId" = $1::uuid) AS events`,
    projectId,
  );
  console.log(
    `Done: ${counts.issues} issues, ${counts.events} events in project "${PERF_PROJECT_SLUG}".`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
