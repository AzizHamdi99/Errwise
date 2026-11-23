import {
  BadGatewayException,
  ConflictException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Event, Issue, IssueFix } from '@prisma/client';
import type { FixResult } from '@errwise/shared';
import type { AiQuotaService } from '../ai-quota/ai-quota.service';
import type { AiClient } from '../analysis/ai.client';
import type { GithubApiClient } from '../github/github-api.client';
import { GithubReadError } from '../github/github-read';
import type { SourceContextService } from '../source-context/source-context.service';
import type { FixSourceResult } from '../source-context/source-context.service';
import type {
  FixesRepository,
  FixProject,
  SaveFixData,
} from './fixes.repository';
import { FixesService } from './fixes.service';

const FULL = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const SLOT = {
  organizationId: 'org1',
  day: new Date('2026-01-01T00:00:00Z'),
};

const TEXT = [
  'async function getUser(id) {',
  '  const user = await db.find(id);',
  '  return user.profile.name;',
  '}',
  '',
].join('\n');

const PROJECT: FixProject = {
  githubInstallationId: '77',
  githubRepo: 'acme/shop',
  sourceContextEnabled: true,
  fixPullRequestsEnabled: true,
};
const ISSUE = { id: 'i1', projectId: 'p1', type: 'TypeError' } as Issue;
const EVENT = {
  id: 'e1',
  issueId: 'i1',
  type: 'TypeError',
  message: 'User bob@x.com not found',
  stack: 'TypeError: x\n    at getUser (/app/src/users.js:3:15)',
  environment: 'production',
  release: '1.0.0',
  context: { token: 'secret-context-value' },
} as unknown as Event;

const SOURCE: FixSourceResult = {
  status: 'ok',
  commitSha: 'aaaaaaa',
  fullSha: FULL,
  installationId: '77',
  repo: 'acme/shop',
  files: [{ path: 'src/users.js', text: TEXT, line: 3 }],
};

const FIXED: FixResult = {
  fixable: true,
  prTitle: 'Handle a missing user',
  explanation: 'db.find returns null for an unknown id.',
  confidence: 'high',
  edits: [
    {
      file: 'src/users.js',
      search: '  return user.profile.name;',
      replace: '  return user?.profile.name;',
    },
  ],
  reason: '',
  promptVersion: 'fix-v1',
  model: 'test-model',
};
const REFUSED: FixResult = {
  ...FIXED,
  fixable: false,
  prTitle: '',
  explanation: '',
  edits: [],
  reason: 'A database setting, not this code.',
};

function row(overrides: Partial<IssueFix> = {}): IssueFix {
  return {
    id: 'f1',
    issueId: 'i1',
    inputHash: 'h',
    promptVersion: 'fix-v1',
    model: 'test-model',
    repo: 'acme/shop',
    installationId: '77',
    commitSha: FULL,
    result: {
      fixable: true,
      prTitle: 'Handle a missing user',
      explanation: 'x',
      confidence: 'high',
      reason: '',
      files: ['src/users.js:3'],
      warnings: [],
      promptVersion: 'fix-v1',
      model: 'test-model',
    },
    edits: [
      {
        file: 'src/users.js',
        search: '  return user.profile.name;',
        replace: '  return user?.profile.name;',
        line: 3,
      },
    ],
    prClaimedAt: null,
    prNumber: null,
    prUrl: null,
    prOpenedById: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function setup() {
  const repo = {
    findProject: jest.fn().mockResolvedValue(PROJECT),
    findIssue: jest.fn().mockResolvedValue(ISSUE),
    latestEvent: jest.fn().mockResolvedValue(EVENT),
    findFix: jest.fn().mockResolvedValue(null),
    latestFix: jest.fn().mockResolvedValue(null),
    saveFix: jest
      .fn()
      .mockImplementation((data: { result: object; edits: object[] }) =>
        Promise.resolve({
          status: 'saved',
          created: true,
          fix: row({ result: data.result, edits: data.edits }),
        }),
      ),
  };
  const sourceContext = {
    getFixSource: jest.fn().mockResolvedValue(SOURCE),
    readFileAtCommit: jest.fn().mockResolvedValue({ kind: 'text', text: TEXT }),
  };
  const github = {
    getDefaultBranchHead: jest
      .fn()
      .mockResolvedValue({ branch: 'main', sha: FULL }),
  };
  const ai = {
    enabled: true,
    fix: jest.fn<Promise<FixResult>, [unknown]>().mockResolvedValue(FIXED),
  };
  const quota = {
    reserve: jest.fn().mockResolvedValue(SLOT),
    giveBack: jest.fn().mockResolvedValue(undefined),
  };
  const service = new FixesService(
    repo as unknown as FixesRepository,
    sourceContext as unknown as SourceContextService,
    github as unknown as GithubApiClient,
    ai as unknown as AiClient,
    quota as unknown as AiQuotaService,
  );
  return { service, repo, sourceContext, github, ai, quota };
}

const suggest = (s: ReturnType<typeof setup>['service']) =>
  s.suggest('org1', 'p1', 'i1');

/** What the service asked the repository to store. */
const saved = (repo: { saveFix: jest.Mock }): SaveFixData =>
  (repo.saveFix.mock.calls[0] as [SaveFixData])[0];

describe('FixesService.suggest: the happy path', () => {
  it('asks the AI once, stores the checked edits and reports a fresh fix', async () => {
    const { service, repo, ai, quota } = setup();

    const out = await suggest(service);

    expect(ai.fix).toHaveBeenCalledTimes(1);
    expect(quota.reserve).toHaveBeenCalledWith('org1');
    expect(quota.giveBack).not.toHaveBeenCalled();
    expect(saved(repo)).toMatchObject({
      organizationId: 'org1',
      projectId: 'p1',
      issueId: 'i1',
      repo: 'acme/shop',
      installationId: '77',
      commitSha: FULL,
      promptVersion: 'fix-v1',
      model: 'test-model',
      edits: [
        {
          file: 'src/users.js',
          search: '  return user.profile.name;',
          replace: '  return user?.profile.name;',
          line: 3,
        },
      ],
      result: { fixable: true, files: ['src/users.js:3'], warnings: [] },
    });
    expect(out.cached).toBe(false);
    expect(out.suggestion?.edits[0].line).toBe(3);
    expect(out.pullRequest).toBeNull();
  });

  it('stores what the model wrote only after checking it, with warnings for what it adds', async () => {
    const { service, repo, ai } = setup();
    ai.fix.mockResolvedValue({
      ...FIXED,
      edits: [
        {
          file: 'src/users.js',
          search: '  return user.profile.name;',
          replace: '  return process.env.NAME ?? user.profile.name;',
        },
      ],
    });

    await suggest(service);

    expect(saved(repo).result.warnings).toEqual(['reads_environment']);
  });

  it('sends only scrubbed text and code, never the context of the event', async () => {
    const { service, sourceContext, ai } = setup();
    // The real code has a secret in the window.
    const secret = 'sk-abcdefghijklmnopqrstuvwxyz0123';
    sourceContext.getFixSource.mockResolvedValue({
      ...SOURCE,
      files: [
        {
          path: 'src/users.js',
          text: `const k = "${secret}";\n${TEXT}`,
          line: 4,
        },
      ],
    });
    ai.fix.mockResolvedValue(REFUSED);

    await suggest(service);

    const sent = JSON.stringify(ai.fix.mock.calls[0][0]);
    expect(sent).not.toContain(secret);
    expect(sent).not.toContain('bob@x.com');
    expect(sent).not.toContain('secret-context-value');
    expect(sent).toContain('[key]');
    expect(sent).toContain('[email]');
  });
});

describe('FixesService.suggest: cost', () => {
  it('returns a stored fix for the same input without an AI call or a slot', async () => {
    const { service, repo, ai, quota } = setup();
    repo.findFix.mockResolvedValue(row());

    const out = await suggest(service);

    expect(out.cached).toBe(true);
    expect(ai.fix).not.toHaveBeenCalled();
    expect(quota.reserve).not.toHaveBeenCalled();
    expect(repo.saveFix).not.toHaveBeenCalled();
  });

  it('asks again for an input whose code was wiped, and gives it its code back', async () => {
    const { service, repo, ai } = setup();
    repo.findFix.mockResolvedValue(row({ edits: null, result: {} }));

    await suggest(service);

    expect(ai.fix).toHaveBeenCalledTimes(1);
    expect(repo.saveFix).toHaveBeenCalledTimes(1);
  });

  it('keeps a refusal of the model: it is an answer, stored, and it costs the slot', async () => {
    const { service, repo, ai, quota } = setup();
    ai.fix.mockResolvedValue(REFUSED);

    const out = await suggest(service);

    expect(quota.giveBack).not.toHaveBeenCalled();
    expect(saved(repo)).toMatchObject({
      edits: [],
      result: { fixable: false, reason: 'A database setting, not this code.' },
    });
    expect(out.suggestion?.fixable).toBe(false);
  });

  it('answers 429 and makes no AI call when the daily allowance is used up', async () => {
    const { service, ai, quota } = setup();
    quota.reserve.mockResolvedValue(null);

    const error = await suggest(service).catch((e: unknown) => e);

    expect((error as HttpException).getStatus()).toBe(429);
    expect(ai.fix).not.toHaveBeenCalled();
  });

  it('gives the slot back when the AI call fails, and keeps the real error', async () => {
    const { service, repo, ai, quota } = setup();
    ai.fix.mockRejectedValue(new BadGatewayException('AI analysis failed'));

    await expect(suggest(service)).rejects.toBeInstanceOf(BadGatewayException);

    expect(quota.giveBack).toHaveBeenCalledWith(SLOT);
    expect(repo.saveFix).not.toHaveBeenCalled();
  });

  it('gives the slot back when the settings changed while the fix was made', async () => {
    const { service, repo, quota } = setup();
    repo.saveFix.mockResolvedValue({ status: 'project_changed' });

    await expect(suggest(service)).rejects.toBeInstanceOf(ConflictException);

    expect(quota.giveBack).toHaveBeenCalledWith(SLOT);
  });

  it('reports a fix stored by a concurrent request with the same input as already there', async () => {
    const { service, repo } = setup();
    repo.saveFix.mockResolvedValue({
      status: 'saved',
      created: false,
      fix: row(),
    });

    expect((await suggest(service)).cached).toBe(true);
  });
});

describe('FixesService.suggest: a model that cannot be trusted', () => {
  type Edit = FixResult['edits'][number];
  const answerWith = (edit: Partial<Edit>): FixResult => ({
    ...FIXED,
    edits: [{ ...FIXED.edits[0], ...edit }],
  });

  it.each([
    ['text that is not in the file', { search: 'nothing like this' }],
    ['a file that was not sent', { file: 'src/other.js' }],
    ['a file the feature may not edit', { file: '.github/workflows/ci.js' }],
    ['a placeholder of the scrubber', { replace: '  return "[key]";' }],
    ['no change at all', { replace: '  return user.profile.name;' }],
  ])('refuses %s, gives the slot back and stores nothing', async (_n, edit) => {
    const { service, repo, ai, quota } = setup();
    ai.fix.mockResolvedValue(answerWith(edit));

    await expect(suggest(service)).rejects.toBeInstanceOf(BadGatewayException);

    expect(quota.giveBack).toHaveBeenCalledWith(SLOT);
    expect(repo.saveFix).not.toHaveBeenCalled();
  });

  it('refuses a change outside the lines it was shown', async () => {
    const { service, sourceContext, ai, repo } = setup();
    // 100 lines, failing line 50: the window is lines 20 to 80. Line 95 is unique but outside.
    const text = Array.from({ length: 100 }, (_, i) => `line ${i + 1};`).join(
      '\n',
    );
    sourceContext.getFixSource.mockResolvedValue({
      ...SOURCE,
      files: [{ path: 'src/users.js', text, line: 50 }],
    });
    ai.fix.mockResolvedValue(
      answerWith({ search: 'line 95;', replace: 'line 95; evil();' }),
    );

    await expect(suggest(service)).rejects.toBeInstanceOf(BadGatewayException);
    expect(repo.saveFix).not.toHaveBeenCalled();
  });
});

describe('FixesService.suggest: before any cost', () => {
  it('is 404 for a project of another organization, before anything else', async () => {
    const { service, repo, sourceContext, ai } = setup();
    repo.findProject.mockResolvedValue(null);

    await expect(suggest(service)).rejects.toBeInstanceOf(NotFoundException);

    expect(repo.findProject).toHaveBeenCalledWith('org1', 'p1');
    expect(repo.findIssue).not.toHaveBeenCalled();
    expect(sourceContext.getFixSource).not.toHaveBeenCalled();
    expect(ai.fix).not.toHaveBeenCalled();
  });

  it('is 404 for an issue that is not in the project', async () => {
    const { service, repo, ai } = setup();
    repo.findIssue.mockResolvedValue(null);

    await expect(suggest(service)).rejects.toBeInstanceOf(NotFoundException);

    expect(repo.findIssue).toHaveBeenCalledWith('p1', 'i1');
    expect(ai.fix).not.toHaveBeenCalled();
  });

  it('is 404 for an issue without events', async () => {
    const { service, repo } = setup();
    repo.latestEvent.mockResolvedValue(null);
    await expect(suggest(service)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['fixes are off', { fixPullRequestsEnabled: false }],
    ['source code is off', { sourceContextEnabled: false }],
  ])('is 409 and touches nothing when %s', async (_name, override) => {
    const { service, repo, sourceContext, github, ai, quota } = setup();
    repo.findProject.mockResolvedValue({ ...PROJECT, ...override });

    await expect(suggest(service)).rejects.toBeInstanceOf(ConflictException);

    expect(sourceContext.getFixSource).not.toHaveBeenCalled();
    expect(github.getDefaultBranchHead).not.toHaveBeenCalled();
    expect(quota.reserve).not.toHaveBeenCalled();
    expect(ai.fix).not.toHaveBeenCalled();
  });

  it('is 409 when GitHub is not connected', async () => {
    const { service, repo } = setup();
    repo.findProject.mockResolvedValue({ ...PROJECT, githubRepo: null });
    await expect(suggest(service)).rejects.toBeInstanceOf(ConflictException);
  });

  it('is 503 when the AI service is not configured, before GitHub is called', async () => {
    const { service, ai, sourceContext } = setup();
    ai.enabled = false;

    await expect(suggest(service)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(sourceContext.getFixSource).not.toHaveBeenCalled();
  });

  it.each([
    ['disabled', 409],
    ['not_connected', 409],
    ['no_commit', 409],
    ['commit_not_found', 409],
    ['no_permission', 409],
    ['rate_limited', 429],
    ['unavailable', 502],
  ] as const)(
    'maps the source problem "%s" to %i, with no slot taken',
    async (status, code) => {
      const { service, sourceContext, quota, ai } = setup();
      sourceContext.getFixSource.mockResolvedValue({ status, commitSha: null });

      const error = await suggest(service).catch((e: unknown) => e);

      expect((error as HttpException).getStatus()).toBe(code);
      expect(quota.reserve).not.toHaveBeenCalled();
      expect(ai.fix).not.toHaveBeenCalled();
    },
  );

  it('is 422 when no file the feature may change can be matched', async () => {
    const { service, sourceContext, quota } = setup();
    sourceContext.getFixSource.mockResolvedValue({ ...SOURCE, files: [] });
    await expect(suggest(service)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );

    sourceContext.getFixSource.mockResolvedValue({
      ...SOURCE,
      files: [{ path: 'webpack.config.js', text: TEXT, line: 3 }],
    });
    await expect(suggest(service)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(quota.reserve).not.toHaveBeenCalled();
  });
});

describe('FixesService.suggest: the default branch', () => {
  it('reads no file when the deployed commit is still the tip', async () => {
    const { service, sourceContext } = setup();
    await suggest(service);
    expect(sourceContext.readFileAtCommit).not.toHaveBeenCalled();
  });

  it('accepts a moved branch when the lines the model will see are still there', async () => {
    const { service, github, sourceContext, ai } = setup();
    github.getDefaultBranchHead.mockResolvedValue({
      branch: 'main',
      sha: HEAD,
    });
    // Something was added above, the window itself is unchanged.
    sourceContext.readFileAtCommit.mockResolvedValue({
      kind: 'text',
      text: `// new header\n${TEXT}`,
    });

    await suggest(service);

    expect(sourceContext.readFileAtCommit).toHaveBeenCalledWith(
      '77',
      'acme/shop',
      HEAD,
      'src/users.js',
    );
    expect(ai.fix).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'the lines changed',
      { kind: 'text', text: TEXT.replace('profile', 'p2') },
    ],
    ['the file is gone', null],
    ['the file became binary', { kind: 'binary' }],
    ['the file is now too large', { kind: 'too_large' }],
  ])('is 409 with no slot taken when %s', async (_name, blob) => {
    const { service, github, sourceContext, quota, ai } = setup();
    github.getDefaultBranchHead.mockResolvedValue({
      branch: 'main',
      sha: HEAD,
    });
    sourceContext.readFileAtCommit.mockResolvedValue(blob);

    await expect(suggest(service)).rejects.toBeInstanceOf(ConflictException);

    expect(quota.reserve).not.toHaveBeenCalled();
    expect(ai.fix).not.toHaveBeenCalled();
  });

  it('maps a GitHub failure on the default branch like any other', async () => {
    const { service, github, quota } = setup();
    github.getDefaultBranchHead.mockRejectedValue(
      new GithubReadError('rate_limited'),
    );

    const error = await suggest(service).catch((e: unknown) => e);

    expect((error as HttpException).getStatus()).toBe(429);
    expect(quota.reserve).not.toHaveBeenCalled();
  });

  it('does not hide a real bug behind a status', async () => {
    const { service, github } = setup();
    github.getDefaultBranchHead.mockRejectedValue(new TypeError('bug'));
    await expect(suggest(service)).rejects.toBeInstanceOf(TypeError);
  });
});

describe('FixesService.get', () => {
  it('is 404 until a fix exists', async () => {
    const { service } = setup();
    await expect(service.get('org1', 'p1', 'i1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the latest fix, as a stored one', async () => {
    const { service, repo } = setup();
    repo.latestFix.mockResolvedValue(
      row({ prNumber: 12, prUrl: 'https://github.com/acme/shop/pull/12' }),
    );

    const out = await service.get('org1', 'p1', 'i1');

    expect(out.cached).toBe(true);
    expect(out.pullRequest).toEqual({
      number: 12,
      url: 'https://github.com/acme/shop/pull/12',
    });
    expect(out.suggestion?.edits).toHaveLength(1);
  });

  it('shows no suggestion for a row whose code was wiped, but keeps the link', async () => {
    const { service, repo } = setup();
    repo.latestFix.mockResolvedValue(
      row({
        edits: null,
        result: {},
        prNumber: 12,
        prUrl: 'https://github.com/acme/shop/pull/12',
      }),
    );

    const out = await service.get('org1', 'p1', 'i1');

    expect(out.suggestion).toBeNull();
    expect(out.pullRequest?.number).toBe(12);
  });

  it('is 404 when a switch is off, even if a row was left behind', async () => {
    const { service, repo } = setup();
    repo.latestFix.mockResolvedValue(row());
    repo.findProject.mockResolvedValue({
      ...PROJECT,
      fixPullRequestsEnabled: false,
    });

    await expect(service.get('org1', 'p1', 'i1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('is 404 for another tenant, for the project and for the issue', async () => {
    const { service, repo } = setup();
    repo.findProject.mockResolvedValue(null);
    await expect(service.get('other', 'p1', 'i1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    repo.findProject.mockResolvedValue(PROJECT);
    repo.findIssue.mockResolvedValue(null);
    await expect(service.get('org1', 'p1', 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.findIssue).toHaveBeenCalledWith('p1', 'nope');
  });
});
