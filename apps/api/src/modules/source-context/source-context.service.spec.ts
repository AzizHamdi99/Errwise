import { NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import type { GithubApiClient } from '../github/github-api.client';
import { GithubReadError } from '../github/github-read';
import type { BlobText, RepoTree } from '../github/github-read';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import { SourceContextController } from './source-context.controller';
import type { SourceEvent, SourceProject } from './source-context.repository';
import { SourceContextRepository } from './source-context.repository';
import { SourceContextService } from './source-context.service';

const COMMIT = 'a'.repeat(40);
const SHA_USERS = '1'.repeat(40);
const SHA_BIG = '2'.repeat(40);
const SHA_PNG = '3'.repeat(40);
const SHA_SHORT = '4'.repeat(40);

const text = (lines: number) =>
  Array.from({ length: lines }, (_, i) => `line ${i + 1}`).join('\n');

const STACK = [
  'TypeError: boom',
  '    at getUser (/app/src/users/users.service.js:10:5)',
  '    at Layer.handle (/app/node_modules/express/lib/layer.js:95:5)',
  '    at handler (/app/src/routes.js:3:1)',
].join('\n');

const PROJECT: SourceProject = {
  githubInstallationId: '77',
  githubRepo: 'acme/shop',
  sourceContextEnabled: true,
};
const EVENT: SourceEvent = { stack: STACK, commitSha: 'aaaaaaa' };

function tree(): RepoTree {
  return {
    truncated: false,
    files: new Map([
      ['src/users/users.service.js', { sha: SHA_USERS, size: 300 }],
      ['src/routes.js', { sha: SHA_SHORT, size: 40 }],
      ['src/big.js', { sha: SHA_BIG, size: 600 * 1024 }],
      ['src/logo.png', { sha: SHA_PNG, size: 900 }],
    ]),
  };
}

function setup(
  overrides: {
    project?: SourceProject | null;
    event?: SourceEvent | null;
  } = {},
) {
  const repo = {
    findProject: jest
      .fn()
      .mockResolvedValue('project' in overrides ? overrides.project : PROJECT),
    findEvent: jest
      .fn()
      .mockResolvedValue('event' in overrides ? overrides.event : EVENT),
  };
  const blobs: Record<string, BlobText> = {
    [SHA_USERS]: { kind: 'text', text: text(30) },
    [SHA_SHORT]: { kind: 'text', text: text(2) }, // shorter than line 3
    [SHA_PNG]: { kind: 'binary' },
  };
  const github = {
    resolveCommit: jest.fn().mockResolvedValue(COMMIT),
    getTree: jest.fn().mockImplementation(() => Promise.resolve(tree())),
    getBlobText: jest
      .fn()
      .mockImplementation((_i: string, _r: string, sha: string) =>
        Promise.resolve(blobs[sha] ?? { kind: 'text', text: text(5) }),
      ),
  };
  const service = new SourceContextService(
    repo as unknown as SourceContextRepository,
    github as unknown as GithubApiClient,
  );
  return { service, repo, github };
}

const get = (service: SourceContextService) =>
  service.get('org1', 'p1', 'i1', 'e1');

describe('SourceContextService: where the answer is "no code"', () => {
  it('is 404 for a project of another organization or an event of another issue', async () => {
    const noProject = setup({ project: null });
    await expect(get(noProject.service)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(noProject.repo.findProject).toHaveBeenCalledWith('org1', 'p1');
    expect(noProject.repo.findEvent).not.toHaveBeenCalled();

    const noEvent = setup({ event: null });
    await expect(get(noEvent.service)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(noEvent.repo.findEvent).toHaveBeenCalledWith('p1', 'i1', 'e1');
  });

  it.each([
    ['disabled', { ...PROJECT, sourceContextEnabled: false }, EVENT],
    ['not_connected', { ...PROJECT, githubRepo: null }, EVENT],
    ['not_connected', { ...PROJECT, githubInstallationId: null }, EVENT],
    ['no_commit', PROJECT, { ...EVENT, commitSha: null }],
  ])('answers %s without calling GitHub', async (status, project, event) => {
    const { service, github } = setup({ project, event });

    await expect(get(service)).resolves.toMatchObject({ status, frames: [] });
    expect(github.resolveCommit).not.toHaveBeenCalled();
  });

  it('is ok with no frames, and no GitHub call, when the stack has no app code', async () => {
    const { service, github } = setup({
      event: {
        ...EVENT,
        stack: 'Error: x\n    at a (/app/node_modules/x/y.js:1:1)',
      },
    });

    await expect(get(service)).resolves.toMatchObject({
      status: 'ok',
      frames: [],
    });
    expect(github.getTree).not.toHaveBeenCalled();
  });

  it('is ok with no frames when the event has no stack', async () => {
    const { service } = setup({ event: { ...EVENT, stack: null } });
    await expect(get(service)).resolves.toMatchObject({
      status: 'ok',
      frames: [],
    });
  });
});

describe('SourceContextService: the code', () => {
  it('shows the lines around the failing line, with a link at the exact commit', async () => {
    const { service, github } = setup();

    const result = await get(service);

    expect(result.status).toBe('ok');
    expect(result.commitSha).toBe('aaaaaaa');
    const [first] = result.frames;
    expect(first).toEqual({
      frameIndex: 0,
      status: 'found',
      repoPath: 'src/users/users.service.js',
      line: 10,
      startLine: 5,
      lines: [
        'line 5',
        'line 6',
        'line 7',
        'line 8',
        'line 9',
        'line 10',
        'line 11',
        'line 12',
        'line 13',
        'line 14',
        'line 15',
      ],
      url: `https://github.com/acme/shop/blob/${COMMIT}/src/users/users.service.js#L10`,
    });
    // The short commit from the event was resolved to the full one before anything else.
    expect(github.resolveCommit).toHaveBeenCalledWith(
      '77',
      'acme/shop',
      'aaaaaaa',
    );
    expect(github.getTree).toHaveBeenCalledWith('77', 'acme/shop', COMMIT);
  });

  it('keeps frame indexes of the parsed stack and skips library frames', async () => {
    const { service } = setup();
    const result = await get(service);

    // Index 1 is the node_modules frame: absent. Index 2 is the routes.js frame.
    expect(result.frames.map((f) => f.frameIndex)).toEqual([0, 2]);
  });

  it('explains why a frame has no code', async () => {
    const stack = [
      'Error: x',
      '    at a (/app/dist/users/users.service.js:1:1)', // compiled
      '    at b (/app/src/nope.js:1:1)', // no such file
      '    at c (/app/src/big.js:1:1)', // too large
      '    at d (/app/src/logo.png:1:1)', // binary
      '    at e (/app/src/routes.js:9:1)', // file shorter than the line
    ].join('\n');
    const { service } = setup({ event: { ...EVENT, stack } });

    const result = await get(service);

    expect(
      result.frames.map((f) =>
        f.status === 'unresolved' ? f.reason : f.status,
      ),
    ).toEqual([
      'compiled',
      'not_found',
      'too_large',
      'binary',
      'line_out_of_range',
    ]);
  });

  it('shows at most ten frames', async () => {
    const stack = ['Error: x']
      .concat(
        Array.from(
          { length: 25 },
          (_, i) => `    at f${i} (/app/src/users/users.service.js:${i + 1}:1)`,
        ),
      )
      .join('\n');
    const { service } = setup({ event: { ...EVENT, stack } });

    expect((await get(service)).frames).toHaveLength(10);
  });

  it('url-encodes the path, so a file name can not break out of the link', async () => {
    const stack = 'Error: x\n    at a (/app/src/my file+v2.js:2:1)';
    const { service, github } = setup({ event: { ...EVENT, stack } });
    github.getTree.mockResolvedValue({
      truncated: false,
      files: new Map([['src/my file+v2.js', { sha: SHA_USERS, size: 10 }]]),
    });

    const [frame] = (await get(service)).frames;

    expect(frame).toMatchObject({
      status: 'found',
      url: `https://github.com/acme/shop/blob/${COMMIT}/src/my%20file%2Bv2.js#L2`,
    });
  });
});

describe('SourceContextService: GitHub problems', () => {
  it.each([
    ['not_found', 'commit_not_found'],
    ['forbidden', 'no_permission'],
    ['rate_limited', 'rate_limited'],
    ['unavailable', 'unavailable'],
  ] as const)(
    'maps a failed commit lookup (%s) to %s',
    async (kind, status) => {
      const { service, github } = setup();
      github.resolveCommit.mockRejectedValue(new GithubReadError(kind));

      await expect(get(service)).resolves.toMatchObject({ status, frames: [] });
    },
  );

  it('maps a failed tree read the same way', async () => {
    const { service, github } = setup();
    github.getTree.mockRejectedValue(new GithubReadError('forbidden'));
    await expect(get(service)).resolves.toMatchObject({
      status: 'no_permission',
    });
  });

  it('a missing or unreachable file only costs that frame', async () => {
    const { service, github } = setup();
    github.getBlobText.mockRejectedValue(new GithubReadError('not_found'));
    const result = await get(service);
    expect(result.status).toBe('ok');
    expect(
      result.frames.every(
        (f) => f.status === 'unresolved' && f.reason === 'not_found',
      ),
    ).toBe(true);

    const flaky = setup();
    flaky.github.getBlobText.mockRejectedValue(
      new GithubReadError('unavailable'),
    );
    expect((await get(flaky.service)).frames[0]).toMatchObject({
      reason: 'unavailable',
    });
  });

  it('a missing permission or a rate limit on a file ends the whole answer', async () => {
    const denied = setup();
    denied.github.getBlobText.mockRejectedValue(
      new GithubReadError('forbidden'),
    );
    await expect(get(denied.service)).resolves.toMatchObject({
      status: 'no_permission',
      frames: [],
    });

    const limited = setup();
    limited.github.getBlobText.mockRejectedValue(
      new GithubReadError('rate_limited'),
    );
    await expect(get(limited.service)).resolves.toMatchObject({
      status: 'rate_limited',
      frames: [],
    });
  });

  it('does not hide a real bug behind a status', async () => {
    const { service, github } = setup();
    github.getTree.mockRejectedValue(new TypeError('a bug in our code'));
    await expect(get(service)).rejects.toThrow('a bug in our code');
  });
});

describe('SourceContextService: caching and isolation', () => {
  it('reads each thing from GitHub once, however often it is asked', async () => {
    const { service, github } = setup();

    await get(service);
    await get(service);
    await get(service);

    expect(github.resolveCommit).toHaveBeenCalledTimes(1);
    expect(github.getTree).toHaveBeenCalledTimes(1);
    expect(github.getBlobText).toHaveBeenCalledTimes(2); // users.service.js and routes.js
  });

  it('merges simultaneous requests into one set of GitHub calls', async () => {
    const { service, github } = setup();

    await Promise.all([get(service), get(service), get(service)]);

    expect(github.getTree).toHaveBeenCalledTimes(1);
  });

  it('does not share code between installations, even for the same repository', async () => {
    const { service, repo, github } = setup();
    await get(service);

    repo.findProject.mockResolvedValue({
      ...PROJECT,
      githubInstallationId: '88',
    });
    await get(service);

    expect(github.getTree).toHaveBeenCalledTimes(2);
    expect(github.getTree).toHaveBeenLastCalledWith('88', 'acme/shop', COMMIT);
  });

  it('does not keep a failure', async () => {
    const { service, github } = setup();
    github.resolveCommit.mockRejectedValueOnce(
      new GithubReadError('unavailable'),
    );

    await expect(get(service)).resolves.toMatchObject({
      status: 'unavailable',
    });
    await expect(get(service)).resolves.toMatchObject({ status: 'ok' });
  });
});

describe('SourceContextController', () => {
  it('requires a logged-in member of the organization', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      SourceContextController,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, OrgMemberGuard]);
  });
});
