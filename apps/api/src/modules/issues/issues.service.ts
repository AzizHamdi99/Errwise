import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  IssueDetail,
  ListIssuesQuery,
  Paginated,
  PublicIssue,
  UpdateIssueInput,
} from '@errwise/shared';
import { ProjectsService } from '../projects/projects.service';
import { decodeCursor, encodeCursor } from './issues.cursor';
import { toPublicEvent, toPublicIssue } from './issues.mapper';
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
  ): Promise<Paginated<PublicIssue>> {
    await this.projects.get(organizationId, projectId); // 404 if not in this organization

    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    if (query.cursor && !cursor)
      throw new BadRequestException('Invalid cursor');

    const rows = await this.repo.list(projectId, {
      status: query.status,
      environment: query.environment,
      search: query.search,
      cursor: cursor ?? undefined,
      limit: query.limit,
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const environments = await this.repo.environmentsByIssue(
      page.map((issue) => issue.id),
    );

    const last = page.at(-1);
    return {
      items: page.map((issue) =>
        toPublicIssue(issue, environments.get(issue.id) ?? []),
      ),
      nextCursor: hasMore && last ? encodeCursor(last) : null,
    };
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
      this.repo.environmentsByIssue([issue.id]),
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
        : await this.repo.updateStatus(issue.id, input.status);

    const environments = await this.repo.environmentsByIssue([current.id]);
    return toPublicIssue(current, environments.get(current.id) ?? []);
  }

  private async getOrThrow(projectId: string, issueId: string) {
    const issue = await this.repo.findInProject(projectId, issueId);
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }
}
