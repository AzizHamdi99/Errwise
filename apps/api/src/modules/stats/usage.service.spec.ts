import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import type { AiClient } from '../analysis/ai.client';
import type { ProjectsService } from '../projects/projects.service';
import type { StatsRepository } from './stats.repository';
import { UsageService } from './usage.service';

const NOW = new Date('2026-11-20T15:42:10.000Z');

function setup(aiEnabled = true) {
  const repo = {
    eventsByBucketAndProject: jest.fn().mockResolvedValue([]),
    eventCountsByProject: jest.fn().mockResolvedValue([]),
    aiRequestsOn: jest.fn().mockResolvedValue(7),
  };
  const projects = {
    list: jest.fn().mockResolvedValue([
      { id: 'p1', name: 'Web' },
      { id: 'p2', name: 'Api' },
      { id: 'p3', name: 'Admin' },
    ]),
  };
  const config = { get: jest.fn().mockReturnValue(20) };
  const service = new UsageService(
    config as unknown as ConfigService<Env, true>,
    repo as unknown as StatsRepository,
    projects as unknown as ProjectsService,
    { enabled: aiEnabled } as unknown as AiClient,
  );
  return { service, repo, projects, config };
}

describe('UsageService.orgUsage', () => {
  it('scopes every read to the organization it was given', async () => {
    const { service, repo, projects } = setup();
    await service.orgUsage('org-1', NOW);

    expect(projects.list).toHaveBeenCalledWith('org-1');
    for (const fn of Object.values(repo)) {
      const calls = fn.mock.calls as unknown[][];
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((call) => call[0] === 'org-1')).toBe(true);
    }
  });

  it('covers the last 30 days with one zero-filled point per day', async () => {
    const { service } = setup();
    const result = await service.orgUsage('org-1', NOW);

    expect(result.series).toHaveLength(30);
    expect(result.from).toBe('2026-10-22T00:00:00.000Z');
    expect(result.to).toBe('2026-11-21T00:00:00.000Z');
    expect(
      result.series.every((p) => Object.keys(p.byProject).length === 0),
    ).toBe(true);
  });

  it('lists every project busiest first, with zero-event ones, and totals the events', async () => {
    const { service, repo } = setup();
    repo.eventCountsByProject.mockResolvedValue([
      { projectId: 'p2', count: 30 },
      { projectId: 'p1', count: 10 },
    ]);

    const result = await service.orgUsage('org-1', NOW);

    expect(result.projects).toEqual([
      { id: 'p2', name: 'Api', events: 30 },
      { id: 'p1', name: 'Web', events: 10 },
      { id: 'p3', name: 'Admin', events: 0 },
    ]);
    expect(result.totalEvents).toBe(40);
  });

  it('reports the AI allowance used on the current UTC day', async () => {
    const { service, repo } = setup(true);
    const result = await service.orgUsage('org-1', NOW);

    expect(result.ai).toEqual({ usedToday: 7, dailyLimit: 20 });
    const call = repo.aiRequestsOn.mock.calls[0] as [string, Date];
    expect(call[1].toISOString()).toBe('2026-11-20T00:00:00.000Z');
  });

  it('switches to the next allowance right after midnight UTC', async () => {
    const { service, repo } = setup(true);
    await service.orgUsage('org-1', new Date('2026-11-21T00:00:00.000Z'));

    const call = repo.aiRequestsOn.mock.calls[0] as [string, Date];
    expect(call[1].toISOString()).toBe('2026-11-21T00:00:00.000Z');
  });

  it('returns no AI block and does not read AI usage when the feature is off', async () => {
    const { service, repo } = setup(false);
    const result = await service.orgUsage('org-1', NOW);

    expect(result.ai).toBeNull();
    expect(repo.aiRequestsOn).not.toHaveBeenCalled();
  });

  it('is empty but well formed for an organization without projects', async () => {
    const { service, projects } = setup();
    projects.list.mockResolvedValue([]);
    const result = await service.orgUsage('org-1', NOW);

    expect(result.projects).toEqual([]);
    expect(result.totalEvents).toBe(0);
  });
});
