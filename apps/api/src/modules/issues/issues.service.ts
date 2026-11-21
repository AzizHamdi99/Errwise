import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  IssueDetail,
  IssueFacets,
  BulkUpdateIssuesInput,
  BulkUpdateIssuesResult,
  IssueListItem,
  ListIssuesQuery,
  Paginated,
  PublicIssue,
  UpdateIssueInput,
} from '@errwise/shared';
import { ProjectsService } from '../projects/projects.service';
import { buildTrends, trendStart } from './issue-trend';
import { decodeCursor, encodeCursor } from './issues.cursor';
import { toIssueListItem, toPublicEvent, toPublicIssue } from './issues.mapper';
import { IssuesRepository } from './issues.repository';

const DETAIL_EVENTS = 20;

@Injectable()
export class IssuesService {
  constructor(
    private readonly repo: IssuesRepository,
    private readonly projects: ProjectsService,
  ) {}

  async list(
    organizationId: string,
    projectId: string,
    query: ListIssuesQuery,
  ): Promise<Paginated<IssueListItem>> {
    await this.projects.get(organizationId, projectId); // 404 if not in this organization

    const cursor = query.cursor
      ? decodeCursor(query.cursor, query.sort)
      : undefined;
    if (query.cursor && !cursor)
      throw new BadRequestException('Invalid cursor');

    const rows = await this.repo.list(projectId, {
      status: query.status,
      environment: query.environment,
      level: query.level,
      release: query.release,
      regressed: query.regressed,
      age: query.age,
      search: query.search,
      sort: query.sort,
      cursor: cursor ?? undefined,
      limit: query.limit,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const ids = page.map((issue) => issue.id);
    const since = trendStart(new Date());
    // Independent of each other, so one round trip of waiting, not two.
    const [environments, hourly] = await Promise.all([
      this.repo.environmentsByIssue(projectId, ids),
      this.repo.hourlyCounts(projectId, ids, since),
    ]);
    const trends = buildTrends(ids, hourly, since);

    const last = page.at(-1);
    return {
      items: page.map((issue) =>
        toIssueListItem(
          issue,
          environments.get(issue.id) ?? [],
          trends.get(issue.id) ?? [],
        ),
      ),
      nextCursor: hasMore && last ? encodeCursor(query.sort, last) : null,
    };
  }

  async facets(
    organizationId: string,
    projectId: string,
  ): Promise<IssueFacets> {
    await this.projects.get(organizationId, projectId); // 404 if not in this organization
    return this.repo.facets(projectId);
  }

  async get(
    organizationId: string,
    projectId: string,
    issueId: string,
  ): Promise<IssueDetail> {
    await this.projects.get(organizationId, projectId);
    const issue = await this.getOrThrow(projectId, issueId);

    const [events, environments] = await Promise.all([
      this.repo.recentEvents(issue.id, DETAIL_EVENTS),
      this.repo.environmentsByIssue(projectId, [issue.id]),
    ]);
    return {
      ...toPublicIssue(issue, environments.get(issue.id) ?? []),
      events: events.map(toPublicEvent),
    };
  }

  async updateStatus(
    organizationId: string,
    projectId: string,
    issueId: string,
    input: UpdateIssueInput,
  ): Promise<PublicIssue> {
    await this.projects.get(organizationId, projectId);
    const issue = await this.getOrThrow(projectId, issueId);

    // Same status: nothing to do, and resolvedAt keeps its original value.
    const current =
      issue.status === input.status
        ? issue
        : await this.repo.updateStatus(projectId, issue.id, input.status);
    if (!current) throw new NotFoundException('Issue not found'); // deleted in between

    const environments = await this.repo.environmentsByIssue(projectId, [
      current.id,
    ]);
    return toPublicIssue(current, environments.get(current.id) ?? []);
  }

  /**
   * Many issues, one status. Ids that are not in this project are skipped like ids that already
   * have the status: the answer only says how many changed, so it cannot be used to find out
   * whether an id exists in another organization.
   */
  async bulkUpdateStatus(
    organizationId: string,
    projectId: string,
    input: BulkUpdateIssuesInput,
  ): Promise<BulkUpdateIssuesResult> {
    await this.projects.get(organizationId, projectId); // 404 if not in this organization
    const updated = await this.repo.bulkUpdateStatus(
      projectId,
      input.issueIds,
      input.status,
    );
    return { updated };
  }

  private async getOrThrow(projectId: string, issueId: string) {
    const issue = await this.repo.findInProject(projectId, issueId);
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }
}
