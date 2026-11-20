import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiUsageStatus, OrgUsage, UsageProject } from '@errwise/shared';
import type { Env } from '../../config/env';
import { AiClient } from '../analysis/ai.client';
import { ProjectsService } from '../projects/projects.service';
import { fillProjectSeries, resolveWindow } from './stats-range';
import { StatsRepository } from './stats.repository';

/** The allowance resets at midnight UTC, like AnalysisService. */
function utcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

@Injectable()
export class UsageService {
  private readonly dailyLimit: number;

  constructor(
    config: ConfigService<Env, true>,
    private readonly repo: StatsRepository,
    private readonly projects: ProjectsService,
    private readonly ai: AiClient,
  ) {
    this.dailyLimit = config.get('AI_DAILY_LIMIT_PER_ORG', { infer: true });
  }

  /**
   * The organization comes from the caller's membership (the guard). There is no
   * event quota in the product yet, so this is volume, plus the one real limit: AI.
   */
  async orgUsage(
    organizationId: string,
    now: Date = new Date(),
  ): Promise<OrgUsage> {
    const window = resolveWindow('30d', now);
    const span = { from: window.from, to: window.to };

    const [projects, bucketRows, eventCounts, ai] = await Promise.all([
      this.projects.list(organizationId),
      this.repo.eventsByBucketAndProject(organizationId, span, 'day'),
      this.repo.eventCountsByProject(organizationId, span),
      this.aiStatus(organizationId, now),
    ]);

    const eventsOf = new Map(
      eventCounts.map((row) => [row.projectId, row.count]),
    );
    const usageProjects: UsageProject[] = projects
      .map((project) => ({
        id: project.id,
        name: project.name,
        events: eventsOf.get(project.id) ?? 0,
      }))
      .sort((a, b) => b.events - a.events || a.name.localeCompare(b.name));

    return {
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      totalEvents: usageProjects.reduce(
        (sum, project) => sum + project.events,
        0,
      ),
      projects: usageProjects,
      series: fillProjectSeries(bucketRows, window),
      ai,
    };
  }

  /** Null when the feature is off: nothing to show, and no database read. */
  private async aiStatus(
    organizationId: string,
    now: Date,
  ): Promise<AiUsageStatus | null> {
    if (!this.ai.enabled) return null;
    const usedToday = await this.repo.aiRequestsOn(organizationId, utcDay(now));
    return { usedToday, dailyLimit: this.dailyLimit };
  }
}
