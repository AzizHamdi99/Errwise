import type { Issue, Prisma } from '@prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { IssuesRepository } from './issues.repository';

const PROJECT = 'project-1';
const ID = '0198f1a2-7b3c-7d4e-8f50-123456789abc';
const DATE = new Date('2026-11-20T15:42:10.000Z');

const rows = (count: number): Issue[] =>
  Array.from({ length: count }, (_, i) => ({ id: `row-${i}` }) as Issue);

/** Each call to findMany answers with the next entry of `answers` (an empty page when none is left). */
function setup(answers: Issue[][] = []) {
  const queries: Prisma.IssueFindManyArgs[] = [];
  const findMany = jest.fn((args: Prisma.IssueFindManyArgs) => {
    queries.push(args);
    return Promise.resolve<Issue[]>(answers[queries.length - 1] ?? []);
  });
  const prisma = { issue: { findMany } };
  const repo = new IssuesRepository(prisma as unknown as PrismaService);
  return { repo, findMany, queries };
}

describe('IssuesRepository.list', () => {
  it('always scopes by project, and orders by lastSeenAt then id by default', async () => {
    const { repo, findMany } = setup();
    await repo.list(PROJECT, { sort: 'lastSeen', limit: 25 });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { projectId: PROJECT },
      orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
      take: 26, // one more than the page: it tells the service there is a next page
    });
  });

  it.each([
    ['lastSeen', 'lastSeenAt'],
    ['firstSeen', 'firstSeenAt'],
    ['events', 'eventCount'],
  ] as const)(
    'sort "%s" orders by %s desc, then id desc',
    async (sort, column) => {
      const { repo, queries } = setup();
      await repo.list(PROJECT, { sort, limit: 25 });

      expect(queries[0].orderBy).toEqual([
        { [column]: 'desc' },
        { id: 'desc' },
      ]);
    },
  );

  // Guards the performance design. A single `value < X OR (value = X AND id < Y)` is not an
  // index range: inside a big tie group (most issues have the same event count) Postgres reads
  // from the start of the group and discards rows until it reaches the cursor.
  it.each([
    ['lastSeen', 'lastSeenAt', DATE],
    ['firstSeen', 'firstSeenAt', DATE],
    ['events', 'eventCount', 4242],
  ] as const)(
    'sort "%s": reads the tied rows, then the rows after, as two exact ranges',
    async (sort, column, value) => {
      const { repo, queries } = setup();
      await repo.list(PROJECT, { sort, limit: 25, cursor: { value, id: ID } });

      expect(queries).toEqual([
        {
          where: {
            projectId: PROJECT,
            AND: [{ [column]: value, id: { lt: ID } }],
          },
          orderBy: { id: 'desc' },
          take: 26,
        },
        {
          where: { projectId: PROJECT, AND: [{ [column]: { lt: value } }] },
          orderBy: [{ [column]: 'desc' }, { id: 'desc' }],
          take: 26, // nothing was tied, so the whole page still has to come from here
        },
      ]);
    },
  );

  it('stops after the tied rows when they fill the page', async () => {
    const { repo, findMany } = setup([rows(26)]);

    const result = await repo.list(PROJECT, {
      sort: 'events',
      limit: 25,
      cursor: { value: 10, id: ID },
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(26);
  });

  it('completes the page with the rows after, keeping the tied rows first', async () => {
    const tied = rows(3);
    const after = [{ id: 'after-1' }, { id: 'after-2' }] as Issue[];
    const { repo, queries } = setup([tied, after]);

    const result = await repo.list(PROJECT, {
      sort: 'events',
      limit: 25,
      cursor: { value: 10, id: ID },
    });

    expect(queries[1].take).toBe(23); // 26 wanted, 3 already read
    expect(result.map((issue) => issue.id)).toEqual([
      'row-0',
      'row-1',
      'row-2',
      'after-1',
      'after-2',
    ]);
  });

  it('keeps the project scope and every filter in both ranges', async () => {
    const { repo, queries } = setup();
    await repo.list(PROJECT, {
      sort: 'events',
      limit: 10,
      status: 'resolved',
      environment: 'production',
      search: 'timeout',
      cursor: { value: 7, id: ID },
    });

    expect(queries).toHaveLength(2);
    for (const { where, take } of queries) {
      expect(where?.projectId).toBe(PROJECT);
      expect(where?.status).toBe('resolved');
      expect(where?.environments).toEqual({
        some: { projectId: PROJECT, environment: 'production' },
      });
      expect(where?.title).toEqual({
        contains: 'timeout',
        mode: 'insensitive',
      });
      expect(take).toBe(11);
    }
  });

  describe('filters', () => {
    afterEach(() => jest.useRealTimers());

    it('maps each filter to its column; the release is the one the issue was first seen in', async () => {
      const { repo, queries } = setup();
      await repo.list(PROJECT, {
        sort: 'lastSeen',
        limit: 25,
        level: 'fatal',
        release: '1.4.0',
        regressed: true,
      });

      expect(queries[0].where).toEqual({
        projectId: PROJECT,
        level: 'fatal',
        firstRelease: '1.4.0',
        regressionCount: { gt: 0 },
      });
    });

    it('regressed=false is no condition at all, not "never regressed"', async () => {
      const { repo, queries } = setup();
      await repo.list(PROJECT, {
        sort: 'lastSeen',
        limit: 25,
        regressed: false,
      });

      expect(queries[0].where).toEqual({ projectId: PROJECT });
    });

    it.each([
      ['24h', 24 * 60 * 60 * 1000],
      ['7d', 7 * 24 * 60 * 60 * 1000],
    ] as const)('age %s: first seen since that long ago', async (age, ms) => {
      jest.useFakeTimers().setSystemTime(new Date('2026-11-21T12:00:00.000Z'));
      const { repo, queries } = setup();
      await repo.list(PROJECT, { sort: 'lastSeen', limit: 25, age });

      expect(queries[0].where?.firstSeenAt).toEqual({
        gte: new Date(new Date('2026-11-21T12:00:00.000Z').getTime() - ms),
      });
    });

    // The cursor of sort "firstSeen" and the age filter are both about firstSeenAt. If the cursor
    // condition were spread next to the filters, it would replace the age condition and page 2
    // would show issues older than the window.
    it('keeps the age filter on every page when sorting by first seen', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-11-21T12:00:00.000Z'));
      const { repo, queries } = setup();
      await repo.list(PROJECT, {
        sort: 'firstSeen',
        limit: 25,
        age: '24h',
        cursor: { value: DATE, id: ID },
      });

      expect(queries).toHaveLength(2);
      for (const { where } of queries) {
        expect(where?.firstSeenAt).toEqual({
          gte: new Date('2026-11-20T12:00:00.000Z'),
        });
        expect(where?.AND).toHaveLength(1); // the cursor condition, kept separate
      }
    });
  });

  it('searches for the text itself: % and _ are not wildcards', async () => {
    const { repo, queries } = setup();
    await repo.list(PROJECT, {
      sort: 'lastSeen',
      limit: 25,
      search: '100%_done',
    });

    expect(queries[0].where?.title).toEqual({
      contains: '100\\%\\_done',
      mode: 'insensitive',
    });
  });
});

describe('IssuesRepository.environmentsByIssue', () => {
  function setupEnvironments(rows: { issueId: string; environment: string }[]) {
    const findMany = jest.fn((args: Prisma.IssueEnvironmentFindManyArgs) => {
      void args;
      return Promise.resolve(rows);
    });
    const prisma = { issueEnvironment: { findMany } };
    const repo = new IssuesRepository(prisma as unknown as PrismaService);
    return { repo, findMany };
  }

  it('does not query for an empty page', async () => {
    const { repo, findMany } = setupEnvironments([]);

    expect((await repo.environmentsByIssue(PROJECT, [])).size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('reads the IssueEnvironment summary, scoped by project, in a stable order', async () => {
    const { repo, findMany } = setupEnvironments([]);
    await repo.environmentsByIssue(PROJECT, ['i1', 'i2']);

    expect(findMany).toHaveBeenCalledWith({
      where: { projectId: PROJECT, issueId: { in: ['i1', 'i2'] } },
      select: { issueId: true, environment: true },
      orderBy: { environment: 'asc' },
    });
  });

  it('groups the environments by issue', async () => {
    const { repo } = setupEnvironments([
      { issueId: 'i1', environment: 'production' },
      { issueId: 'i2', environment: 'production' },
      { issueId: 'i1', environment: 'staging' },
    ]);

    const result = await repo.environmentsByIssue(PROJECT, ['i1', 'i2', 'i3']);

    expect(result.get('i1')).toEqual(['production', 'staging']);
    expect(result.get('i2')).toEqual(['production']);
    expect(result.has('i3')).toBe(false); // the service falls back to []
  });
});

describe('IssuesRepository.hourlyCounts', () => {
  const SINCE = new Date('2026-11-20T13:00:00.000Z');

  function setupHourly(rows: unknown[] = []) {
    // $queryRaw is used as a tagged template: (strings, ...values)
    const queryRaw = jest.fn(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        void strings;
        void values;
        return Promise.resolve(rows);
      },
    );
    const repo = new IssuesRepository({
      $queryRaw: queryRaw,
    } as unknown as PrismaService);
    return { repo, queryRaw };
  }

  it('does not query for an empty page', async () => {
    const { repo, queryRaw } = setupHourly();

    expect(await repo.hourlyCounts(PROJECT, [], SINCE)).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('asks for the whole page in ONE query, scoped by project, with every value bound', async () => {
    const rows = [{ issueId: 'i1', bucket: SINCE, count: 3 }];
    const { repo, queryRaw } = setupHourly(rows);

    const result = await repo.hourlyCounts(PROJECT, ['i1', 'i2'], SINCE);

    expect(result).toBe(rows);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = queryRaw.mock.calls[0];
    // projectId, the ids and the start of the window travel as parameters, never as text
    expect(values).toEqual([PROJECT, ['i1', 'i2'], SINCE]);
    const sql = strings.join('?');
    expect(sql).toContain(`date_trunc('hour', "timestamp", 'UTC')`);
    expect(sql).toContain('"projectId" =');
    expect(sql).toContain('GROUP BY');
  });
});

describe('IssuesRepository.facets', () => {
  function setupFacets(
    environments: { environment: string }[],
    releases: { firstRelease: string | null }[],
  ) {
    const environmentGroupBy = jest.fn((args: unknown) => {
      void args;
      return Promise.resolve(environments);
    });
    const releaseGroupBy = jest.fn((args: unknown) => {
      void args;
      return Promise.resolve(releases);
    });
    const prisma = {
      issueEnvironment: { groupBy: environmentGroupBy },
      issue: { groupBy: releaseGroupBy },
    };
    const repo = new IssuesRepository(prisma as unknown as PrismaService);
    return { repo, environmentGroupBy, releaseGroupBy };
  }

  it('returns the environments and releases, in the order the queries give them', async () => {
    const { repo } = setupFacets(
      [{ environment: 'production' }, { environment: 'staging' }],
      [{ firstRelease: '1.5.0' }, { firstRelease: '1.4.0' }],
    );

    expect(await repo.facets(PROJECT)).toEqual({
      environments: ['production', 'staging'],
      releases: ['1.5.0', '1.4.0'],
    });
  });

  it('scopes both queries by project, and caps them', async () => {
    const { repo, environmentGroupBy, releaseGroupBy } = setupFacets([], []);
    await repo.facets(PROJECT);

    expect(environmentGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: PROJECT }, take: 20 }),
    );
    expect(releaseGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: PROJECT, firstRelease: { not: null } },
        take: 20,
      }),
    );
  });

  it('never returns a null release', async () => {
    const { repo } = setupFacets(
      [],
      [{ firstRelease: null }, { firstRelease: '2.0.0' }],
    );

    expect((await repo.facets(PROJECT)).releases).toEqual(['2.0.0']);
  });
});

describe('IssuesRepository status updates', () => {
  const NOW = new Date('2026-11-21T12:00:00.000Z');

  function setupUpdates(
    count: number,
    row: Partial<Issue> | null = { id: 'i1' },
  ) {
    const updateMany = jest.fn((args: Prisma.IssueUpdateManyArgs) => {
      void args;
      return Promise.resolve({ count });
    });
    const findFirst = jest.fn((args: Prisma.IssueFindFirstArgs) => {
      void args;
      return Promise.resolve(row as Issue | null);
    });
    const repo = new IssuesRepository({
      issue: { updateMany, findFirst },
    } as unknown as PrismaService);
    return { repo, updateMany, findFirst };
  }

  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  describe('bulkUpdateStatus', () => {
    it('updates only this project, only the given ids, and skips issues that already have the status', async () => {
      const { repo, updateMany } = setupUpdates(2);

      const changed = await repo.bulkUpdateStatus(
        PROJECT,
        ['a', 'b'],
        'ignored',
      );

      expect(changed).toBe(2);
      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          projectId: PROJECT,
          id: { in: ['a', 'b'] },
          status: { not: 'ignored' },
        },
        data: { status: 'ignored', resolvedAt: null },
      });
    });

    it('remembers when an issue was resolved, and forgets it when it is reopened', async () => {
      const { repo, updateMany } = setupUpdates(1);

      await repo.bulkUpdateStatus(PROJECT, ['a'], 'resolved');
      await repo.bulkUpdateStatus(PROJECT, ['a'], 'unresolved');

      expect(updateMany.mock.calls[0][0].data).toEqual({
        status: 'resolved',
        resolvedAt: NOW,
      });
      expect(updateMany.mock.calls[1][0].data).toEqual({
        status: 'unresolved',
        resolvedAt: null,
      });
    });

    it('answers 0 when nothing matched (ids of another project, or all already in that status)', async () => {
      const { repo } = setupUpdates(0);

      expect(
        await repo.bulkUpdateStatus(PROJECT, ['foreign'], 'resolved'),
      ).toBe(0);
    });
  });

  describe('updateStatus', () => {
    it('is scoped by project and returns the updated row', async () => {
      const row = { id: 'i1', status: 'resolved' };
      const { repo, updateMany, findFirst } = setupUpdates(1, row);

      expect(await repo.updateStatus(PROJECT, 'i1', 'resolved')).toBe(row);
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'i1', projectId: PROJECT },
        data: { status: 'resolved', resolvedAt: NOW },
      });
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'i1', projectId: PROJECT },
      });
    });

    it('changes nothing and reads nothing for an issue of another project', async () => {
      const { repo, findFirst } = setupUpdates(0);

      expect(
        await repo.updateStatus(PROJECT, 'foreign', 'resolved'),
      ).toBeNull();
      expect(findFirst).not.toHaveBeenCalled();
    });
  });
});
