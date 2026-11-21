/**
 * Checks the issue list filters and the facets against the real local database. For each case
 * the real IssuesRepository is walked page by page (real cursors), and the ids are compared with
 * an independent raw SQL query written here. Needs the perf data (regressions and rare releases
 * come from the current seed-perf.ts).
 *
 *   yarn workspace @errwise/api exec tsx scripts/perf/verify-filters.ts
 */
import { ISSUE_SORTS } from '@errwise/shared';
import type { IssueAge, IssueSort } from '@errwise/shared';
import {
  SORT_FIELD,
  decodeCursor,
  encodeCursor,
} from '../../src/modules/issues/issues.cursor';
import type { IssueCursor } from '../../src/modules/issues/issues.cursor';
import { IssuesRepository } from '../../src/modules/issues/issues.repository';
import type { IssueFilter } from '../../src/modules/issues/issues.repository';
import { createPerfClient, PERF_PROJECT_SLUG } from './perf-guard';

const prisma = createPerfClient();
const repo = new IssuesRepository(prisma as never);
let failed = false;

type Filter = Omit<IssueFilter, 'sort' | 'limit' | 'cursor'>;

interface Case {
  name: string;
  filter: Filter;
  /** The same condition in SQL, over the alias "i". Written by hand, on purpose. */
  sql: string;
  sorts?: IssueSort[];
}

const AGE_SQL: Record<IssueAge, string> = {
  '24h': `i."firstSeenAt" >= now() - interval '24 hours'`,
  '7d': `i."firstSeenAt" >= now() - interval '7 days'`,
};

const CASES: Case[] = [
  {
    name: 'level=warning',
    filter: { status: 'unresolved', level: 'warning' },
    sql: `i.status = 'unresolved' AND i.level = 'warning'`,
  },
  {
    name: 'level=fatal (none unresolved)',
    filter: { status: 'unresolved', level: 'fatal' },
    sql: `i.status = 'unresolved' AND i.level = 'fatal'`,
  },
  {
    name: 'level=fatal, all statuses',
    filter: { level: 'fatal' },
    sql: `i.level = 'fatal'`,
  },
  {
    name: 'release=v2.0-beta',
    filter: { status: 'unresolved', release: 'v2.0-beta' },
    sql: `i.status = 'unresolved' AND i."firstRelease" = 'v2.0-beta'`,
  },
  {
    name: 'release=v9.9-rare',
    filter: { release: 'v9.9-rare' },
    sql: `i."firstRelease" = 'v9.9-rare'`,
  },
  {
    name: 'release=v1.7 (common)',
    filter: { status: 'unresolved', release: 'v1.7' },
    sql: `i.status = 'unresolved' AND i."firstRelease" = 'v1.7'`,
  },
  {
    name: 'regressed',
    filter: { status: 'unresolved', regressed: true },
    sql: `i.status = 'unresolved' AND i."regressionCount" > 0`,
  },
  {
    name: 'regressed=false is no condition',
    filter: { status: 'resolved', regressed: false },
    sql: `i.status = 'resolved'`,
  },
  {
    name: 'age=7d, every sort (cursor and filter share firstSeenAt)',
    filter: { status: 'unresolved', age: '7d' },
    sql: `i.status = 'unresolved' AND ${AGE_SQL['7d']}`,
    sorts: [...ISSUE_SORTS],
  },
  {
    name: 'age=24h, every sort',
    filter: { age: '24h' },
    sql: AGE_SQL['24h'],
    sorts: [...ISSUE_SORTS],
  },
  {
    name: 'regressed + level=error + release=v1.7 (an intersection with rows)',
    filter: {
      status: 'unresolved',
      regressed: true,
      level: 'error',
      release: 'v1.7',
    },
    sql: `i.status = 'unresolved' AND i."regressionCount" > 0 AND i.level = 'error'
          AND i."firstRelease" = 'v1.7'`,
  },
  {
    name: 'regressed + level=error + release=v1.7 + age=7d (usually empty)',
    filter: {
      status: 'unresolved',
      regressed: true,
      level: 'error',
      release: 'v1.7',
      age: '7d',
    },
    sql: `i.status = 'unresolved' AND i."regressionCount" > 0 AND i.level = 'error'
          AND i."firstRelease" = 'v1.7' AND ${AGE_SQL['7d']}`,
  },
  {
    name: 'environment=canary + level + search',
    filter: { environment: 'canary', search: 'error' },
    sql: `EXISTS (SELECT 1 FROM "IssueEnvironment" e WHERE e."issueId" = i.id AND e.environment = 'canary')
          AND i.title ILIKE '%error%'`,
  },
];

async function walk(
  projectId: string,
  filter: Filter,
  sort: IssueSort,
  limit: number,
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: IssueCursor | undefined;
  for (;;) {
    const rows = await repo.list(projectId, { ...filter, sort, limit, cursor });
    const page = rows.slice(0, limit);
    ids.push(...page.map((row) => row.id));
    const last = page.at(-1);
    if (rows.length <= limit || !last) return ids;
    cursor = decodeCursor(encodeCursor(sort, last), sort) ?? undefined;
    if (!cursor) throw new Error('The cursor could not be decoded.');
  }
}

function report(ok: boolean, text: string): void {
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${text}`);
}

async function main(): Promise<void> {
  const project = await prisma.project.findFirstOrThrow({
    where: { slug: PERF_PROJECT_SLUG },
  });

  for (const c of CASES) {
    for (const sort of c.sorts ?? ['lastSeen']) {
      const column = SORT_FIELD[sort];
      const expected = (
        await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT i.id FROM "Issue" i WHERE i."projectId" = $1::uuid AND (${c.sql})
           ORDER BY i."${column}" DESC, i.id DESC`,
          project.id,
        )
      ).map((row) => row.id);
      const actual = await walk(project.id, c.filter, sort, 25);
      const same =
        actual.length === expected.length &&
        actual.every((id, index) => id === expected[index]);
      report(
        same,
        `${c.name} [sort=${sort}]: ${actual.length}/${expected.length} rows, ${new Set(actual).size} unique`,
      );
    }
  }

  // Facets against an independent query.
  const facets = await repo.facets(project.id);
  const envRows = await prisma.$queryRawUnsafe<{ environment: string }[]>(
    `SELECT environment FROM "IssueEnvironment" WHERE "projectId" = $1::uuid
     GROUP BY environment ORDER BY count(*) DESC, environment ASC LIMIT 20`,
    project.id,
  );
  const relRows = await prisma.$queryRawUnsafe<{ firstRelease: string }[]>(
    `SELECT "firstRelease" FROM "Issue" WHERE "projectId" = $1::uuid AND "firstRelease" IS NOT NULL
     GROUP BY "firstRelease" ORDER BY max("firstSeenAt") DESC, "firstRelease" ASC LIMIT 20`,
    project.id,
  );
  report(
    facets.environments.join() === envRows.map((r) => r.environment).join(),
    `facets.environments = ${facets.environments.join(', ')}`,
  );
  report(
    facets.releases.join() === relRows.map((r) => r.firstRelease).join(),
    `facets.releases = ${facets.releases.length} values (capped at 20), first: ${facets.releases[0]}`,
  );

  // A project with no data of its own: empty facets, no other project's values.
  const other = await repo.facets('00000000-0000-7000-8000-000000000000');
  report(
    other.environments.length === 0 && other.releases.length === 0,
    'facets of an unknown project are empty (no leak from other projects)',
  );
}

main()
  .catch((error: unknown) => {
    failed = true;
    console.error(error instanceof Error ? error.message : error);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exitCode = failed ? 1 : 0;
  });
