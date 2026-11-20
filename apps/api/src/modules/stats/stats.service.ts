import { Injectable } from '@nestjs/common';
import type {
  IssueStatus,
  ProjectOverview,
  StatsRange,
  TopIssue,
} from '@errwise/shared';
import { ProjectsService } from '../projects/projects.service';
import { fillSeries, resolveWindow } from './stats-range';
import { StatsRepository } from './stats.repository';

@Injectable()
export class StatsService {
  constructor(
    private readonly repo: StatsRepository,
    private readonly projects: ProjectsService,
  ) {}

  async projectOverview(
    organizationId: string,
    projectId: string,
    range: StatsRange,
    now: Date = new Date(),
  ): Promise<ProjectOverview> {
    await this.projects.get(organizationId, projectId); // 404 if not in this organization

    const window = resolveWindow(range, now);
    const current = { from: window.from, to: window.to };
    const previous = { from: window.previousFrom, to: window.from };

    const [
      events,
      eventsPrevious,
      unresolved,
      newIssues,
      regressedIssues,
      levelRows,
      environments,
      topCounts,
    ] = await Promise.all([
      this.repo.countEvents(projectId, current),
      this.repo.countEvents(projectId, previous),
      this.repo.countUnresolvedIssues(projectId),
      this.repo.countNewIssues(projectId, current),
      this.repo.countRegressedIssues(projectId, current),
      this.repo.eventsByBucketAndLevel(projectId, current, window.unit),
      this.repo.eventsByEnvironment(projectId, current),
      this.repo.topIssueCounts(projectId, current),
    ]);

    const issues = await this.repo.findIssues(
      projectId,
      topCounts.map((row) => row.issueId),
    );
    const byId = new Map(issues.map((issue) => [issue.id, issue]));
    const topIssues = topCounts.flatMap((row): TopIssue[] => {
      const issue = byId.get(row.issueId);
      if (!issue) return [];
      return [
        {
          id: issue.id,
          title: issue.title,
          type: issue.type,
          level: issue.level,
          status: issue.status as IssueStatus,
          count: row.count,
          lastSeenAt: issue.lastSeenAt.toISOString(),
        },
      ];
    });

    return {
      range,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      cards: { events, eventsPrevious, unresolved, newIssues, regressedIssues },
      series: fillSeries(levelRows, window),
      environments,
      topIssues,
    };
  }
}
