import {
  BadGatewayException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Event, Issue, IssueAnalysis } from '@prisma/client';
import type { AnalysisResult, AnalyzeRequest } from '@errwise/shared';
import type { Env } from '../../config/env';
import type { ProjectsService } from '../projects/projects.service';
import type { SourceContextService } from '../source-context/source-context.service';
import type { AiClient } from './ai.client';
import { AnalysisRepository } from './analysis.repository';
import { AnalysisService } from './analysis.service';

const RESULT: AnalysisResult = {
  summary: 'A TypeError occurred.',
  probableCause: 'The user was undefined.',
  suggestedFix: 'Check the user first.',
  confidence: 'medium',
  framesUsed: [],
  promptVersion: 'v1',
  model: 'test-model',
};

const ISSUE = { id: 'i1', projectId: 'p1', type: 'TypeError' } as Issue;
const EVENT = {
  id: 'e1',
  issueId: 'i1',
  type: 'TypeError',
  message: 'User bob@x.com not found',
  stack: 'Error\n    at f (/app/a.js:1:1)',
  environment: 'production',
  release: '1.0.0',
  context: null,
} as unknown as Event;

function row(result: AnalysisResult = RESULT): IssueAnalysis {
  return {
    id: 'a1',
    issueId: 'i1',
    inputHash: 'h',
    promptVersion: result.promptVersion,
    model: result.model,
    result,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function setup(limit = 20) {
  const repo = {
    findIssue: jest.fn().mockResolvedValue(ISSUE),
    latestEvent: jest.fn().mockResolvedValue(EVENT),
    findAnalysis: jest.fn().mockResolvedValue(null),
    latestAnalysis: jest.fn().mockResolvedValue(null),
    saveAnalysis: jest.fn().mockResolvedValue(row()),
    reserve: jest.fn().mockResolvedValue(true),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const projects = { get: jest.fn().mockResolvedValue({}) };
  const ai = {
    analyze: jest
      .fn<Promise<AnalysisResult>, [AnalyzeRequest]>()
      .mockResolvedValue(RESULT),
  };
  // Off by default: the project has not opted in to sharing its source code.
  const sourceContext = {
    get: jest
      .fn()
      .mockResolvedValue({ status: 'disabled', commitSha: null, frames: [] }),
  };
  const config = { get: () => limit };
  const service = new AnalysisService(
    config as unknown as ConfigService<Env, true>,
    repo as unknown as AnalysisRepository,
    projects as unknown as ProjectsService,
    ai as unknown as AiClient,
    sourceContext as unknown as SourceContextService,
  );
  return { service, repo, projects, ai, sourceContext };
}

describe('AnalysisService.analyze', () => {
  it('calls the AI once, stores the result and reports it as fresh', async () => {
    const { service, repo, ai } = setup();

    const out = await service.analyze('org1', 'p1', 'i1');

    expect(ai.analyze).toHaveBeenCalledTimes(1);
    expect(repo.saveAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: 'i1',
        promptVersion: 'v1',
        model: 'test-model',
      }),
    );
    expect(out).toMatchObject({ summary: RESULT.summary, cached: false });
  });

  it('sends scrubbed text to the AI service', async () => {
    const { service, ai } = setup();
    await service.analyze('org1', 'p1', 'i1');

    const sent = JSON.stringify(ai.analyze.mock.calls[0][0]);
    expect(sent).not.toContain('bob@x.com');
    expect(sent).toContain('[email]');
  });

  it('returns the stored analysis for the same input without an AI call or a slot', async () => {
    const { service, repo, ai } = setup();
    repo.findAnalysis.mockResolvedValue(row());

    const out = await service.analyze('org1', 'p1', 'i1');

    expect(out.cached).toBe(true);
    expect(ai.analyze).not.toHaveBeenCalled();
    expect(repo.reserve).not.toHaveBeenCalled();
  });

  it('answers 404 for a project of another organization, before anything else', async () => {
    const { service, repo, ai, projects } = setup();
    projects.get.mockRejectedValue(new NotFoundException());

    await expect(
      service.analyze('other-org', 'p1', 'i1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findIssue).not.toHaveBeenCalled();
    expect(ai.analyze).not.toHaveBeenCalled();
  });

  it('answers 404 for an issue that is not in the project', async () => {
    const { service, repo, ai } = setup();
    repo.findIssue.mockResolvedValue(null);

    await expect(service.analyze('org1', 'p1', 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.findIssue).toHaveBeenCalledWith('p1', 'nope');
    expect(ai.analyze).not.toHaveBeenCalled();
  });

  it('answers 429 and makes no AI call when the daily allowance is used up', async () => {
    const { service, repo, ai } = setup(3);
    repo.reserve.mockResolvedValue(false);

    const error = await service
      .analyze('org1', 'p1', 'i1')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    expect(repo.reserve).toHaveBeenCalledWith('org1', expect.any(Date), 3);
    expect(ai.analyze).not.toHaveBeenCalled();
  });

  it('gives the slot back when the AI call fails, and keeps the real error', async () => {
    const { service, repo, ai } = setup();
    ai.analyze.mockRejectedValue(new BadGatewayException('AI analysis failed'));

    await expect(service.analyze('org1', 'p1', 'i1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(repo.release).toHaveBeenCalledWith('org1', expect.any(Date));
    expect(repo.saveAnalysis).not.toHaveBeenCalled();
  });

  it('does not hide the AI error when giving the slot back also fails', async () => {
    const { service, repo, ai } = setup();
    ai.analyze.mockRejectedValue(new BadGatewayException('AI analysis failed'));
    repo.release.mockRejectedValue(new Error('db down'));

    await expect(service.analyze('org1', 'p1', 'i1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

describe('AnalysisService.get', () => {
  it('answers 404 until an analysis exists', async () => {
    const { service } = setup();
    await expect(service.get('org1', 'p1', 'i1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the latest analysis as cached', async () => {
    const { service, repo } = setup();
    repo.latestAnalysis.mockResolvedValue(row());

    await expect(service.get('org1', 'p1', 'i1')).resolves.toMatchObject({
      summary: RESULT.summary,
      cached: true,
    });
  });

  it('is scoped to the organization too', async () => {
    const { service, projects, repo } = setup();
    projects.get.mockRejectedValue(new NotFoundException());

    await expect(service.get('other-org', 'p1', 'i1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.latestAnalysis).not.toHaveBeenCalled();
  });
});
