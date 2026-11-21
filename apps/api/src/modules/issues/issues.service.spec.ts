import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Issue } from '@prisma/client';
import type { BulkUpdateIssuesInput } from '@errwise/shared';
import type { ProjectsService } from '../projects/projects.service';
import { decodeCursor, encodeCursor } from './issues.cursor';
import type { IssuesRepository } from './issues.repository';
import { IssuesService } from './issues.service';

const ID = (n: number) =>
  `0198f1a2-7b3c-7d4e-8f50-${String(n).padStart(12, '0')}`;

function issue(n: number, lastSeenAt: Date): Issue {
  return {
    id: ID(n),
    projectId: 'p1',
    title: `Error: boom ${n}`,
    type: 'Error',
    level: 'error',
    status: 'unresolved',
    eventCount: 1,
    firstSeenAt: lastSeenAt,
    lastSeenAt,
    firstRelease: null,
    lastRelease: null,
    resolvedAt: null,
    githubIssueNumber: null,
    githubIssueUrl: null,
  } as Issue;
}

function setup() {
  const repo = {
    list: jest.fn().mockResolvedValue([]),
    facets: jest
      .fn()
      .mockResolvedValue({ environments: ['production'], releases: ['1.0.0'] }),
    environmentsByIssue: jest.fn().mockResolvedValue(new Map()),
    hourlyCounts: jest.fn().mockResolvedValue([]),
    findInProject: jest.fn(),
    updateStatus: jest.fn(),
    bulkUpdateStatus: jest.fn().mockResolvedValue(0),
  };
  const projects = { get: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const service = new IssuesService(
    repo as unknown as IssuesRepository,
    projects as unknown as ProjectsService,
  );
  return { service, repo, projects };
}

describe('IssuesService.list', () => {
  it('answers 404 for a project of another organization and reads nothing', async () => {
    const { service, repo, projects } = setup();
    projects.get.mockRejectedValue(new NotFoundException());

    await expect(
      service.list('other-org', 'p1', { sort: 'lastSeen', limit: 25 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it('answers 400 for a cursor it cannot read, before querying', async () => {
    const { service, repo } = setup();

    await expect(
      service.list('org', 'p1', {
        sort: 'lastSeen',
        limit: 25,
        cursor: 'garbage',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it('passes every filter to the repository', async () => {
    const { service, repo } = setup();

    await service.list('org', 'p1', {
      sort: 'lastSeen',
      limit: 25,
      status: 'unresolved',
      environment: 'production',
      level: 'error',
      release: '1.4.0',
      regressed: true,
      age: '7d',
      search: 'timeout',
    });

    expect(repo.list).toHaveBeenCalledWith('p1', {
      status: 'unresolved',
      environment: 'production',
      level: 'error',
      release: '1.4.0',
      regressed: true,
      age: '7d',
      search: 'timeout',
      sort: 'lastSeen',
      cursor: undefined,
      limit: 25,
    });
  });

  it('passes the decoded cursor to the repository', async () => {
    const { service, repo } = setup();
    const lastSeenAt = new Date('2026-11-20T10:00:00.000Z');

    await service.list('org', 'p1', {
      sort: 'lastSeen',
      limit: 25,
      cursor: encodeCursor('lastSeen', {
        id: ID(7),
        lastSeenAt,
        firstSeenAt: lastSeenAt,
        eventCount: 1,
      }),
    });

    expect(repo.list).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        cursor: { value: lastSeenAt, id: ID(7) },
        limit: 25,
      }),
    );
  });

  it('reads the environments of the returned page only, scoped by project', async () => {
    const { service, repo } = setup();
    const t = new Date('2026-11-20T10:00:00.000Z');
    repo.list.mockResolvedValue([issue(3, t), issue(2, t), issue(1, t)]);
    repo.environmentsByIssue.mockResolvedValue(
      new Map([[ID(3), ['production', 'staging']]]),
    );

    const page = await service.list('org', 'p1', {
      sort: 'lastSeen',
      limit: 2,
    });

    // the extra row (id 1) only proves there is a next page: no need to look it up
    expect(repo.environmentsByIssue).toHaveBeenCalledWith('p1', [ID(3), ID(2)]);
    expect(page.items[0].environments).toEqual(['production', 'staging']);
    expect(page.items[1].environments).toEqual([]);
  });

  it('gives each issue of the page a 24-hour trend, read in one query for the page', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-21T12:34:56.000Z'));
    try {
      const { service, repo } = setup();
      const t = new Date('2026-11-21T12:00:00.000Z');
      repo.list.mockResolvedValue([issue(3, t), issue(2, t), issue(1, t)]);
      // the current hour is the last bucket of the window
      repo.hourlyCounts.mockResolvedValue([
        {
          issueId: ID(3),
          bucket: new Date('2026-11-21T12:00:00.000Z'),
          count: 7,
        },
        {
          issueId: ID(2),
          bucket: new Date('2026-11-20T13:00:00.000Z'),
          count: 2,
        },
      ]);

      const page = await service.list('org', 'p1', {
        sort: 'lastSeen',
        limit: 2,
      });

      expect(repo.hourlyCounts).toHaveBeenCalledTimes(1);
      // the extra row only proves there is a next page: it gets no lookup
      expect(repo.hourlyCounts).toHaveBeenCalledWith(
        'p1',
        [ID(3), ID(2)],
        new Date('2026-11-20T13:00:00.000Z'),
      );
      expect(page.items[0].trend24h).toHaveLength(24);
      expect(page.items[0].trend24h[23]).toBe(7);
      expect(page.items[1].trend24h[0]).toBe(2);
      expect(page.items[1].trend24h.reduce((a, b) => a + b, 0)).toBe(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('gives an issue with no recent event a trend of zeros, never undefined', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValue([issue(1, new Date())]);

    const page = await service.list('org', 'p1', {
      sort: 'lastSeen',
      limit: 25,
    });

    expect(page.items[0].trend24h).toEqual(new Array(24).fill(0));
  });

  it('returns no cursor on the last page', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValue([issue(1, new Date()), issue(2, new Date())]);

    const page = await service.list('org', 'p1', {
      sort: 'lastSeen',
      limit: 2,
    });

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it('drops the extra row, and the cursor points at the last row that is returned', async () => {
    const { service, repo } = setup();
    const t = new Date('2026-11-20T10:00:00.000Z');
    // limit 2 -> the repository returns 3 rows; the third only proves there is a next page
    repo.list.mockResolvedValue([issue(3, t), issue(2, t), issue(1, t)]);

    const page = await service.list('org', 'p1', {
      sort: 'lastSeen',
      limit: 2,
    });

    expect(page.items.map((item) => item.id)).toEqual([ID(3), ID(2)]);
    expect(decodeCursor(page.nextCursor!, 'lastSeen')).toEqual({
      value: t,
      id: ID(2),
    });
  });

  it('answers 400 for a cursor made for another sort, before querying', async () => {
    const { service, repo } = setup();
    const t = new Date('2026-11-20T10:00:00.000Z');
    const lastSeenCursor = encodeCursor('lastSeen', {
      id: ID(7),
      lastSeenAt: t,
      firstSeenAt: t,
      eventCount: 1,
    });

    await expect(
      service.list('org', 'p1', {
        sort: 'events',
        limit: 25,
        cursor: lastSeenCursor,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.list).not.toHaveBeenCalled();
  });

  it('sorts by the requested sort, and the next cursor holds that sort value', async () => {
    const { service, repo } = setup();
    const t = new Date('2026-11-20T10:00:00.000Z');
    const withCount = (n: number, eventCount: number) => ({
      ...issue(n, t),
      eventCount,
    });
    repo.list.mockResolvedValue([
      withCount(3, 900),
      withCount(2, 500),
      withCount(1, 100),
    ]);

    const page = await service.list('org', 'p1', { sort: 'events', limit: 2 });

    expect(repo.list).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ sort: 'events' }),
    );
    expect(decodeCursor(page.nextCursor!, 'events')).toEqual({
      value: 500,
      id: ID(2),
    });
  });
});

describe('IssuesService.facets', () => {
  it('answers 404 for a project of another organization and reads nothing', async () => {
    const { service, repo, projects } = setup();
    projects.get.mockRejectedValue(new NotFoundException());

    await expect(service.facets('other-org', 'p1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.facets).not.toHaveBeenCalled();
  });

  it('returns the facets of that project', async () => {
    const { service, repo } = setup();

    expect(await service.facets('org', 'p1')).toEqual({
      environments: ['production'],
      releases: ['1.0.0'],
    });
    expect(repo.facets).toHaveBeenCalledWith('p1');
  });
});

describe('IssuesService.bulkUpdateStatus', () => {
  const body: BulkUpdateIssuesInput = {
    issueIds: [ID(1), ID(2), ID(3)],
    status: 'resolved',
  };

  it('answers 404 for a project of another organization and changes nothing', async () => {
    const { service, repo, projects } = setup();
    projects.get.mockRejectedValue(new NotFoundException());

    await expect(
      service.bulkUpdateStatus('other-org', 'p1', body),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.bulkUpdateStatus).not.toHaveBeenCalled();
  });

  it('changes the ids in that project and says how many really changed', async () => {
    const { service, repo } = setup();
    repo.bulkUpdateStatus.mockResolvedValue(2);

    const result = await service.bulkUpdateStatus('org', 'p1', body);

    expect(repo.bulkUpdateStatus).toHaveBeenCalledWith(
      'p1',
      [ID(1), ID(2), ID(3)],
      'resolved',
    );
    // 3 asked, 2 changed: one was already resolved or is not in this project. No error either way.
    expect(result).toEqual({ updated: 2 });
  });

  it('gives the same answer for ids that exist elsewhere and ids that exist nowhere', async () => {
    const { service, repo } = setup();
    repo.bulkUpdateStatus.mockResolvedValue(0);

    // nothing in the answer tells "this id is in another organization" from "no such id"
    await expect(service.bulkUpdateStatus('org', 'p1', body)).resolves.toEqual({
      updated: 0,
    });
  });
});

describe('IssuesService.updateStatus', () => {
  const input = { status: 'resolved' } as const;

  it('updates inside the project and returns the issue', async () => {
    const { service, repo } = setup();
    const t = new Date('2026-11-20T10:00:00.000Z');
    repo.findInProject.mockResolvedValue(issue(1, t));
    repo.updateStatus.mockResolvedValue({ ...issue(1, t), status: 'resolved' });

    const result = await service.updateStatus('org', 'p1', ID(1), input);

    expect(repo.updateStatus).toHaveBeenCalledWith('p1', ID(1), 'resolved');
    expect(result.status).toBe('resolved');
  });

  it('does not write when the issue already has that status', async () => {
    const { service, repo } = setup();
    repo.findInProject.mockResolvedValue({
      ...issue(1, new Date()),
      status: 'resolved',
    });

    await service.updateStatus('org', 'p1', ID(1), input);

    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('answers 404 for an issue of another project', async () => {
    const { service, repo } = setup();
    repo.findInProject.mockResolvedValue(null);

    await expect(
      service.updateStatus('org', 'p1', ID(1), input),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('answers 404 when the issue disappears between the check and the update', async () => {
    const { service, repo } = setup();
    repo.findInProject.mockResolvedValue(issue(1, new Date()));
    repo.updateStatus.mockResolvedValue(null);

    await expect(
      service.updateStatus('org', 'p1', ID(1), input),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
