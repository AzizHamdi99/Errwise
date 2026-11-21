/**
 * Checks the status updates against the real local database, through the real IssuesRepository:
 *  - an id of another project (here: another organization) is neither changed nor reported;
 *  - an issue that already has the status is skipped, and keeps its resolvedAt;
 *  - resolved sets resolvedAt, any other status clears it;
 *  - many requests for the same issues at once: each issue is counted exactly once;
 *  - the single update is scoped by project too.
 * It creates throw-away issues (fingerprint prefix "verify-env-") and a throw-away organization
 * ("verify-bulk-org"), and deletes them at the end.
 *
 *   yarn workspace @errwise/api exec tsx scripts/perf/verify-bulk.ts
 */
import { randomUUID } from 'node:crypto';
import { IssuesRepository } from '../../src/modules/issues/issues.repository';
import { createPerfClient, PERF_PROJECT_SLUG } from './perf-guard';

const prisma = createPerfClient();
const repo = new IssuesRepository(prisma as never);
const OTHER_ORG_SLUG = 'verify-bulk-org';
const LONG_AGO = new Date('2026-01-01T00:00:00.000Z');
let failed = false;

function check(ok: boolean, text: string): void {
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${text}`);
}

async function makeIssue(
  projectId: string,
  name: string,
  extra: { status?: string; resolvedAt?: Date } = {},
) {
  return prisma.issue.create({
    data: {
      projectId,
      fingerprint: `verify-env-bulk-${name}-${randomUUID()}`,
      title: `Error: ${name}`,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      ...extra,
    },
  });
}

const read = (id: string) => prisma.issue.findUniqueOrThrow({ where: { id } });

async function cleanup(): Promise<void> {
  await prisma.organization.deleteMany({ where: { slug: OTHER_ORG_SLUG } });
  await prisma.issue.deleteMany({
    where: { fingerprint: { startsWith: 'verify-env-bulk-' } },
  });
}

async function main(): Promise<void> {
  await cleanup();
  const project = await prisma.project.findFirstOrThrow({
    where: { slug: PERF_PROJECT_SLUG },
  });
  const otherOrg = await prisma.organization.create({
    data: { name: 'Verify bulk', slug: OTHER_ORG_SLUG },
  });
  const otherProject = await prisma.project.create({
    data: { organizationId: otherOrg.id, name: 'Other', slug: 'other' },
  });

  const [a1, a2, a3, a4, a5] = await Promise.all(
    ['a1', 'a2', 'a3', 'a4', 'a5'].map((name) => makeIssue(project.id, name)),
  );
  const a6 = await makeIssue(project.id, 'a6', {
    status: 'resolved',
    resolvedAt: LONG_AGO,
  });
  const foreign = await makeIssue(otherProject.id, 'foreign');

  // 1. Resolve three of ours plus an id of another organization's project.
  const before = Date.now();
  let changed = await repo.bulkUpdateStatus(
    project.id,
    [a1.id, a2.id, a3.id, foreign.id],
    'resolved',
  );
  check(
    changed === 3,
    `an id of another project is not counted (${changed} of 4)`,
  );
  const foreignAfter = await read(foreign.id);
  check(
    foreignAfter.status === 'unresolved' && foreignAfter.resolvedAt === null,
    'the issue of the other project is untouched',
  );
  const a1Resolved = await read(a1.id);
  check(
    a1Resolved.status === 'resolved' &&
      !!a1Resolved.resolvedAt &&
      a1Resolved.resolvedAt.getTime() >= before - 1000,
    'resolved issues get a resolvedAt of now',
  );

  // 2. An issue that already has the status is skipped and keeps its original resolvedAt.
  changed = await repo.bulkUpdateStatus(project.id, [a4.id, a6.id], 'resolved');
  check(changed === 1, `already-resolved issue is skipped (${changed} of 2)`);
  check(
    (await read(a6.id)).resolvedAt?.getTime() === LONG_AGO.getTime(),
    'its resolvedAt is not overwritten',
  );

  // 3. Reopen and ignore clear resolvedAt.
  changed = await repo.bulkUpdateStatus(project.id, [a1.id], 'unresolved');
  const reopened = await read(a1.id);
  check(
    changed === 1 &&
      reopened.status === 'unresolved' &&
      reopened.resolvedAt === null,
    'reopening clears resolvedAt',
  );
  await repo.bulkUpdateStatus(project.id, [a2.id], 'ignored');
  const ignored = await read(a2.id);
  check(
    ignored.status === 'ignored' && ignored.resolvedAt === null,
    'ignoring a resolved issue clears resolvedAt',
  );

  // 4. Eight identical requests at once: every issue changes exactly once, whoever wins.
  // Now: a1 unresolved, a2 ignored, a3 resolved, a5 unresolved -> three of them need to change.
  const counts = await Promise.all(
    Array.from({ length: 8 }, () =>
      repo.bulkUpdateStatus(
        project.id,
        [a1.id, a2.id, a3.id, a5.id],
        'resolved',
      ),
    ),
  );
  check(
    counts.reduce((a, b) => a + b, 0) === 3,
    `8 parallel identical requests: each change counted once (counts ${counts.join(',')})`,
  );
  const states = await Promise.all([a1, a2, a3, a5].map((i) => read(i.id)));
  check(
    states.every((s) => s.status === 'resolved' && s.resolvedAt),
    'and all four end up resolved with a resolvedAt',
  );

  // 5. The single update is scoped by project as well.
  const stranger = await repo.updateStatus(project.id, foreign.id, 'resolved');
  check(
    stranger === null && (await read(foreign.id)).status === 'unresolved',
    "single update of another project's issue: null, nothing changed",
  );
  const own = await repo.updateStatus(project.id, a4.id, 'ignored');
  check(
    own?.status === 'ignored' && own.resolvedAt === null,
    'single update of our own issue works',
  );
}

main()
  .catch((error: unknown) => {
    failed = true;
    console.error(error instanceof Error ? error.message : error);
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    process.exitCode = failed ? 1 : 0;
  });
