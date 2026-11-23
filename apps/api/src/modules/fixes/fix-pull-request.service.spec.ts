import { ConflictException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Issue } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { StoredFixEdit, StoredFixResult } from '@errwise/shared';
import type { Env } from '../../config/env';
import type { AuditService } from '../audit/audit.service';
import type { GithubApiClient } from '../github/github-api.client';
import { GithubTokenError } from '../github/github-api.client';
import { GithubReadError } from '../github/github-read';
import type { OrgMembership } from '../memberships/memberships.types';
import { FixPullRequestService } from './fix-pull-request.service';
import type {
  FixProject,
  FixesRepository,
  FixWithIssue,
} from './fixes.repository';

// U+FEFF, written as a number so no invisible character sits in the source.
const BOM = String.fromCharCode(0xfeff);
const HEAD = 'a'.repeat(40);
const BASE_TREE = 'b'.repeat(40);
const BLOB = 'c'.repeat(40);
const NEW_BLOB = 'd'.repeat(40);
const NEW_TREE = 'e'.repeat(40);
const COMMIT = 'f'.repeat(40);
const FIX_ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
const BRANCH = `errwise/fix-${FIX_ID}`;
const PR = { number: 34, url: 'https://github.com/acme/shop/pull/34' };

const TEXT = [
  'async function getUser(id) {',
  '  const user = await db.find(id);',
  '  return user.profile.name;',
  '}',
  '',
].join('\n');
const PATCHED = TEXT.replace(
  '  return user.profile.name;',
  '  return user?.profile.name;',
);

const EDIT: StoredFixEdit = {
  file: 'src/users.js',
  search: '  return user.profile.name;',
  replace: '  return user?.profile.name;',
  line: 3,
  prefix: '',
  suffix: '',
};
const RESULT: StoredFixResult = {
  fixable: true,
  prTitle: 'Handle a missing user',
  explanation: 'db.find returns null for an unknown id.',
  confidence: 'high',
  reason: '',
  files: ['src/users.js:3'],
  warnings: [],
  promptVersion: 'fix-v1',
  model: 'test-model',
};

const MEMBERSHIP: OrgMembership = {
  userId: 'u1',
  organizationId: 'org1',
  role: 'admin',
};
const PROJECT: FixProject = {
  githubInstallationId: '77',
  githubRepo: 'acme/shop',
  sourceContextEnabled: true,
  fixPullRequestsEnabled: true,
};

function fixRow(overrides: Partial<FixWithIssue> = {}): FixWithIssue {
  return {
    id: FIX_ID,
    issueId: 'i1',
    inputHash: 'h',
    promptVersion: 'fix-v1',
    model: 'test-model',
    repo: 'acme/shop',
    installationId: '77',
    commitSha: HEAD,
    result: RESULT,
    edits: [EDIT],
    prClaimedAt: null,
    prNumber: null,
    prUrl: null,
    prOpenedById: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    issue: {
      id: 'i1',
      githubIssueNumber: 12,
      githubIssueUrl: 'https://github.com/acme/shop/issues/12',
    } as Issue,
    ...overrides,
  };
}

function setup() {
  const repo = {
    findProject: jest.fn().mockResolvedValue(PROJECT),
    findFixInProject: jest.fn().mockResolvedValue(fixRow()),
    claimPullRequest: jest.fn().mockResolvedValue(true),
    isStillOpenable: jest.fn().mockResolvedValue(true),
    releasePullRequestClaim: jest.fn().mockResolvedValue(undefined),
    savePullRequest: jest
      .fn()
      .mockImplementation(
        (_id: string, link: { number: number; url: string; userId: string }) =>
          Promise.resolve({
            saved: true,
            fix: fixRow({
              prNumber: link.number,
              prUrl: link.url,
              prOpenedById: link.userId,
            }),
          }),
      ),
  };
  const github = {
    getDefaultBranchHead: jest
      .fn()
      .mockResolvedValue({ branch: 'main', sha: HEAD }),
    getCommitTree: jest.fn().mockResolvedValue(BASE_TREE),
    getTree: jest.fn().mockResolvedValue({
      truncated: false,
      files: new Map([
        ['src/users.js', { sha: BLOB, size: 120, mode: '100644' }],
      ]),
    }),
    getBlobExact: jest.fn().mockResolvedValue({ kind: 'text', text: TEXT }),
    createBlob: jest.fn().mockResolvedValue(NEW_BLOB),
    createTree: jest.fn().mockResolvedValue(NEW_TREE),
    getBranchHead: jest.fn().mockResolvedValue(null),
    createCommit: jest.fn().mockResolvedValue(COMMIT),
    createBranch: jest.fn().mockResolvedValue('created'),
    findPullRequest: jest.fn().mockResolvedValue(null),
    createPullRequest: jest
      .fn()
      .mockResolvedValue({ kind: 'created', pullRequest: PR }),
    deleteBranch: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: () => 'https://app.errwise.test',
  } as unknown as ConfigService<Env, true>;
  const service = new FixPullRequestService(
    config,
    repo as unknown as FixesRepository,
    github as unknown as GithubApiClient,
    audit as unknown as AuditService,
  );
  return { service, repo, github, audit };
}

type Setup = ReturnType<typeof setup>;
const open = (s: Setup) => s.service.open(MEMBERSHIP, 'p1', 'i1', FIX_ID);
const order = (mock: jest.Mock) => mock.mock.invocationCallOrder[0];

/** Nothing was written to GitHub, and the claim was given back. */
function expectUntouched(s: Setup) {
  expect(s.github.createCommit).not.toHaveBeenCalled();
  expect(s.github.createBranch).not.toHaveBeenCalled();
  expect(s.github.createPullRequest).not.toHaveBeenCalled();
  expect(s.repo.savePullRequest).not.toHaveBeenCalled();
  expect(s.audit.record).not.toHaveBeenCalled();
  expect(s.repo.releasePullRequestClaim).toHaveBeenCalledWith(FIX_ID);
}

describe('opening a pull request: the happy path', () => {
  it('rewrites the file on the default branch, pushes a branch and opens a draft', async () => {
    const s = setup();

    const out = await open(s);

    expect(s.github.createBlob).toHaveBeenCalledWith(
      '77',
      'acme/shop',
      PATCHED,
    );
    expect(s.github.createTree).toHaveBeenCalledWith(
      '77',
      'acme/shop',
      BASE_TREE,
      [{ path: 'src/users.js', mode: '100644', sha: NEW_BLOB }],
    );
    expect(s.github.createCommit).toHaveBeenCalledWith('77', 'acme/shop', {
      message: expect.stringContaining('Apply an AI-suggested fix') as string,
      tree: NEW_TREE,
      parent: HEAD,
    });
    expect(s.github.createBranch).toHaveBeenCalledWith(
      '77',
      'acme/shop',
      BRANCH,
      COMMIT,
    );
    expect(s.github.createPullRequest).toHaveBeenCalledWith(
      '77',
      'acme/shop',
      expect.objectContaining({ head: BRANCH, base: 'main' }),
    );
    expect(s.repo.savePullRequest).toHaveBeenCalledWith(FIX_ID, {
      ...PR,
      userId: 'u1',
    });
    expect(out.pullRequest).toEqual(PR);
    expect(out.cached).toBe(false);
    expect(s.repo.releasePullRequestClaim).not.toHaveBeenCalled();
  });

  it('goes in a safe order: consent is checked right before the first thing that cannot be undone', async () => {
    const s = setup();

    await open(s);

    expect(order(s.repo.claimPullRequest)).toBeLessThan(
      order(s.github.getDefaultBranchHead),
    );
    expect(order(s.github.getBlobExact)).toBeLessThan(
      order(s.github.createBlob),
    );
    expect(order(s.repo.isStillOpenable)).toBeLessThan(
      order(s.github.createBranch),
    );
    expect(order(s.github.createBranch)).toBeLessThan(
      order(s.github.createPullRequest),
    );
    expect(order(s.github.createPullRequest)).toBeLessThan(
      order(s.repo.savePullRequest),
    );
  });

  it('records one audit entry with names and numbers only', async () => {
    const s = setup();

    await open(s);

    expect(s.audit.record).toHaveBeenCalledTimes(1);
    expect(s.audit.record).toHaveBeenCalledWith({
      organizationId: 'org1',
      actorId: 'u1',
      action: 'fix.pull_request_opened',
      targetType: 'project',
      targetId: 'p1',
      projectId: 'p1',
      metadata: { repo: 'acme/shop', number: 34 },
    });
  });

  it('puts the link to the GitHub issue in the body only for an issue of this repository', async () => {
    const s = setup();
    await open(s);
    const body = (
      s.github.createPullRequest.mock.calls[0] as [
        string,
        string,
        { body: string },
      ]
    )[2].body;
    expect(body).toContain('Fixes #12');
    expect(body).toContain(
      'https://app.errwise.test/organizations/org1/projects/p1/issues/i1',
    );

    const other = setup();
    other.repo.findFixInProject.mockResolvedValue(
      fixRow({
        issue: {
          id: 'i1',
          githubIssueNumber: 12,
          githubIssueUrl: 'https://github.com/acme/OLD-repo/issues/12',
        } as Issue,
      }),
    );
    await open(other);
    const otherBody = (
      other.github.createPullRequest.mock.calls[0] as [
        string,
        string,
        { body: string },
      ]
    )[2].body;
    expect(otherBody).not.toContain('Fixes #');
  });

  it('answers 404 for a fix of another tenant, project or issue, and claims nothing', async () => {
    const s = setup();
    s.repo.findFixInProject.mockResolvedValue(null);

    await expect(open(s)).rejects.toBeInstanceOf(NotFoundException);

    expect(s.repo.findFixInProject).toHaveBeenCalledWith(
      'org1',
      'p1',
      'i1',
      FIX_ID,
    );
    expect(s.repo.claimPullRequest).not.toHaveBeenCalled();

    const noProject = setup();
    noProject.repo.findProject.mockResolvedValue(null);
    await expect(open(noProject)).rejects.toBeInstanceOf(NotFoundException);
    expect(noProject.repo.findFixInProject).not.toHaveBeenCalled();
  });
});

describe('opening a pull request: repeating it', () => {
  it('returns the pull request that exists, without any GitHub call, even if the feature is off now', async () => {
    const s = setup();
    s.repo.findFixInProject.mockResolvedValue(
      fixRow({ prNumber: 34, prUrl: PR.url }),
    );
    s.repo.findProject.mockResolvedValue({
      ...PROJECT,
      fixPullRequestsEnabled: false,
    });

    const out = await open(s);

    expect(out.pullRequest).toEqual(PR);
    expect(s.repo.claimPullRequest).not.toHaveBeenCalled();
    expect(s.github.getDefaultBranchHead).not.toHaveBeenCalled();
    expect(s.audit.record).not.toHaveBeenCalled();
  });

  it('lets only one of two requests create it: the other gets the result, or a 409', async () => {
    const lost = setup();
    lost.repo.claimPullRequest.mockResolvedValue(false);
    lost.repo.findFixInProject
      .mockResolvedValueOnce(fixRow())
      .mockResolvedValueOnce(fixRow({ prNumber: 34, prUrl: PR.url }));

    await expect(open(lost)).resolves.toMatchObject({ pullRequest: PR });
    expect(lost.github.getDefaultBranchHead).not.toHaveBeenCalled();

    const busy = setup();
    busy.repo.claimPullRequest.mockResolvedValue(false);
    await expect(open(busy)).rejects.toBeInstanceOf(ConflictException);
    expect(busy.github.getDefaultBranchHead).not.toHaveBeenCalled();
  });

  it('does not record the audit entry twice when another request saved the link first', async () => {
    const s = setup();
    s.repo.savePullRequest.mockResolvedValue({
      saved: false,
      fix: fixRow({ prNumber: 34, prUrl: PR.url }),
    });

    await open(s);

    expect(s.audit.record).not.toHaveBeenCalled();
  });

  it('adopts the pull request of a branch an earlier attempt made, and creates nothing', async () => {
    const s = setup();
    s.github.getBranchHead.mockResolvedValue(COMMIT);
    s.github.getCommitTree.mockImplementation(
      (_i: string, _r: string, sha: string) =>
        Promise.resolve(sha === COMMIT ? NEW_TREE : BASE_TREE),
    );
    s.github.findPullRequest.mockResolvedValue(PR);

    const out = await open(s);

    expect(out.pullRequest).toEqual(PR);
    expect(s.github.createCommit).not.toHaveBeenCalled();
    expect(s.github.createBranch).not.toHaveBeenCalled();
    expect(s.github.createPullRequest).not.toHaveBeenCalled();
  });

  it('opens the pull request from a branch an earlier attempt made but never used', async () => {
    const s = setup();
    s.github.getBranchHead.mockResolvedValue(COMMIT);
    s.github.getCommitTree.mockImplementation(
      (_i: string, _r: string, sha: string) =>
        Promise.resolve(sha === COMMIT ? NEW_TREE : BASE_TREE),
    );

    await open(s);

    expect(s.github.createCommit).not.toHaveBeenCalled();
    expect(s.github.createBranch).not.toHaveBeenCalled();
    expect(s.github.createPullRequest).toHaveBeenCalledTimes(1);
  });

  it("leaves a branch alone that holds anything else: it is somebody's work", async () => {
    const s = setup();
    s.github.getBranchHead.mockResolvedValue(COMMIT);
    s.github.getCommitTree.mockResolvedValue(BASE_TREE); // not NEW_TREE

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);

    expectUntouched(s);
    expect(s.github.deleteBranch).not.toHaveBeenCalled();
  });
});

describe('opening a pull request: refused before anything is claimed', () => {
  it.each([
    ['AI fixes are off', { fixPullRequestsEnabled: false }],
    ['source code is off', { sourceContextEnabled: false }],
    ['GitHub is disconnected', { githubRepo: null }],
    [
      'the project moved to another installation',
      { githubInstallationId: '78' },
    ],
    ['the project moved to another repository', { githubRepo: 'acme/other' }],
  ])('is 409 when %s', async (_name, override) => {
    const s = setup();
    s.repo.findProject.mockResolvedValue({ ...PROJECT, ...override });

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);

    expect(s.repo.claimPullRequest).not.toHaveBeenCalled();
    expect(s.github.getDefaultBranchHead).not.toHaveBeenCalled();
  });

  it('compares the repository without case', async () => {
    const s = setup();
    s.repo.findProject.mockResolvedValue({
      ...PROJECT,
      githubRepo: 'ACME/Shop',
    });
    await expect(open(s)).resolves.toBeDefined();
  });

  it('is 409 for a fix whose code was removed', async () => {
    const s = setup();
    s.repo.findFixInProject.mockResolvedValue(
      fixRow({ edits: null, result: {} }),
    );

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);
    expect(s.repo.claimPullRequest).not.toHaveBeenCalled();
  });

  it('is 409 for a refusal of the model: there is nothing to apply', async () => {
    const s = setup();
    s.repo.findFixInProject.mockResolvedValue(
      fixRow({ edits: [], result: { ...RESULT, fixable: false, reason: 'x' } }),
    );

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);
    expectUntouched(s);
  });
});

describe('opening a pull request: the code changed since the fix was made', () => {
  it('is 409 when the text to replace is gone, and writes nothing', async () => {
    const s = setup();
    s.github.getBlobExact.mockResolvedValue({
      kind: 'text',
      text: TEXT.replace('user.profile.name', 'user.profile.displayName'),
    });

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);

    expect(s.github.createBlob).not.toHaveBeenCalled();
    expectUntouched(s);
  });

  it('is 409 when it is no longer unique', async () => {
    const s = setup();
    s.github.getBlobExact.mockResolvedValue({
      kind: 'text',
      text: `${TEXT}${TEXT}`,
    });

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);
    expectUntouched(s);
  });

  it('is 409 when the file is gone from the default branch, or the tree was cut short', async () => {
    const s = setup();
    s.github.getTree.mockResolvedValue({ truncated: true, files: new Map() });

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);
    expectUntouched(s);
  });

  it('is 409 when applying it would change nothing', async () => {
    const s = setup();
    s.github.getBlobExact.mockResolvedValue({
      kind: 'text',
      text: '  return user.profile.name;\n',
    });
    s.repo.findFixInProject.mockResolvedValue(
      fixRow({ edits: [{ ...EDIT, replace: EDIT.search }] }),
    );

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);
    expectUntouched(s);
  });
});

describe('opening a pull request: files it will not write', () => {
  it.each([
    ['a symlink', { sha: BLOB, size: 10, mode: '120000' }],
    ['a submodule', { sha: BLOB, size: 10, mode: '160000' }],
    ['a file without a known mode', { sha: BLOB, size: 10 }],
    [
      'a file that is too large',
      { sha: BLOB, size: 600 * 1024, mode: '100644' },
    ],
  ])('refuses %s', async (_name, entry) => {
    const s = setup();
    s.github.getTree.mockResolvedValue({
      truncated: false,
      files: new Map([['src/users.js', entry]]),
    });

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);

    expect(s.github.getBlobExact).not.toHaveBeenCalled();
    expectUntouched(s);
  });

  it.each([
    ['binary content', { kind: 'binary' }],
    ['content that is not UTF-8', { kind: 'invalid_utf8' }],
    ['content that grew too large', { kind: 'too_large' }],
    [
      'text with mixed line endings',
      { kind: 'text', text: `${TEXT.replace('\n', '\r\n')}` },
    ],
  ])('refuses %s', async (_name, blob) => {
    const s = setup();
    s.github.getBlobExact.mockResolvedValue(blob);

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);
    expectUntouched(s);
  });

  it('refuses a stored edit for a file this feature may not change', async () => {
    const s = setup();
    s.repo.findFixInProject.mockResolvedValue(
      fixRow({ edits: [{ ...EDIT, file: '.github/workflows/ci.js' }] }),
    );

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);

    expect(s.github.getBlobExact).not.toHaveBeenCalled();
    expectUntouched(s);
  });

  it('refuses a replacement that would write a placeholder of the scrubber', async () => {
    const s = setup();
    s.repo.findFixInProject.mockResolvedValue(
      fixRow({ edits: [{ ...EDIT, replace: '  return "[key]";' }] }),
    );

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);
    expectUntouched(s);
  });
});

describe('opening a pull request: the bytes written are the bytes read, plus the change', () => {
  it('keeps Windows line endings', async () => {
    const s = setup();
    s.github.getBlobExact.mockResolvedValue({
      kind: 'text',
      text: TEXT.replace(/\n/g, '\r\n'),
    });

    await open(s);

    expect(s.github.createBlob).toHaveBeenCalledWith(
      '77',
      'acme/shop',
      PATCHED.replace(/\n/g, '\r\n'),
    );
  });

  it('keeps a byte order mark', async () => {
    const s = setup();
    s.github.getBlobExact.mockResolvedValue({
      kind: 'text',
      text: `${BOM}${TEXT}`,
    });

    await open(s);

    expect(s.github.createBlob).toHaveBeenCalledWith(
      '77',
      'acme/shop',
      `${BOM}${PATCHED}`,
    );
  });

  it('keeps a file without a final newline and an executable mode', async () => {
    const s = setup();
    s.github.getBlobExact.mockResolvedValue({
      kind: 'text',
      text: TEXT.trimEnd(),
    });
    s.github.getTree.mockResolvedValue({
      truncated: false,
      files: new Map([
        ['src/users.js', { sha: BLOB, size: 120, mode: '100755' }],
      ]),
    });

    await open(s);

    expect(s.github.createBlob).toHaveBeenCalledWith(
      '77',
      'acme/shop',
      PATCHED.trimEnd(),
    );
    expect(s.github.createTree).toHaveBeenCalledWith(
      '77',
      'acme/shop',
      BASE_TREE,
      [{ path: 'src/users.js', mode: '100755', sha: NEW_BLOB }],
    );
  });

  it('writes one blob per file, and every edit of a file together', async () => {
    const s = setup();
    const other = 'export const limit = 10;\n';
    s.github.getTree.mockResolvedValue({
      truncated: false,
      files: new Map([
        ['src/users.js', { sha: BLOB, size: 120, mode: '100644' }],
        ['src/limits.js', { sha: 'a1'.repeat(20), size: 25, mode: '100644' }],
      ]),
    });
    s.github.getBlobExact.mockImplementation(
      (_i: string, _r: string, sha: string) =>
        Promise.resolve({ kind: 'text', text: sha === BLOB ? TEXT : other }),
    );
    s.github.createBlob
      .mockResolvedValueOnce('11'.repeat(20))
      .mockResolvedValueOnce('22'.repeat(20));
    s.repo.findFixInProject.mockResolvedValue(
      fixRow({
        edits: [
          EDIT,
          {
            file: 'src/users.js',
            search: 'async function getUser(id) {',
            replace: 'async function getUser(id) { // guarded',
            line: 1,
          },
          {
            file: 'src/limits.js',
            search: 'limit = 10',
            replace: 'limit = 20',
            line: 1,
          },
        ],
      }),
    );

    await open(s);

    expect(s.github.createBlob).toHaveBeenCalledTimes(2);
    const first = s.github.createBlob.mock.calls[0] as [string, string, string];
    expect(first[2]).toBe(
      PATCHED.replace(
        'async function getUser(id) {',
        'async function getUser(id) { // guarded',
      ),
    );
    expect(s.github.createBlob).toHaveBeenCalledWith(
      '77',
      'acme/shop',
      'export const limit = 20;\n',
    );
    const entries = (
      s.github.createTree.mock.calls[0] as [string, string, string, unknown[]]
    )[3];
    expect(entries).toHaveLength(2);
  });
});

describe('opening a pull request: when to stop', () => {
  it('stops before creating anything if the owner turned the feature off meanwhile', async () => {
    const s = setup();
    s.repo.isStillOpenable.mockResolvedValue(false);

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);

    expectUntouched(s);
  });

  it('adopts a pull request that GitHub reports as existing', async () => {
    const s = setup();
    s.github.createPullRequest.mockResolvedValue({ kind: 'exists' });
    s.github.findPullRequest
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(PR);

    await expect(open(s)).resolves.toMatchObject({ pullRequest: PR });
  });

  it('is 409 if it exists but cannot be found', async () => {
    const s = setup();
    s.github.createPullRequest.mockResolvedValue({ kind: 'exists' });

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);
    expect(s.repo.releasePullRequestClaim).toHaveBeenCalled();
  });

  it('never opens a normal pull request where drafts are not offered, and takes back its own branch', async () => {
    const s = setup();
    s.github.createPullRequest.mockResolvedValue({ kind: 'draft_unsupported' });

    await expect(open(s)).rejects.toThrow(/draft/i);

    expect(s.github.createPullRequest).toHaveBeenCalledTimes(1);
    expect(s.github.deleteBranch).toHaveBeenCalledWith(
      '77',
      'acme/shop',
      BRANCH,
    );
    expect(s.repo.savePullRequest).not.toHaveBeenCalled();
    expect(s.repo.releasePullRequestClaim).toHaveBeenCalledWith(FIX_ID);
  });

  it('does not delete a branch it did not make', async () => {
    const s = setup();
    s.github.getBranchHead.mockResolvedValue(COMMIT);
    s.github.getCommitTree.mockImplementation(
      (_i: string, _r: string, sha: string) =>
        Promise.resolve(sha === COMMIT ? NEW_TREE : BASE_TREE),
    );
    s.github.createPullRequest.mockResolvedValue({ kind: 'draft_unsupported' });

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);

    expect(s.github.deleteBranch).not.toHaveBeenCalled();
  });

  it('is 409 if the branch appears between the check and the creation', async () => {
    const s = setup();
    s.github.createBranch.mockResolvedValue('exists');

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);
    expect(s.github.createPullRequest).not.toHaveBeenCalled();
    expect(s.repo.releasePullRequestClaim).toHaveBeenCalled();
  });
});

describe('opening a pull request: when GitHub says no', () => {
  it.each([
    ['not_found', 409],
    ['forbidden', 409],
    ['rate_limited', 429],
    ['unavailable', 502],
  ] as const)(
    'maps a read failing with "%s" to %i, and gives the claim back',
    async (kind, status) => {
      const s = setup();
      s.github.getDefaultBranchHead.mockRejectedValue(
        new GithubReadError(kind),
      );

      const error = await open(s).catch((e: unknown) => e);

      expect((error as { getStatus: () => number }).getStatus()).toBe(status);
      expect(s.repo.releasePullRequestClaim).toHaveBeenCalledWith(FIX_ID);
    },
  );

  it('explains a refused write permission, and gives the claim back', async () => {
    const s = setup();
    s.github.createBlob.mockRejectedValue(new GithubTokenError());

    const error = await open(s).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toMatch(/permission/i);
    expect((error as Error).message).toMatch(/Pull requests/);
    expectUntouched(s);
  });

  it('keeps an unexpected error as it is, and still gives the claim back', async () => {
    const s = setup();
    s.github.createTree.mockRejectedValue(new TypeError('bug'));

    await expect(open(s)).rejects.toBeInstanceOf(TypeError);
    expect(s.repo.releasePullRequestClaim).toHaveBeenCalledWith(FIX_ID);
  });

  it('does not hide the real error when giving the claim back also fails', async () => {
    const s = setup();
    s.github.createTree.mockRejectedValue(new TypeError('bug'));
    s.repo.releasePullRequestClaim.mockRejectedValue(new Error('db down'));

    await expect(open(s)).rejects.toBeInstanceOf(TypeError);
  });

  it('is 409 when the pull request is already recorded for another fix', async () => {
    const s = setup();
    s.repo.savePullRequest.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '6',
      }),
    );

    await expect(open(s)).rejects.toBeInstanceOf(ConflictException);
    expect(s.audit.record).not.toHaveBeenCalled();
  });
});
