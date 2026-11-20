import { NotFoundException } from '@nestjs/common';
import type { Issue } from '@prisma/client';
import type { ProjectsService } from '../projects/projects.service';
import type { StatsRepository } from './stats.repository';
import { StatsService } from './stats.service';

const NOW = new Date('2026-11-20T15:42:10.000Z');

function setup() {
  const repo = {
    findIssues: jest.fn().mockResolvedValue([{ id: 'i1' } as Issue]),
    eventsByBucketAndLevel: jest.fn().mockResolvedValue([]),
    eventsByEnvironment: jest.fn().mockResolvedValue([]),
    eventsByRelease: jest.fn().mockResolvedValue([]),
  };
  const projects = { get: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const service = new StatsService(
    repo as unknown as StatsRepository,
    projects as unknown as ProjectsService,
  );
  return { service, repo, projects };
}

describe('StatsService.issueStats', () => {
  it('answers 404 for a project of another organization and reads nothing', async () => {
    const { service, repo, projects } = setup();
    projects.get.mockRejectedValue(new NotFoundException());

    await expect(
      service.issueStats('other-org', 'p1', 'i1', '14d', NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findIssues).not.toHaveBeenCalled();
    expect(repo.eventsByBucketAndLevel).not.toHaveBeenCalled();
  });

  it('answers 404 when the issue is not in that project and reads no events', async () => {
    const { service, repo } = setup();
    repo.findIssues.mockResolvedValue([]);

    await expect(
      service.issueStats('org', 'p1', 'issue-of-another-project', '14d', NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findIssues).toHaveBeenCalledWith('p1', [
      'issue-of-another-project',
    ]);
    expect(repo.eventsByBucketAndLevel).not.toHaveBeenCalled();
    expect(repo.eventsByEnvironment).not.toHaveBeenCalled();
    expect(repo.eventsByRelease).not.toHaveBeenCalled();
  });

  it('returns a zero-filled series, one point per day', async () => {
    const { service } = setup();
    const result = await service.issueStats('org', 'p1', 'i1', '14d', NOW);

    expect(result.series).toHaveLength(14);
    expect(result.series.every((point) => point.count === 0)).toBe(true);
    expect(result.total).toBe(0);
    expect(result.from).toBe('2026-11-07T00:00:00.000Z');
    expect(result.to).toBe('2026-11-21T00:00:00.000Z');
  });

  it('sums the levels of a bucket and totals the range', async () => {
    const { service, repo } = setup();
    repo.eventsByBucketAndLevel.mockResolvedValue([
      {
        bucket: new Date('2026-11-20T00:00:00.000Z'),
        level: 'error',
        count: 5,
      },
      {
        bucket: new Date('2026-11-20T00:00:00.000Z'),
        level: 'fatal',
        count: 1,
      },
      {
        bucket: new Date('2026-11-18T00:00:00.000Z'),
        level: 'error',
        count: 2,
      },
    ]);

    const result = await service.issueStats('org', 'p1', 'i1', '14d', NOW);

    expect(result.series[13]).toEqual({
      bucket: '2026-11-20T00:00:00.000Z',
      count: 6,
    });
    expect(result.series[11].count).toBe(2);
    expect(result.total).toBe(8);
  });

  it('filters every event read by this issue and keeps the "no release" group', async () => {
    const { service, repo } = setup();
    repo.eventsByEnvironment.mockResolvedValue([
      { environment: 'production', count: 7 },
    ]);
    repo.eventsByRelease.mockResolvedValue([
      { release: '1.2.0', count: 5 },
      { release: null, count: 2 },
    ]);

    const result = await service.issueStats('org', 'p1', 'i1', '7d', NOW);

    expect(repo.eventsByBucketAndLevel.mock.calls[0]).toEqual([
      'p1',
      expect.anything(),
      'day',
      'i1',
    ]);
    expect(repo.eventsByEnvironment.mock.calls[0]).toEqual([
      'p1',
      expect.anything(),
      'i1',
    ]);
    expect(repo.eventsByRelease.mock.calls[0]).toEqual([
      'p1',
      'i1',
      expect.anything(),
    ]);
    expect(result.environments).toEqual([
      { environment: 'production', count: 7 },
    ]);
    expect(result.releases).toEqual([
      { release: '1.2.0', count: 5 },
      { release: null, count: 2 },
    ]);
  });

  it('uses hourly buckets for 24h', async () => {
    const { service, repo } = setup();
    const result = await service.issueStats('org', 'p1', 'i1', '24h', NOW);

    expect(result.series).toHaveLength(24);
    const call = repo.eventsByBucketAndLevel.mock.calls[0] as unknown[];
    expect(call[2]).toBe('hour');
  });
});
