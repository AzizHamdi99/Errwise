import { NotFoundException } from '@nestjs/common';
import type { Issue } from '@prisma/client';
import type { ProjectsService } from '../projects/projects.service';
import type { StatsRepository, TimeSpan } from './stats.repository';
import { StatsService } from './stats.service';

const NOW = new Date('2026-11-20T15:42:10.000Z');

function setup() {
  const repo = {
    countEvents: jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(4),
    countUnresolvedIssues: jest.fn().mockResolvedValue(3),
    countNewIssues: jest.fn().mockResolvedValue(2),
    countRegressedIssues: jest.fn().mockResolvedValue(1),
    eventsByBucketAndLevel: jest.fn().mockResolvedValue([]),
    eventsByEnvironment: jest
      .fn()
      .mockResolvedValue([{ environment: 'production', count: 10 }]),
    topIssueCounts: jest.fn().mockResolvedValue([]),
    findIssues: jest.fn().mockResolvedValue([]),
  };
  const projects = { get: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const service = new StatsService(
    repo as unknown as StatsRepository,
    projects as unknown as ProjectsService,
  );
  return { service, repo, projects };
}

describe('StatsService.projectOverview', () => {
  it('answers 404 for a project of another organization and reads nothing', async () => {
    const { service, repo, projects } = setup();
    projects.get.mockRejectedValue(new NotFoundException());

    await expect(
      service.projectOverview('other-org', 'p1', '7d', NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.countEvents).not.toHaveBeenCalled();
    expect(repo.eventsByBucketAndLevel).not.toHaveBeenCalled();
  });

  it('builds the cards, the zero-filled series and the environments', async () => {
    const { service } = setup();
    const result = await service.projectOverview('org', 'p1', '7d', NOW);

    expect(result.cards).toEqual({
      events: 10,
      eventsPrevious: 4,
      unresolved: 3,
      newIssues: 2,
      regressedIssues: 1,
    });
    expect(result.series).toHaveLength(7);
    expect(result.environments).toEqual([
      { environment: 'production', count: 10 },
    ]);
    expect(result.from).toBe('2026-11-14T00:00:00.000Z');
    expect(result.to).toBe('2026-11-21T00:00:00.000Z');
  });

  it('scopes every query to the project and asks issues only for the counted ids', async () => {
    const { service, repo } = setup();
    repo.topIssueCounts.mockResolvedValue([
      { issueId: 'i1', count: 7 },
      { issueId: 'gone', count: 3 },
    ]);
    repo.findIssues.mockResolvedValue([
      {
        id: 'i1',
        title: 'TypeError: x',
        type: 'TypeError',
        level: 'error',
        status: 'unresolved',
        lastSeenAt: new Date('2026-11-20T10:00:00.000Z'),
      } as Issue,
    ]);

    const result = await service.projectOverview('org', 'p1', '7d', NOW);

    expect(repo.findIssues).toHaveBeenCalledWith('p1', ['i1', 'gone']);
    for (const fn of [
      repo.countEvents,
      repo.eventsByEnvironment,
      repo.topIssueCounts,
    ]) {
      const calls = fn.mock.calls as unknown[][];
      expect(calls.every((call) => call[0] === 'p1')).toBe(true);
    }
    // An issue that no longer exists is dropped, not returned half-empty.
    expect(result.topIssues).toEqual([
      {
        id: 'i1',
        title: 'TypeError: x',
        type: 'TypeError',
        level: 'error',
        status: 'unresolved',
        count: 7,
        lastSeenAt: '2026-11-20T10:00:00.000Z',
      },
    ]);
  });

  it('uses the previous window of the same length for the delta', async () => {
    const { service, repo } = setup();
    await service.projectOverview('org', 'p1', '24h', NOW);

    const calls = repo.countEvents.mock.calls as [string, TimeSpan][];
    const [current, previous] = calls.map((call) => call[1]);
    expect(previous.to.getTime()).toBe(current.from.getTime());
    expect(current.to.getTime() - current.from.getTime()).toBe(
      previous.to.getTime() - previous.from.getTime(),
    );
  });
});
