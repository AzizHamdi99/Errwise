/**
 * Checks, against the real local database, that the ingestion transaction keeps IssueEnvironment
 * correct. It uses the real IngestionRepository on throw-away issues (fingerprint prefix
 * "verify-env-"), which it deletes at the end.
 *
 *   yarn workspace @errwise/api exec tsx scripts/perf/verify-issue-environments.ts
 */
import { randomUUID } from 'node:crypto';
import { IngestionRepository } from '../../src/modules/ingestion/ingestion.repository';
import type { StoreEventData } from '../../src/modules/ingestion/ingestion.repository';
import { createPerfClient, PERF_PROJECT_SLUG } from './perf-guard';

const prisma = createPerfClient();
// The repository only needs `$transaction` and the model delegates, which a PrismaClient has.
const repo = new IngestionRepository(prisma as never);

const PREFIX = 'verify-env-';
const PARALLEL = 10;
let failed = false;

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

function eventData(
  projectId: string,
  fingerprint: string,
  environment: string,
  eventId = randomUUID(),
): StoreEventData {
  return {
    projectId,
    fingerprint,
    fingerprintVersion: 1,
    title: 'Error: verify',
    eventId,
    level: 'error',
    type: 'Error',
    message: 'verify',
    platform: 'node',
    environment,
    timestamp: new Date(),
  };
}

async function environmentsOf(issueId: string): Promise<string[]> {
  const rows = await prisma.issueEnvironment.findMany({
    where: { issueId },
    orderBy: { environment: 'asc' },
  });
  return rows.map((row) => row.environment);
}

async function main(): Promise<void> {
  const project = await prisma.project.findFirstOrThrow({
    where: { slug: PERF_PROJECT_SLUG },
  });
  const projectId = project.id;
  await prisma.issue.deleteMany({
    where: { projectId, fingerprint: { startsWith: PREFIX } },
  });

  // 1. The first event of a new issue creates its environment row.
  const fp1 = `${PREFIX}1-${randomUUID()}`;
  const first = await repo.store(eventData(projectId, fp1, 'production'));
  const issueId = first?.issueId ?? '';
  check('first event creates the issue', first?.issueCreated === true);
  check(
    'first event records its environment',
    (await environmentsOf(issueId)).join() === 'production',
  );

  // 2. A known environment again: no second row, the counter moves.
  await repo.store(eventData(projectId, fp1, 'production'));
  check(
    'same environment twice leaves one row',
    (await environmentsOf(issueId)).join() === 'production',
  );

  // 3. A replayed eventId is rejected and writes NOTHING, not even the new environment.
  const replayId = randomUUID();
  await repo.store(eventData(projectId, fp1, 'production', replayId));
  const before = await prisma.issue.findUniqueOrThrow({
    where: { id: issueId },
  });
  const replay = await repo.store(
    eventData(projectId, fp1, 'replay-only-env', replayId),
  );
  const after = await prisma.issue.findUniqueOrThrow({
    where: { id: issueId },
  });
  check('a replayed eventId is rejected', replay === null);
  check(
    'a replay does not move the counter',
    before.eventCount === after.eventCount,
    `${before.eventCount} -> ${after.eventCount}`,
  );
  check(
    'a replay does not leave its environment behind (rolled back)',
    !(await environmentsOf(issueId)).includes('replay-only-env'),
  );

  // 4. Many requests bring the same NEW environment to an existing issue together.
  const burst = await Promise.allSettled(
    Array.from({ length: PARALLEL }, () =>
      repo.store(eventData(projectId, fp1, 'canary-verify')),
    ),
  );
  check(
    `${PARALLEL} parallel events in a new environment: no error`,
    burst.every((r) => r.status === 'fulfilled'),
  );
  const canaryRows = (await environmentsOf(issueId)).filter(
    (e) => e === 'canary-verify',
  );
  check('...and exactly one environment row', canaryRows.length === 1);

  // 5. Many first occurrences of a new fingerprint together (issue AND environment are new).
  const fp2 = `${PREFIX}2-${randomUUID()}`;
  const race = await Promise.allSettled(
    Array.from({ length: PARALLEL }, () =>
      repo.store(eventData(projectId, fp2, 'staging')),
    ),
  );
  check(
    `${PARALLEL} parallel first occurrences: no error`,
    race.every((r) => r.status === 'fulfilled'),
  );
  const raced = await prisma.issue.findMany({
    where: { projectId, fingerprint: fp2 },
  });
  check('...one issue', raced.length === 1);
  check(
    '...all events stored',
    raced[0]?.eventCount === PARALLEL,
    `${raced[0]?.eventCount}/${PARALLEL}`,
  );
  check(
    '...one environment row',
    (await environmentsOf(raced[0]?.id ?? '')).join() === 'staging',
  );

  // 6. The summary equals what the events say, for the whole throw-away data.
  const mismatches = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM (
       SELECT e."issueId", e.environment FROM "Event" e
       JOIN "Issue" i ON i.id = e."issueId"
       WHERE i."projectId" = $1::uuid AND i.fingerprint LIKE $2
       GROUP BY 1, 2
     ) ev
     FULL JOIN (
       SELECT ie."issueId", ie.environment FROM "IssueEnvironment" ie
       JOIN "Issue" i ON i.id = ie."issueId"
       WHERE i."projectId" = $1::uuid AND i.fingerprint LIKE $2
     ) ie USING ("issueId", environment)
     WHERE ev."issueId" IS NULL OR ie."issueId" IS NULL`,
    projectId,
    `${PREFIX}%`,
  );
  check(
    'IssueEnvironment matches the distinct environments of the events',
    Number(mismatches[0].n) === 0,
  );
}

main()
  .catch((error: unknown) => {
    failed = true;
    console.error(error instanceof Error ? error.message : error);
  })
  .finally(async () => {
    // Events and environment rows go with the issue (cascade).
    const project = await prisma.project.findFirst({
      where: { slug: PERF_PROJECT_SLUG },
    });
    if (project) {
      await prisma.issue.deleteMany({
        where: { projectId: project.id, fingerprint: { startsWith: PREFIX } },
      });
    }
    await prisma.$disconnect();
    process.exitCode = failed ? 1 : 0;
  });
