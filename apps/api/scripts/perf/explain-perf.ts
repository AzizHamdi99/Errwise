/**
 * Runs EXPLAIN (ANALYZE, BUFFERS) for the issue list queries against the perf dataset.
 *
 *   yarn workspace @errwise/api exec tsx scripts/perf/explain-perf.ts            # all queries
 *   yarn workspace @errwise/api exec tsx scripts/perf/explain-perf.ts search     # names containing "search"
 *   ... explain-perf.ts --plan                                                    # also print full plans
 *
 * The SQL below mirrors what Prisma generates in IssuesRepository.list (checked with the
 * `query` log event), with the same shape: EXISTS for the environment filter, ILIKE for the
 * search, and the OR form for the cursor. Update it together with the repository.
 */
import { createPerfClient, PERF_PROJECT_SLUG } from './perf-guard';

const prisma = createPerfClient();
const showPlan = process.argv.includes('--plan');
const filter = process.argv.slice(2).find((arg) => !arg.startsWith('--'));

interface Cursor {
  value: Date | number;
  id: string;
}

/** The three sorts of the list, with the SQL type of their column. */
const SORTS = {
  lastSeen: { column: 'lastSeenAt', cast: 'timestamptz' },
  firstSeen: { column: 'firstSeenAt', cast: 'timestamptz' },
  events: { column: 'eventCount', cast: 'int' },
} as const;
type SortName = keyof typeof SORTS;

interface Case {
  name: string;
  sql: string;
  params: unknown[];
}

const ISSUE_COLUMNS = `i.*`;

/**
 * A page after a cursor is two queries (see IssuesRepository.list): "tied" reads the rows that
 * share the cursor's value with a smaller id, "rest" the rows with a smaller value.
 */
type Part = 'first' | 'tied' | 'rest';

function listSql(where: string, part: Part, sort: SortName): string {
  const { column, cast } = SORTS[sort];
  const base = `SELECT ${ISSUE_COLUMNS} FROM "Issue" i
    WHERE i."projectId" = $1::uuid ${where}`;
  if (part === 'tied') {
    return `${base} AND i."${column}" = $CURSOR_VAL::${cast} AND i.id < $CURSOR_ID::uuid
      ORDER BY i.id DESC LIMIT 26`;
  }
  const after =
    part === 'rest' ? `AND i."${column}" < $CURSOR_VAL::${cast}` : '';
  return `${base} ${after} ORDER BY i."${column}" DESC, i.id DESC LIMIT 26`;
}

/** Numbers the placeholders so each case only lists the parameters it really uses. */
function bind(
  template: string,
  projectId: string,
  extra: unknown[],
  cursor?: Cursor,
): { sql: string; params: unknown[] } {
  const params: unknown[] = [projectId, ...extra];
  let sql = template;
  if (cursor) {
    params.push(cursor.value, cursor.id);
    const n = params.length;
    sql = sql
      .replaceAll('$CURSOR_VAL', `$${n - 1}`)
      .replaceAll('$CURSOR_ID', `$${n}`);
  }
  return { sql, params };
}

async function cursorAfter(
  projectId: string,
  status: string | null,
  skip: number,
  sort: SortName = 'lastSeen',
): Promise<Cursor> {
  const { column } = SORTS[sort];
  const [row] = await prisma.$queryRawUnsafe<Cursor[]>(
    `SELECT "${column}" AS value, id FROM "Issue"
     WHERE "projectId" = $1::uuid AND ($2::text IS NULL OR status = $2)
     ORDER BY "${column}" DESC, id DESC OFFSET $3 LIMIT 1`,
    projectId,
    status,
    skip,
  );
  return row;
}

async function buildCases(projectId: string): Promise<Case[]> {
  const page2 = await cursorAfter(projectId, 'unresolved', 24);
  const deep = await cursorAfter(projectId, 'unresolved', 20_000);
  const deepAll = await cursorAfter(projectId, null, 30_000);
  const deepFirstSeen = await cursorAfter(
    projectId,
    'unresolved',
    20_000,
    'firstSeen',
  );
  const deepEvents = await cursorAfter(
    projectId,
    'unresolved',
    20_000,
    'events',
  );
  const deepEventsAll = await cursorAfter(projectId, null, 30_000, 'events');

  const firstPage = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Issue" WHERE "projectId" = $1::uuid AND status = 'unresolved'
     ORDER BY "lastSeenAt" DESC, id DESC LIMIT 25`,
    projectId,
  );
  const hotPage = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Issue" WHERE "projectId" = $1::uuid
     ORDER BY "eventCount" DESC, id DESC LIMIT 25`,
    projectId,
  );

  const envsSql = `SELECT ie."issueId", ie.environment FROM "IssueEnvironment" ie
    WHERE ie."projectId" = $1::uuid AND ie."issueId" = ANY($2::uuid[])
    ORDER BY ie.environment`;

  const listCases: [
    string,
    string,
    unknown[],
    Cursor | undefined,
    SortName?,
  ][] = [
    // ISSUE-7 filters, on the default tab (unresolved). Each mirrors one Prisma where clause.
    [
      'list: level=warning (10% of unresolved)',
      `AND i.status = $2 AND i.level = $3`,
      ['unresolved', 'warning'],
      undefined,
    ],
    [
      'list: level=fatal (no unresolved issue is fatal: worst case)',
      `AND i.status = $2 AND i.level = $3`,
      ['unresolved', 'fatal'],
      undefined,
    ],
    [
      'list: release=v1.7 (common, 5%)',
      `AND i.status = $2 AND i."firstRelease" = $3`,
      ['unresolved', 'v1.7'],
      undefined,
    ],
    [
      'list: release=v2.0-beta (50 issues)',
      `AND i.status = $2 AND i."firstRelease" = $3`,
      ['unresolved', 'v2.0-beta'],
      undefined,
    ],
    [
      'list: release=v9.9-rare (1 issue)',
      `AND i.status = $2 AND i."firstRelease" = $3`,
      ['unresolved', 'v9.9-rare'],
      undefined,
    ],
    [
      'list: regressed (1%)',
      `AND i.status = $2 AND i."regressionCount" > 0`,
      ['unresolved'],
      undefined,
    ],
    [
      'list: age=24h (new issues)',
      `AND i.status = $2 AND i."firstSeenAt" >= now() - interval '24 hours'`,
      ['unresolved'],
      undefined,
    ],
    [
      'list: age=7d (new issues)',
      `AND i.status = $2 AND i."firstSeenAt" >= now() - interval '7 days'`,
      ['unresolved'],
      undefined,
    ],
    [
      'list: regressed + level=warning + release=v1.7',
      `AND i.status = $2 AND i."regressionCount" > 0 AND i.level = $3 AND i."firstRelease" = $4`,
      ['unresolved', 'warning', 'v1.7'],
      undefined,
    ],
    [
      'list: sort=firstSeen (unresolved, page 1)',
      `AND i.status = $2`,
      ['unresolved'],
      undefined,
      'firstSeen',
    ],
    [
      'list: sort=firstSeen, deep page (20 000 in)',
      `AND i.status = $2`,
      ['unresolved'],
      deepFirstSeen,
      'firstSeen',
    ],
    [
      'list: sort=events (unresolved, page 1)',
      `AND i.status = $2`,
      ['unresolved'],
      undefined,
      'events',
    ],
    [
      'list: sort=events, deep page (20 000 in)',
      `AND i.status = $2`,
      ['unresolved'],
      deepEvents,
      'events',
    ],
    ['list: sort=events, status=all (no index)', ``, [], undefined, 'events'],
    [
      'list: sort=events, status=all, deep (no index)',
      ``,
      [],
      deepEventsAll,
      'events',
    ],
    [
      'list: default (unresolved, page 1)',
      `AND i.status = $2`,
      ['unresolved'],
      undefined,
    ],
    [
      'list: page 2 (cursor, 25 rows in)',
      `AND i.status = $2`,
      ['unresolved'],
      page2,
    ],
    [
      'list: deep page (cursor, 20 000 rows in)',
      `AND i.status = $2`,
      ['unresolved'],
      deep,
    ],
    ['list: status=all', ``, [], undefined],
    ['list: status=all, deep page (cursor, 30 000 rows in)', ``, [], deepAll],
    [
      'list: env=staging (1% of events)',
      `AND i.status = $2 AND EXISTS (SELECT 1 FROM "IssueEnvironment" t0 WHERE t0."projectId" = $1::uuid AND t0.environment = $3 AND i.id = t0."issueId")`,
      ['unresolved', 'staging'],
      undefined,
    ],
    [
      'list: env=canary (rare: 3 issues)',
      `AND i.status = $2 AND EXISTS (SELECT 1 FROM "IssueEnvironment" t0 WHERE t0."projectId" = $1::uuid AND t0.environment = $3 AND i.id = t0."issueId")`,
      ['unresolved', 'canary'],
      undefined,
    ],
    [
      'list: search=timeout (common)',
      `AND i.status = $2 AND i.title ILIKE $3`,
      ['unresolved', '%timeout%'],
      undefined,
    ],
    [
      'list: search=zxqrare (rare)',
      `AND i.status = $2 AND i.title ILIKE $3`,
      ['unresolved', '%zxqrare%'],
      undefined,
    ],
    [
      'list: search=zxqrare, status=all',
      `AND i.title ILIKE $2`,
      ['%zxqrare%'],
      undefined,
    ],
  ];

  const cases: Case[] = listCases.flatMap(
    ([name, where, extra, cursor, sort]) => {
      const parts: [string, Part][] = cursor
        ? [
            [`${name} [1/2 tied with the cursor]`, 'tied'],
            [`${name} [2/2 after the cursor]`, 'rest'],
          ]
        : [[name, 'first']];
      return parts.map(([partName, part]) => {
        const { sql, params } = bind(
          listSql(where, part, sort ?? 'lastSeen'),
          projectId,
          extra,
          cursor,
        );
        return { name: partName, sql, params };
      });
    },
  );

  // The list's 24-hour trend: the same SQL as IssuesRepository.hourlyCounts.
  const trendSql = `SELECT "issueId", date_trunc('hour', "timestamp", 'UTC') AS bucket, COUNT(*)::int AS count
    FROM "Event"
    WHERE "projectId" = $1::uuid AND "issueId" = ANY($2::uuid[]) AND "timestamp" >= $3::timestamptz
    GROUP BY 1, 2`;
  const hourMs = 60 * 60 * 1000;
  const since24h = new Date(
    Math.floor(Date.now() / hourMs) * hourMs - 23 * hourMs,
  );
  const since30d = new Date(Date.now() - 30 * 24 * hourMs);

  cases.push(
    {
      name: 'trend: 24 h of a normal page (25 issues, 10 events each)',
      sql: trendSql,
      params: [projectId, firstPage.map((row) => row.id), since24h],
    },
    {
      name: 'trend: 24 h of a page with the 5 hot issues (100k events each, over 14 days)',
      sql: trendSql,
      params: [projectId, hotPage.map((row) => row.id), since24h],
    },
    {
      name: 'trend: SCALING, the hot page with a 30-day window (all 500k events)',
      sql: trendSql,
      params: [projectId, hotPage.map((row) => row.id), since30d],
    },
    {
      name: 'facets: environments of the project (count of issues, top 20)',
      sql: `SELECT ie.environment, count(*) AS issues FROM "IssueEnvironment" ie
        WHERE ie."projectId" = $1::uuid GROUP BY ie.environment
        ORDER BY issues DESC, ie.environment LIMIT 20`,
      params: [projectId],
    },
    {
      name: 'facets: releases of the project (newest first seen, top 20)',
      sql: `SELECT i."firstRelease", max(i."firstSeenAt") AS newest FROM "Issue" i
        WHERE i."projectId" = $1::uuid AND i."firstRelease" IS NOT NULL
        GROUP BY i."firstRelease" ORDER BY newest DESC, i."firstRelease" LIMIT 20`,
      params: [projectId],
    },
    {
      name: 'environmentsByIssue: a normal page (25 issues, 10 events each)',
      sql: envsSql,
      params: [projectId, firstPage.map((row) => row.id)],
    },
    {
      name: 'environmentsByIssue: a page with the 5 hot issues (100k events each)',
      sql: envsSql,
      params: [projectId, hotPage.map((row) => row.id)],
    },
  );
  return cases;
}

function summarize(lines: string[]): string {
  const find = (prefix: string) =>
    lines
      .find((line) => line.startsWith(prefix))
      ?.replace(prefix, '')
      .trim();
  return `planning ${find('Planning Time:')} | execution ${find('Execution Time:')}`;
}

async function main(): Promise<void> {
  const [project] = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT p.id FROM "Project" p WHERE p.slug = $1`,
    PERF_PROJECT_SLUG,
  );
  if (!project) throw new Error('Run seed-perf.ts first.');

  const cases = (await buildCases(project.id)).filter(
    (c) => !filter || c.name.includes(filter),
  );

  for (const c of cases) {
    const explain = `EXPLAIN (ANALYZE, BUFFERS) ${c.sql}`;
    await prisma.$queryRawUnsafe(explain, ...c.params); // warm the cache, so runs are comparable
    const rows = await prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
      explain,
      ...c.params,
    );
    const lines = rows.map((row) => row['QUERY PLAN']);

    console.log(`\n## ${c.name}\n${summarize(lines)}`);
    if (showPlan) console.log(lines.join('\n'));
    else {
      // The scan nodes are what we care about: what was read, and with which index.
      for (const line of lines) {
        if (/(Scan|Sort|Aggregate|Limit)/.test(line)) console.log(line.trim());
      }
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
