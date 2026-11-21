/**
 * Pages through the perf dataset with the real IssuesRepository and the real cursor, and checks
 * the pages against one full ordered query: no duplicate, no skipped row, same order.
 * Every sort and every status (and "all") is walked. The dataset has 500 issues with the same
 * lastSeenAt and about 50 000 with the same eventCount, so page boundaries fall inside big ties.
 *
 *   yarn workspace @errwise/api exec tsx scripts/perf/verify-pagination.ts
 */
import { ISSUE_SORTS } from '@errwise/shared';
import type { IssueSort } from '@errwise/shared';
import {
  SORT_FIELD,
  decodeCursor,
  encodeCursor,
} from '../../src/modules/issues/issues.cursor';
import type { IssueCursor } from '../../src/modules/issues/issues.cursor';
import { IssuesRepository } from '../../src/modules/issues/issues.repository';
import { createPerfClient, PERF_PROJECT_SLUG } from './perf-guard';

const prisma = createPerfClient();
// The repository only needs `issue.findMany`, which a plain PrismaClient has too.
const repo = new IssuesRepository(prisma as never);

const PAGE_SIZES = [25, 100];
// undefined is the "All" tab: no status filter, served by its own index.
const STATUSES = ['unresolved', 'resolved', 'ignored', undefined] as const;

async function walk(
  projectId: string,
  status: string | undefined,
  sort: IssueSort,
  limit: number,
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: IssueCursor | undefined;
  for (;;) {
    const rows = await repo.list(projectId, { status, sort, limit, cursor });
    const page = rows.slice(0, limit);
    ids.push(...page.map((row) => row.id));
    const last = page.at(-1);
    if (rows.length <= limit || !last) return ids;
    // go through the encoded form, like a real client does
    cursor = decodeCursor(encodeCursor(sort, last), sort) ?? undefined;
    if (!cursor) throw new Error('The cursor could not be decoded.');
  }
}

async function main(): Promise<void> {
  const project = await prisma.project.findFirstOrThrow({
    where: { slug: PERF_PROJECT_SLUG },
  });

  let failed = false;
  for (const sort of ISSUE_SORTS) {
    for (const status of STATUSES) {
      const expected = (
        await prisma.issue.findMany({
          where: { projectId: project.id, ...(status ? { status } : {}) },
          orderBy: [{ [SORT_FIELD[sort]]: 'desc' }, { id: 'desc' }],
          select: { id: true },
        })
      ).map((row) => row.id);

      for (const limit of PAGE_SIZES) {
        const start = Date.now();
        const actual = await walk(project.id, status, sort, limit);
        const unique = new Set(actual).size;
        const same =
          actual.length === expected.length &&
          actual.every((id, index) => id === expected[index]);
        if (!same) failed = true;
        console.log(
          `${same ? 'OK  ' : 'FAIL'} sort=${sort} status=${status ?? 'all'} limit=${limit}: ` +
            `${actual.length}/${expected.length} rows, ${unique} unique ` +
            `(${((Date.now() - start) / 1000).toFixed(1)}s)`,
        );
      }
    }
  }
  if (failed) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
