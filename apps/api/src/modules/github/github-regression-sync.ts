import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { GithubApiClient } from './github-api.client';
import { GithubRepository } from './github.repository';

const MAX_CELL_CHARS = 100;

/** Inline code keeps SDK-provided values from becoming markdown or @mentions. */
function inline(value: string): string {
  return `\`${value.replace(/[`|\r\n]+/g, ' ').slice(0, MAX_CELL_CHARS)}\``;
}

/** When a resolved issue happens again, reopens its GitHub issue and comments on it. */
@Injectable()
export class GithubRegressionSync {
  private readonly logger = new Logger(GithubRegressionSync.name);
  private readonly webUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly repo: GithubRepository,
    private readonly github: GithubApiClient,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true });
  }

  /** Never throws: a GitHub problem must not break alerts or ingestion. */
  async sync(issueId: string, environment: string): Promise<void> {
    try {
      await this.run(issueId, environment);
    } catch (error) {
      this.logger.warn(
        `GitHub regression sync failed for issue ${issueId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async run(issueId: string, environment: string): Promise<void> {
    const issue = await this.repo.findRegressionContext(issueId);
    if (!issue || issue.githubIssueNumber === null) return;

    const { project } = issue;
    if (
      project.deletedAt ||
      !project.githubInstallationId ||
      !project.githubRepo
    ) {
      return;
    }
    // Only a GitHub issue we know is closed needs to be reopened.
    if (issue.githubState !== 'closed') return;
    if (!(await this.repo.claimGithubReopen(issue.id))) return;

    try {
      await this.github.reopenIssue(
        project.githubInstallationId,
        project.githubRepo,
        issue.githubIssueNumber,
      );
    } catch (error) {
      await this.repo.releaseGithubReopen(issue.id);
      throw error;
    }

    const url = `${this.webUrl}/organizations/${project.organizationId}/projects/${issue.projectId}/issues/${issue.id}`;
    const body = [
      '### Regression: this error happened again',
      [
        '| | |',
        '|---|---|',
        `| Environment | ${inline(environment)} |`,
        `| Release | ${inline(issue.lastRelease ?? 'unknown')} |`,
        `| Times reopened | ${inline(String(issue.regressionCount))} |`,
      ].join('\n'),
      `**[View in Errwise](${url})**`,
      '_Reopened automatically by Errwise_',
    ].join('\n\n');

    // The issue is already reopened: a failed comment is logged, not retried.
    await this.github.commentOnIssue(
      project.githubInstallationId,
      project.githubRepo,
      issue.githubIssueNumber,
      body,
    );
  }
}
