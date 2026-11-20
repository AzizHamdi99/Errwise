import { Injectable } from '@nestjs/common';
import type {
  IssueStatus,
  OrgOverview,
  OrgProjectStat,
  OrgTopIssue,
  ProjectOverview,
  StatsRange,
  TopIssue,
} from '@errwise/shared';
import { ProjectsService } from '../projects/projects.service';
import { fillProjectSeries, fillSeries, resolveWindow } from './stats-range';
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

  /**
   * The organization comes from the caller's membership (the guard), never from the
   * request body, and every query below filters by it through the project relation.
   */
  async orgOverview(
    organizationId: string,
    range: StatsRange,
    now: Date = new Date(),
  ): Promise<OrgOverview> {
    const window = resolveWindow(range, now);
    const current = { from: window.from, to: window.to };
    const previous = { from: window.previousFrom, to: window.from };

    const [
      projects,
      events,
      eventsPrevious,
      unresolved,
      newIssues,
      regressedIssues,
      bucketRows,
      eventCounts,
      unresolvedCounts,
      topCounts,
    ] = await Promise.all([
      this.projects.list(organizationId),
      this.repo.countEventsInOrg(organizationId, current),
      this.repo.countEventsInOrg(organizationId, previous),
      this.repo.countUnresolvedIssuesInOrg(organizationId),
      this.repo.countNewIssuesInOrg(organizationId, current),
      this.repo.countRegressedIssuesInOrg(organizationId, current),
      this.repo.eventsByBucketAndProject(organizationId, current, window.unit),
      this.repo.eventCountsByProject(organizationId, current),
      this.repo.unresolvedCountsByProject(organizationId),
      this.repo.topIssueCountsInOrg(organizationId, current),
    ]);

    const eventsByProject = new Map(
      eventCounts.map((row) => [row.projectId, row.count]),
    );
    const unresolvedByProject = new Map(
      unresolvedCounts.map((row) => [row.projectId, row.count]),
    );
    const projectStats: OrgProjectStat[] = projects
      .map((project) => ({
        id: project.id,
        name: project.name,
        events: eventsByProject.get(project.id) ?? 0,
        unresolved: unresolvedByProject.get(project.id) ?? 0,
      }))
      .sort((a, b) => b.events - a.events || a.name.localeCompare(b.name));

    const issues = await this.repo.findIssuesInOrg(
      organizationId,
      topCounts.map((row) => row.issueId),
    );
    const byId = new Map(issues.map((issue) => [issue.id, issue]));
    const topIssues = topCounts.flatMap((row): OrgTopIssue[] => {
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
          projectId: issue.project.id,
          projectName: issue.project.name,
        },
      ];
    });

    return {
      range,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      cards: { events, eventsPrevious, unresolved, newIssues, regressedIssues },
      projects: projectStats,
      series: fillProjectSeries(bucketRows, window),
      topIssues,
    };
  }
}
