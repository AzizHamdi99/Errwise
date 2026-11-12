import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Issue } from '@prisma/client';
import type { GithubIssueLink } from '@errwise/shared';
import type { Env } from '../../config/env';
import { GithubApiClient } from './github-api.client';
import { buildGithubIssueContent } from './github-issue-content';
import { GithubRepository } from './github.repository';

/** A claim older than this is treated as abandoned. */
const CLAIM_TTL_MS = 60_000;

@Injectable()
export class GithubIssueService {
  private readonly webUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly repo: GithubRepository,
    private readonly github: GithubApiClient,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true });
  }

  async createForIssue(
    organizationId: string,
    projectId: string,
    issueId: string,
  ): Promise<GithubIssueLink> {
    const project = await this.repo.findProject(organizationId, projectId);
    if (!project) throw new NotFoundException('Project not found');

    const issue = await this.repo.findIssue(organizationId, projectId, issueId);
    if (!issue) throw new NotFoundException('Issue not found');

    // Already created: return the existing link, create nothing.
    const existing = this.toLink(issue);
    if (existing) return existing;

    if (!project.githubInstallationId || !project.githubRepo) {
      throw new ConflictException(
        'GitHub is not connected to this project. Ask the organization owner to connect it.',
      );
    }

    const claimed = await this.repo.claimIssueCreation(
      issue.id,
      new Date(Date.now() - CLAIM_TTL_MS),
    );
    if (!claimed) {
      // Someone else won the race: return their result if it is already saved.
      const current = await this.repo.findIssue(
        organizationId,
        projectId,
        issueId,
      );
      const link = current ? this.toLink(current) : null;
      if (link) return link;
      throw new ConflictException(
        'A GitHub issue is already being created. Try again in a moment.',
      );
    }

    try {
      const event = await this.repo.findLatestEvent(issue.id);
      const content = buildGithubIssueContent({
        issue,
        event,
        issueUrl: `${this.webUrl}/organizations/${organizationId}/projects/${projectId}/issues/${issue.id}`,
      });
      const created = await this.github.createIssue(
        project.githubInstallationId,
        project.githubRepo,
        content,
      );
      await this.repo.saveIssueLink(issue.id, created.number, created.url);
      return created;
    } catch (error) {
      await this.repo.releaseIssueClaim(issue.id);
      throw error;
    }
  }

  private toLink(issue: Issue): GithubIssueLink | null {
    return issue.githubIssueNumber !== null && issue.githubIssueUrl
      ? { number: issue.githubIssueNumber, url: issue.githubIssueUrl }
      : null;
  }
}
