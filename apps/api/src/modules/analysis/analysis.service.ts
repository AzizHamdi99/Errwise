import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AnalysisResult,
  PublicIssueAnalysis,
  SourceSnippet,
} from '@errwise/shared';
import type { Env } from '../../config/env';
import { ProjectsService } from '../projects/projects.service';
import { SourceContextService } from '../source-context/source-context.service';
import { AiClient } from './ai.client';
import {
  buildAnalysisInput,
  buildSourceSnippets,
  hashAnalysisInput,
} from './analysis-input';
import { toPublicAnalysis } from './analysis.mapper';
import { AnalysisRepository } from './analysis.repository';

/** The allowance resets at midnight UTC. */
function utcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly dailyLimit: number;

  constructor(
    config: ConfigService<Env, true>,
    private readonly repo: AnalysisRepository,
    private readonly projects: ProjectsService,
    private readonly ai: AiClient,
    private readonly sourceContext: SourceContextService,
  ) {
    this.dailyLimit = config.get('AI_DAILY_LIMIT_PER_ORG', { infer: true });
  }

  /** The latest analysis of the issue, or 404 when nobody asked for one yet. */
  async get(
    organizationId: string,
    projectId: string,
    issueId: string,
  ): Promise<PublicIssueAnalysis> {
    await this.projects.get(organizationId, projectId); // 404 if not in this organization
    const issue = await this.getIssueOrThrow(projectId, issueId);

    const row = await this.repo.latestAnalysis(issue.id);
    if (!row) throw new NotFoundException('No analysis yet');
    return toPublicAnalysis(row, true);
  }

  async analyze(
    organizationId: string,
    projectId: string,
    issueId: string,
  ): Promise<PublicIssueAnalysis> {
    await this.projects.get(organizationId, projectId);
    const issue = await this.getIssueOrThrow(projectId, issueId);

    const event = await this.repo.latestEvent(issue.id);
    if (!event) throw new NotFoundException('Issue has no events');

    const snippets = await this.sourceSnippets(
      organizationId,
      projectId,
      issueId,
      event.id,
    );
    const input = buildAnalysisInput(issue, event, snippets);
    const inputHash = hashAnalysisInput(input);

    // Same input as before: free, and it works even if the AI service is down.
    const cached = await this.repo.findAnalysis(issue.id, inputHash);
    if (cached) return toPublicAnalysis(cached, true);

    const day = utcDay(new Date());
    const reserved = await this.repo.reserve(
      organizationId,
      day,
      this.dailyLimit,
    );
    if (!reserved) {
      throw new HttpException(
        'Daily AI analysis limit reached, try again tomorrow',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let result: AnalysisResult;
    try {
      result = await this.ai.analyze(input);
    } catch (error) {
      await this.giveBack(organizationId, day);
      throw error;
    }

    const row = await this.repo.saveAnalysis({
      issueId: issue.id,
      inputHash,
      promptVersion: result.promptVersion,
      model: result.model,
      result: {
        ...result,
        sourceFiles: (input.sourceContext ?? []).map(
          (s) => `${s.file}:${s.line}`,
        ),
      },
    });
    return toPublicAnalysis(row, false);
  }

  /**
   * The code around the failing frames, when the project opted in. Best effort: the
   * analysis is worth having without it, so any problem (GitHub down, no permission, a
   * missing commit) just means "no code this time". The source service itself answers
   * "disabled" without calling GitHub when the owner has not turned the feature on, so a
   * project that did not opt in never has its code read, let alone sent.
   */
  private async sourceSnippets(
    organizationId: string,
    projectId: string,
    issueId: string,
    eventId: string,
  ): Promise<SourceSnippet[]> {
    try {
      const source = await this.sourceContext.get(
        organizationId,
        projectId,
        issueId,
        eventId,
      );
      return buildSourceSnippets(source);
    } catch {
      this.logger.warn('Source code was not available for an analysis');
      return [];
    }
  }

  private async getIssueOrThrow(projectId: string, issueId: string) {
    const issue = await this.repo.findIssue(projectId, issueId);
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }

  /** Never hides the real error: a failed refund is only logged. */
  private async giveBack(organizationId: string, day: Date): Promise<void> {
    try {
      await this.repo.release(organizationId, day);
    } catch {
      this.logger.warn('Could not give back an AI slot');
    }
  }
}
