import type { Event, Issue, IssueAnalysis } from '@prisma/client';
import type {
  AnalysisResult,
  AnalyzeRequest,
  SourceContextResult,
  SourceFrame,
} from '@errwise/shared';
import type { AiQuotaService } from '../ai-quota/ai-quota.service';
import type { ProjectsService } from '../projects/projects.service';
import type { SourceContextService } from '../source-context/source-context.service';
import type { AiClient } from './ai.client';
import type {
  AnalysisRepository,
  SaveAnalysisData,
} from './analysis.repository';
import { AnalysisService } from './analysis.service';

const RESULT: AnalysisResult = {
  summary: 'A TypeError occurred.',
  probableCause: 'src/server.mjs line 46 sets user to undefined.',
  suggestedFix: 'Check the user first.',
  confidence: 'high',
  framesUsed: [],
  promptVersion: 'v3',
  model: 'test-model',
};

const ISSUE = { id: 'i1', projectId: 'p1', type: 'TypeError' } as Issue;
const EVENT = {
  id: 'e1',
  issueId: 'i1',
  type: 'TypeError',
  message: 'boom',
  stack: 'Error: boom',
  environment: 'production',
  release: null,
  context: null,
} as unknown as Event;

function storedRow(result: object = RESULT): IssueAnalysis {
  return {
    id: 'a1',
    issueId: 'i1',
    inputHash: 'h',
    promptVersion: 'v3',
    model: 'test-model',
    result,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function setup() {
  const repo = {
    findIssue: jest.fn().mockResolvedValue(ISSUE),
    latestEvent: jest.fn().mockResolvedValue(EVENT),
    findAnalysis: jest
      .fn<Promise<IssueAnalysis | null>, [string, string]>()
      .mockResolvedValue(null),
    latestAnalysis: jest.fn().mockResolvedValue(null),
    saveAnalysis: jest
      .fn<Promise<IssueAnalysis>, [SaveAnalysisData]>()
      .mockResolvedValue(storedRow()),
  };
  const ai = {
    analyze: jest
      .fn<Promise<AnalysisResult>, [AnalyzeRequest]>()
      .mockResolvedValue(RESULT),
  };
  // Off by default: the project has not opted in to sharing its source code.
  const sourceContext = {
    get: jest.fn().mockResolvedValue({
      status: 'disabled',
      commitSha: null,
      frames: [],
    }),
  };
  const quota = {
    reserve: jest.fn().mockResolvedValue({
      organizationId: 'org1',
      day: new Date('2026-01-01T00:00:00Z'),
    }),
    giveBack: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AnalysisService(
    repo as unknown as AnalysisRepository,
    { get: jest.fn().mockResolvedValue({}) } as unknown as ProjectsService,
    ai as unknown as AiClient,
    sourceContext as unknown as SourceContextService,
    quota as unknown as AiQuotaService,
  );
  return { service, repo, ai, sourceContext };
}

type Found = Extract<SourceFrame, { status: 'found' }>;

function found(overrides: Partial<Found> = {}): SourceFrame {
  return {
    frameIndex: 0,
    status: 'found',
    repoPath: 'src/server.mjs',
    line: 47,
    startLine: 46,
    lines: ['const user = undefined;', 'return user.name;', '});'],
    url: 'https://github.com/acme/shop/blob/abc/src/server.mjs#L47',
    ...overrides,
  };
}

const withCode = (...frames: SourceFrame[]): SourceContextResult => ({
  status: 'ok',
  commitSha: 'a'.repeat(40),
  frames,
});

const NEWLINE = String.fromCharCode(10);
const analyze = (service: AnalysisService) =>
  service.analyze('org1', 'p1', 'i1');

describe('AnalysisService: source code', () => {
  it('sends the lines around the failing line, numbered, when the project shares its code', async () => {
    const { service, ai, sourceContext } = setup();
    sourceContext.get.mockResolvedValue(withCode(found()));

    await analyze(service);

    expect(sourceContext.get).toHaveBeenCalledWith('org1', 'p1', 'i1', 'e1');
    expect(ai.analyze.mock.calls[0]?.[0].sourceContext).toEqual([
      {
        file: 'src/server.mjs',
        line: 47,
        code: [
          '  46 | const user = undefined;',
          '> 47 | return user.name;',
          '  48 | });',
        ].join(NEWLINE),
      },
    ]);
  });

  it('sends no code at all when the project did not opt in', async () => {
    const { service, ai } = setup(); // the source service answers "disabled"

    await analyze(service);

    expect(ai.analyze.mock.calls[0]?.[0].sourceContext).toBeUndefined();
  });

  it('sends no code when GitHub could not provide it, for whatever reason', async () => {
    const reasons = [
      'not_connected',
      'no_commit',
      'commit_not_found',
      'no_permission',
      'rate_limited',
      'unavailable',
    ] as const;

    for (const status of reasons) {
      const { service, ai, sourceContext } = setup();
      sourceContext.get.mockResolvedValue({
        status,
        commitSha: null,
        frames: [],
      });

      await analyze(service);

      expect(ai.analyze.mock.calls[0]?.[0].sourceContext).toBeUndefined();
    }
  });

  it('still analyzes the error when reading the code blows up', async () => {
    const { service, ai, sourceContext } = setup();
    sourceContext.get.mockRejectedValue(new Error('GitHub exploded'));

    await expect(analyze(service)).resolves.toMatchObject({
      summary: RESULT.summary,
    });
    expect(ai.analyze.mock.calls[0]?.[0].sourceContext).toBeUndefined();
  });

  it('scrubs secrets and personal data in the code before it leaves', async () => {
    const { service, ai, sourceContext } = setup();
    sourceContext.get.mockResolvedValue(
      withCode(
        found({
          startLine: 45,
          lines: [
            "const owner = 'dev@acme.io';",
            "const auth = 'Bearer abcdef1234567890xyz';",
            'return user.name;',
          ],
        }),
      ),
    );

    await analyze(service);

    const sent = JSON.stringify(ai.analyze.mock.calls[0]?.[0]);
    expect(sent).not.toContain('dev@acme.io');
    expect(sent).not.toContain('abcdef1234567890xyz');
    expect(sent).toContain('[email]');
  });

  it('sends only frames that have code, at most five', async () => {
    const { service, ai, sourceContext } = setup();
    const frames: SourceFrame[] = [
      { frameIndex: 0, status: 'unresolved', reason: 'compiled' },
      ...Array.from({ length: 8 }, (_, i) =>
        found({ frameIndex: i + 1, line: 10 + i, startLine: 9 + i }),
      ),
    ];
    sourceContext.get.mockResolvedValue(withCode(...frames));

    await analyze(service);

    const snippets = ai.analyze.mock.calls[0]?.[0].sourceContext ?? [];
    expect(snippets.map((s) => s.line)).toEqual([10, 11, 12, 13, 14]);
  });

  it('remembers which files the analysis looked at', async () => {
    const shared = setup();
    shared.sourceContext.get.mockResolvedValue(withCode(found()));
    await analyze(shared.service);
    expect(shared.repo.saveAnalysis.mock.calls[0]?.[0].result).toMatchObject({
      sourceFiles: ['src/server.mjs:47'],
    });

    const plain = setup();
    await analyze(plain.service);
    expect(plain.repo.saveAnalysis.mock.calls[0]?.[0].result).toMatchObject({
      sourceFiles: [],
    });
  });

  it('looks up a stored analysis by an input that includes the code', async () => {
    const without = setup();
    await analyze(without.service);

    const withSource = setup();
    withSource.sourceContext.get.mockResolvedValue(withCode(found()));
    await analyze(withSource.service);

    expect(without.repo.findAnalysis.mock.calls[0]?.[1]).not.toBe(
      withSource.repo.findAnalysis.mock.calls[0]?.[1],
    );
  });

  it('returns the files in the public analysis, and an empty list for old rows', async () => {
    const { service, repo } = setup();
    repo.latestAnalysis.mockResolvedValue(
      storedRow({ ...RESULT, sourceFiles: ['src/a.js:3'] }),
    );
    await expect(service.get('org1', 'p1', 'i1')).resolves.toMatchObject({
      sourceFiles: ['src/a.js:3'],
    });

    repo.latestAnalysis.mockResolvedValue(storedRow()); // stored before code was sent
    await expect(service.get('org1', 'p1', 'i1')).resolves.toMatchObject({
      sourceFiles: [],
    });
  });
});
