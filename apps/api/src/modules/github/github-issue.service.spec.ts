import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Issue, IssueAnalysis } from '@prisma/client';
import type { Env } from '../../config/env';
import type { GithubApiClient } from './github-api.client';
import { GithubIssueService } from './github-issue.service';
import type { GithubRepository } from './github.repository';

const ORG = 'org-1';
const PROJECT = 'project-1';
const ISSUE_ID = 'issue-1';
const CREATED = { number: 7, url: 'https://github.com/acme/shop/7' };

const issue = {
  id: ISSUE_ID,
  title: 'TypeError: x is undefined',
  status: 'unresolved',
  level: 'error',
  eventCount: 1,
  lastRelease: null,
  firstSeenAt: new Date('2026-01-01T00:00:00.000Z'),
  lastSeenAt: new Date('2026-01-01T00:00:00.000Z'),
  githubIssueNumber: null,
  githubIssueUrl: null,
} as unknown as Issue;

const event = {
  message: 'x is undefined',
  stack: null,
  environment: 'production',
  release: null,
};

function analysisRow(result: unknown): IssueAnalysis {
  return {
    id: 'a1',
    issueId: ISSUE_ID,
    result,
    createdAt: new Date('2026-03-04T10:00:00.000Z'),
  } as IssueAnalysis;
}

const GOOD_RESULT = {
  summary: 'getUser read a property of undefined.',
  probableCause: 'The lookup returned nothing.',
  suggestedFix: 'Check the lookup result first.',
  confidence: 'medium',
  framesUsed: [],
  issueTitle: 'getUser crashes when the user is missing',
  reproSteps: ['Call getUser with an unknown id.'],
  promptVersion: 'v4',
  model: 'test-model',
};

interface SentContent {
  title: string;
  body: string;
  labels: string[];
}

function setup(latestAnalysis: IssueAnalysis | null) {
  const repo = {
    findProject: jest.fn().mockResolvedValue({
      id: PROJECT,
      githubInstallationId: '99',
      githubRepo: 'acme/shop',
    }),
    findIssue: jest.fn().mockResolvedValue(issue),
    claimIssueCreation: jest.fn().mockResolvedValue(true),
    findLatestEvent: jest.fn().mockResolvedValue(event),
    findLatestAnalysis: jest.fn().mockResolvedValue(latestAnalysis),
    saveIssueLink: jest.fn().mockResolvedValue(undefined),
    releaseIssueClaim: jest.fn().mockResolvedValue(undefined),
  };
  const github = { createIssue: jest.fn().mockResolvedValue(CREATED) };
  const config = { get: () => 'https://errwise.test' };
  const service = new GithubIssueService(
    config as unknown as ConfigService<Env, true>,
    repo as unknown as GithubRepository,
    github as unknown as GithubApiClient,
  );
  return { service, repo, github };
}

const create = (service: GithubIssueService) =>
  service.createForIssue(ORG, PROJECT, ISSUE_ID);

function sent(github: { createIssue: jest.Mock }): SentContent {
  return (github.createIssue.mock.calls[0] as unknown[])[2] as SentContent;
}

describe('GithubIssueService.createForIssue content', () => {
  it('writes the AI analysis into the GitHub issue when there is one', async () => {
    const { service, github } = setup(analysisRow(GOOD_RESULT));

    await create(service);

    expect((github.createIssue.mock.calls[0] as unknown[])[1]).toBe(
      'acme/shop',
    );
    const content = sent(github);
    expect(content.title).toBe(
      '[Errwise] getUser crashes when the user is missing',
    );
    expect(content.body).toContain('### AI analysis');
    expect(content.body).toContain('The lookup returned nothing.');
    expect(content.labels).toEqual([
      'errwise',
      'bug',
      'level:error',
      'env:production',
    ]);
  });

  it('creates a plain issue when nobody asked for an analysis', async () => {
    const { service, github } = setup(null);

    await create(service);

    const content = sent(github);
    expect(content.title).toBe('[Errwise] TypeError: x is undefined');
    expect(content.body).not.toContain('### AI analysis');
  });

  it('treats a stored analysis that no longer fits the schema as none', async () => {
    const { service, github, repo } = setup(
      analysisRow({ summary: 42, nonsense: true }),
    );

    await expect(create(service)).resolves.toEqual(CREATED);

    expect(sent(github).body).not.toContain('### AI analysis');
    expect(repo.saveIssueLink).toHaveBeenCalledWith(ISSUE_ID, 7, CREATED.url);
  });

  it('reads an analysis stored before prompt v4', async () => {
    const old: Record<string, unknown> = { ...GOOD_RESULT };
    delete old.issueTitle;
    delete old.reproSteps;
    const { service, github } = setup(analysisRow(old));

    await create(service);

    const content = sent(github);
    expect(content.title).toBe('[Errwise] TypeError: x is undefined');
    expect(content.body).toContain('### AI analysis');
    expect(content.body).not.toContain('Steps to reproduce');
  });
});

describe('GithubIssueService.createForIssue guards', () => {
  it('releases the claim when GitHub fails, and does not save a link', async () => {
    const { service, github, repo } = setup(analysisRow(GOOD_RESULT));
    github.createIssue.mockRejectedValue(new Error('boom'));

    await expect(create(service)).rejects.toThrow('boom');

    expect(repo.releaseIssueClaim).toHaveBeenCalledWith(ISSUE_ID);
    expect(repo.saveIssueLink).not.toHaveBeenCalled();
  });

  it('releases the claim when reading the analysis fails', async () => {
    const { service, github, repo } = setup(null);
    repo.findLatestAnalysis.mockRejectedValue(new Error('db down'));

    await expect(create(service)).rejects.toThrow('db down');

    expect(github.createIssue).not.toHaveBeenCalled();
    expect(repo.releaseIssueClaim).toHaveBeenCalledWith(ISSUE_ID);
  });

  it('returns the existing link and reads nothing else', async () => {
    const { service, github, repo } = setup(null);
    repo.findIssue.mockResolvedValue({
      ...issue,
      githubIssueNumber: 3,
      githubIssueUrl: 'https://github.com/acme/shop/3',
    });

    await expect(create(service)).resolves.toEqual({
      number: 3,
      url: 'https://github.com/acme/shop/3',
    });
    expect(repo.findLatestAnalysis).not.toHaveBeenCalled();
    expect(github.createIssue).not.toHaveBeenCalled();
  });

  it('answers 404 for an issue outside the project', async () => {
    const { service, repo } = setup(null);
    repo.findIssue.mockResolvedValue(null);
    await expect(create(service)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses when GitHub is not connected', async () => {
    const { service, repo } = setup(null);
    repo.findProject.mockResolvedValue({
      id: PROJECT,
      githubInstallationId: null,
      githubRepo: null,
    });
    await expect(create(service)).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not create twice when another request holds the claim', async () => {
    const { service, github, repo } = setup(null);
    repo.claimIssueCreation.mockResolvedValue(false);

    await expect(create(service)).rejects.toBeInstanceOf(ConflictException);
    expect(github.createIssue).not.toHaveBeenCalled();
  });
});
