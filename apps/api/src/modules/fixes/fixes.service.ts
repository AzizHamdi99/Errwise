import {
  BadGatewayException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { PublicIssueFix, StoredFixResult } from '@errwise/shared';
import { AiQuotaService } from '../ai-quota/ai-quota.service';
import { AiClient } from '../analysis/ai.client';
import { GithubApiClient } from '../github/github-api.client';
import { GithubReadError } from '../github/github-read';
import { SourceContextService } from '../source-context/source-context.service';
import type { FixSourceResult } from '../source-context/source-context.service';
import { buildFixInput, hashFixInput } from './fix-input';
import type { PreparedFix } from './fix-input';
import { GITHUB_PROBLEM } from './fix-errors';
import { checkFixEdits, normalizeText } from './fix-patch';
import { toPublicFix } from './fix.mapper';
import { FixesRepository } from './fixes.repository';
import type { FixProject } from './fixes.repository';

type OkSource = Extract<FixSourceResult, { status: 'ok' }>;

const SOURCE_PROBLEM: Record<
  Exclude<FixSourceResult['status'], 'ok'>,
  () => HttpException
> = {
  disabled: () =>
    new ConflictException('Source code is turned off for this project'),
  not_connected: () =>
    new ConflictException('GitHub is not connected to this project'),
  no_commit: () =>
    new ConflictException(
      'This error does not say which commit was deployed, so its code cannot be matched',
    ),
  commit_not_found: GITHUB_PROBLEM.not_found,
  no_permission: GITHUB_PROBLEM.forbidden,
  rate_limited: GITHUB_PROBLEM.rate_limited,
  unavailable: GITHUB_PROBLEM.unavailable,
};

/**
 * Suggests a code fix for an issue (ADR-009). It only suggests: the pull request is a separate
 * step with its own role check. Nothing here writes to GitHub.
 */
@Injectable()
export class FixesService {
  private readonly logger = new Logger(FixesService.name);

  constructor(
    private readonly repo: FixesRepository,
    private readonly sourceContext: SourceContextService,
    private readonly github: GithubApiClient,
    private readonly ai: AiClient,
    private readonly quota: AiQuotaService,
  ) {}

  /** The latest fix of the issue, or 404 when nobody asked for one yet. */
  async get(
    organizationId: string,
    projectId: string,
    issueId: string,
  ): Promise<PublicIssueFix> {
    const project = await this.requireProject(organizationId, projectId);
    const issue = await this.repo.findIssue(projectId, issueId);
    if (!issue) throw new NotFoundException('Issue not found');

    // Switched off: whatever is left is not shown, even before the wipe has caught up.
    const row = this.isEnabled(project)
      ? await this.repo.latestFix(issue.id)
      : null;
    if (!row) throw new NotFoundException('No fix yet');
    return toPublicFix(row, true);
  }

  async suggest(
    organizationId: string,
    projectId: string,
    issueId: string,
  ): Promise<PublicIssueFix> {
    const project = await this.requireProject(organizationId, projectId);
    const issue = await this.repo.findIssue(projectId, issueId);
    if (!issue) throw new NotFoundException('Issue not found');

    if (!this.isEnabled(project)) {
      throw new ConflictException(
        'AI fixes are not turned on for this project. Ask the organization owner to turn them on in the project settings.',
      );
    }
    const { githubInstallationId: installationId, githubRepo: repo } = project;
    if (!installationId || !repo) {
      throw new ConflictException('GitHub is not connected to this project');
    }
    if (!this.ai.enabled) {
      throw new ServiceUnavailableException('AI is not configured');
    }

    const event = await this.repo.latestEvent(issue.id);
    if (!event) throw new NotFoundException('Issue has no events');

    const source = await this.sourceContext.getFixSource(
      organizationId,
      projectId,
      issueId,
      event.id,
    );
    if (source.status !== 'ok') throw SOURCE_PROBLEM[source.status]();

    const prepared = buildFixInput(issue, event, source.files);
    if (!prepared) {
      throw new UnprocessableEntityException(
        'No code of this error could be matched to a file this feature may change',
      );
    }
    await this.requireCodeStillThere(source, prepared);

    // The same error and the same code: free, and it works even if the AI service is down.
    const inputHash = hashFixInput(prepared.request, source.repo);
    const existing = await this.repo.findFix(issue.id, inputHash);
    if (existing && existing.edits !== null) return toPublicFix(existing, true);

    const slot = await this.quota.reserve(organizationId);
    if (!slot) {
      throw new HttpException(
        'Daily AI limit reached, try again tomorrow',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Every way out below gives the slot back, except a refusal of the model: that answer
    // is real work, stored and reusable.
    try {
      const answer = await this.ai.fix(prepared.request);

      let result: StoredFixResult;
      let edits: Parameters<FixesRepository['saveFix']>[0]['edits'] = [];
      if (answer.fixable) {
        const check = checkFixEdits(answer.edits, prepared.files);
        if (!check.ok) {
          // Only the reason code is logged, never the edits or the code.
          this.logger.warn(`AI fix refused: ${check.reason}`);
          throw new BadGatewayException(
            'The AI proposed a change that does not fit the code',
          );
        }
        edits = check.edits;
        result = this.toStoredResult(answer, prepared, check.warnings);
      } else {
        result = this.toStoredResult(answer, prepared, []);
      }

      const outcome = await this.repo.saveFix({
        organizationId,
        projectId,
        issueId: issue.id,
        inputHash,
        promptVersion: answer.promptVersion,
        model: answer.model,
        repo: source.repo,
        installationId: source.installationId,
        commitSha: source.fullSha,
        result,
        edits,
      });
      if (outcome.status === 'project_changed') {
        throw new ConflictException(
          'The project settings changed while the fix was being prepared. Try again.',
        );
      }
      return toPublicFix(outcome.fix, !outcome.created);
    } catch (error) {
      await this.quota.giveBack(slot);
      throw error;
    }
  }

  private toStoredResult(
    answer: {
      fixable: boolean;
      prTitle: string;
      explanation: string;
      confidence: StoredFixResult['confidence'];
      reason: string;
      promptVersion: string;
      model: string;
    },
    prepared: PreparedFix,
    warnings: StoredFixResult['warnings'],
  ): StoredFixResult {
    return {
      fixable: answer.fixable,
      prTitle: answer.prTitle,
      explanation: answer.explanation,
      confidence: answer.confidence,
      reason: answer.reason,
      files: prepared.request.files.map((f) => `${f.file}:${f.failingLine}`),
      warnings,
      promptVersion: answer.promptVersion,
      model: answer.model,
    };
  }

  /**
   * A fix for code that has already changed on the default branch could not be applied, so
   * it is not worth a model call: refuse now, before a slot is taken. The pull request step
   * checks again, because the branch can move in between.
   */
  private async requireCodeStillThere(
    source: OkSource,
    prepared: PreparedFix,
  ): Promise<void> {
    try {
      const head = await this.github.getDefaultBranchHead(
        source.installationId,
        source.repo,
      );
      // The deployed commit is the tip: nothing can have changed.
      if (head.sha === source.fullSha) return;

      for (const window of prepared.windows) {
        const blob = await this.sourceContext.readFileAtCommit(
          source.installationId,
          source.repo,
          head.sha,
          window.path,
        );
        const current = blob?.kind === 'text' ? normalizeText(blob.text) : null;
        if (!current?.ok || !current.value.text.includes(window.raw)) {
          throw new ConflictException(
            'The code of this error has changed on the default branch since it was deployed, so a fix for it may no longer apply',
          );
        }
      }
    } catch (error) {
      if (error instanceof GithubReadError) throw GITHUB_PROBLEM[error.kind]();
      throw error;
    }
  }

  private isEnabled(project: FixProject): boolean {
    return project.sourceContextEnabled && project.fixPullRequestsEnabled;
  }

  private async requireProject(
    organizationId: string,
    projectId: string,
  ): Promise<FixProject> {
    const project = await this.repo.findProject(organizationId, projectId);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
