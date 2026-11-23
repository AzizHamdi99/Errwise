import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  AnalysisResult,
  PublicIssueAnalysis,
  SourceSnippet,
} from '@errwise/shared';
import { AiQuotaService } from '../ai-quota/ai-quota.service';
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

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly repo: AnalysisRepository,
    private readonly projects: ProjectsService,
    private readonly ai: AiClient,
    private readonly sourceContext: SourceContextService,
    private readonly quota: AiQuotaService,
  ) {}

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

    const slot = await this.quota.reserve(organizationId);
    if (!slot) {
      throw new HttpException(
        'Daily AI analysis limit reached, try again tomorrow',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let result: AnalysisResult;
    try {
      result = await this.ai.analyze(input);
    } catch (error) {
      await this.quota.giveBack(slot);
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
}
