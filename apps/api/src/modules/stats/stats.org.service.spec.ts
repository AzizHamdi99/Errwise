import type { ProjectsService } from '../projects/projects.service';
import type { IssueWithProject, StatsRepository } from './stats.repository';
import { StatsService } from './stats.service';

const NOW = new Date('2026-11-20T15:42:10.000Z');

function setup() {
  const repo = {
    countEventsInOrg: jest
      .fn()
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(12),
    countUnresolvedIssuesInOrg: jest.fn().mockResolvedValue(5),
    countNewIssuesInOrg: jest.fn().mockResolvedValue(3),
    countRegressedIssuesInOrg: jest.fn().mockResolvedValue(1),
    eventsByBucketAndProject: jest.fn().mockResolvedValue([]),
    eventCountsByProject: jest.fn().mockResolvedValue([]),
    unresolvedCountsByProject: jest.fn().mockResolvedValue([]),
    topIssueCountsInOrg: jest.fn().mockResolvedValue([]),
    findIssuesInOrg: jest.fn().mockResolvedValue([]),
  };
  const projects = {
    list: jest.fn().mockResolvedValue([
      { id: 'p1', name: 'Web' },
      { id: 'p2', name: 'Api' },
      { id: 'p3', name: 'Admin' },
    ]),
  };
  const service = new StatsService(
    repo as unknown as StatsRepository,
    projects as unknown as ProjectsService,
  );
  return { service, repo, projects };
}

describe('StatsService.orgOverview', () => {
  it('scopes every read to the organization it was given', async () => {
    const { service, repo, projects } = setup();
    await service.orgOverview('org-1', '7d', NOW);

    expect(projects.list).toHaveBeenCalledWith('org-1');
    for (const fn of Object.values(repo)) {
      const calls = fn.mock.calls as unknown[][];
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((call) => call[0] === 'org-1')).toBe(true);
    }
  });

  it('sums the cards and compares with the previous window', async () => {
    const { service } = setup();
    const result = await service.orgOverview('org-1', '7d', NOW);

    expect(result.cards).toEqual({
      events: 30,
      eventsPrevious: 12,
      unresolved: 5,
      newIssues: 3,
      regressedIssues: 1,
    });
    expect(result.series).toHaveLength(7);
  });

  it('lists every project, busiest first, with zero-event projects and name as tie-break', async () => {
    const { service, repo } = setup();
    repo.eventCountsByProject.mockResolvedValue([
      { projectId: 'p2', count: 20 },
      { projectId: 'p1', count: 10 },
    ]);
    repo.unresolvedCountsByProject.mockResolvedValue([
      { projectId: 'p2', count: 4 },
    ]);

    const result = await service.orgOverview('org-1', '7d', NOW);

    expect(result.projects).toEqual([
      { id: 'p2', name: 'Api', events: 20, unresolved: 4 },
      { id: 'p1', name: 'Web', events: 10, unresolved: 0 },
      { id: 'p3', name: 'Admin', events: 0, unresolved: 0 },
    ]);
  });

  it('puts the project on each top issue and drops an issue that is gone', async () => {
    const { service, repo } = setup();
    repo.topIssueCountsInOrg.mockResolvedValue([
      { issueId: 'i1', count: 8 },
      { issueId: 'gone', count: 2 },
    ]);
    repo.findIssuesInOrg.mockResolvedValue([
      {
        id: 'i1',
        title: 'TypeError: x',
        type: 'TypeError',
        level: 'error',
        status: 'unresolved',
        lastSeenAt: new Date('2026-11-20T10:00:00.000Z'),
        project: { id: 'p2', name: 'Api' },
      } as IssueWithProject,
    ]);

    const result = await service.orgOverview('org-1', '7d', NOW);

    expect(repo.findIssuesInOrg).toHaveBeenCalledWith('org-1', ['i1', 'gone']);
    expect(result.topIssues).toEqual([
      {
        id: 'i1',
        title: 'TypeError: x',
        type: 'TypeError',
        level: 'error',
        status: 'unresolved',
        count: 8,
        lastSeenAt: '2026-11-20T10:00:00.000Z',
        projectId: 'p2',
        projectName: 'Api',
      },
    ]);
  });

  it('is empty but well formed for an organization without projects', async () => {
    const { service, projects } = setup();
    projects.list.mockResolvedValue([]);
    const result = await service.orgOverview('org-1', '24h', NOW);

    expect(result.projects).toEqual([]);
    expect(result.topIssues).toEqual([]);
    expect(result.series).toHaveLength(24);
  });
});
