import { NotFoundException } from '@nestjs/common';
import type { ProjectsService } from '../projects/projects.service';
import type { StatsRepository } from './stats.repository';
import { StatsService } from './stats.service';

const NOW = new Date('2026-11-20T15:42:10.000Z');

function setup() {
  const repo = {
    releaseActivity: jest.fn().mockResolvedValue([]),
    newIssuesByRelease: jest.fn().mockResolvedValue([]),
  };
  const projects = { get: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const service = new StatsService(
    repo as unknown as StatsRepository,
    projects as unknown as ProjectsService,
  );
  return { service, repo, projects };
}

const activity = (release: string | null, events: number, day: number) => ({
  release,
  events,
  firstSeenAt: new Date(`2026-11-${day - 1}T08:00:00.000Z`),
  lastSeenAt: new Date(`2026-11-${day}T08:00:00.000Z`),
});

describe('StatsService.releases', () => {
  it('answers 404 for a project of another organization and reads nothing', async () => {
    const { service, repo, projects } = setup();
    projects.get.mockRejectedValue(new NotFoundException());

    await expect(
      service.releases('other-org', 'p1', '30d', NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.releaseActivity).not.toHaveBeenCalled();
    expect(repo.newIssuesByRelease).not.toHaveBeenCalled();
  });

  it('is empty but well formed for a project without events', async () => {
    const { service } = setup();
    const result = await service.releases('org', 'p1', '30d', NOW);

    expect(result.releases).toEqual([]);
    expect(result.from).toBe('2026-10-22T00:00:00.000Z');
    expect(result.to).toBe('2026-11-21T00:00:00.000Z');
  });

  it('joins new issues to their release and keeps the order of the repository', async () => {
    const { service, repo } = setup();
    repo.releaseActivity.mockResolvedValue([
      activity('1.3.0', 40, 20),
      activity('1.2.0', 12, 15),
    ]);
    repo.newIssuesByRelease.mockResolvedValue([
      { release: '1.3.0', count: 3 },
      { release: '1.1.0', count: 9 }, // not in the list: ignored
    ]);

    const result = await service.releases('org', 'p1', '30d', NOW);

    expect(result.releases).toEqual([
      {
        release: '1.3.0',
        events: 40,
        newIssues: 3,
        firstSeenAt: '2026-11-19T08:00:00.000Z',
        lastSeenAt: '2026-11-20T08:00:00.000Z',
      },
      {
        release: '1.2.0',
        events: 12,
        newIssues: 0,
        firstSeenAt: '2026-11-14T08:00:00.000Z',
        lastSeenAt: '2026-11-15T08:00:00.000Z',
      },
    ]);
  });

  it('keeps events without a release as their own null group', async () => {
    const { service, repo } = setup();
    repo.releaseActivity.mockResolvedValue([activity(null, 5, 18)]);
    repo.newIssuesByRelease.mockResolvedValue([{ release: null, count: 2 }]);

    const result = await service.releases('org', 'p1', '7d', NOW);

    expect(result.releases).toHaveLength(1);
    expect(result.releases[0]).toMatchObject({
      release: null,
      events: 5,
      newIssues: 2,
    });
  });

  it('scopes both reads to the project and the same span', async () => {
    const { service, repo } = setup();
    await service.releases('org', 'p1', '14d', NOW);

    const activityCall = repo.releaseActivity.mock.calls[0] as unknown[];
    const issuesCall = repo.newIssuesByRelease.mock.calls[0] as unknown[];
    expect(activityCall[0]).toBe('p1');
    expect(issuesCall[0]).toBe('p1');
    expect(activityCall[1]).toEqual(issuesCall[1]);
  });
});
