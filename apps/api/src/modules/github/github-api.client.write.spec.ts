import { BadGatewayException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env';
import { GithubApiClient, GithubTokenError } from './github-api.client';
import { GithubReadError } from './github-read';

const REPO = 'acme/shop';
const SHA = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const BLOB = 'c'.repeat(40);
const BRANCH = 'errwise/fix-0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

function makeClient() {
  const config = {
    get: (key: string) =>
      key === 'GITHUB_APP_PRIVATE_KEY_BASE64' ? 'a2V5' : 'x',
  };
  const client = new GithubApiClient(
    config as unknown as ConfigService<Env, true>,
    {} as JwtService,
  );
  const token = jest
    .spyOn(client, 'getInstallationToken')
    .mockResolvedValue('inst-token');
  return { client, token };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function lastCall(fetchMock: jest.SpyInstance) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return {
    url,
    method: init.method,
    headers: init.headers as Record<string, string>,
    body: init.body ? (JSON.parse(init.body as string) as unknown) : undefined,
  };
}

afterEach(() => jest.restoreAllMocks());

describe('exact reads', () => {
  it('getCommitTree returns the tree of a commit', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ tree: { sha: TREE.toUpperCase() } }));
    const { client, token } = makeClient();

    await expect(client.getCommitTree('7', REPO, SHA)).resolves.toBe(TREE);

    expect(lastCall(fetchMock).url).toBe(
      `https://api.github.com/repos/${REPO}/git/commits/${SHA}`,
    );
    expect(token).toHaveBeenCalledWith('7', 'read', REPO);
  });

  it('getBlobExact keeps a byte order mark and every character', async () => {
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('const a = "café";\r\nreturn a;\r\n', 'utf8'),
    ]);
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(bytes));
    const { client } = makeClient();

    const blob = await client.getBlobExact('7', REPO, BLOB);

    expect(blob).toEqual({
      kind: 'text',
      text: '﻿const a = "café";\r\nreturn a;\r\n',
    });
  });

  it('getBlobExact refuses bytes that are not UTF-8 instead of replacing them', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(Buffer.from([0x61, 0xff, 0xfe, 0x62])));
    const { client } = makeClient();

    await expect(client.getBlobExact('7', REPO, BLOB)).resolves.toEqual({
      kind: 'invalid_utf8',
    });
  });

  it('getBlobExact reports binary and very large files', async () => {
    const { client } = makeClient();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(new Uint8Array([137, 80, 0, 1])));
    await expect(client.getBlobExact('7', REPO, BLOB)).resolves.toEqual({
      kind: 'binary',
    });

    jest.restoreAllMocks();
    const second = makeClient().client;
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('x'.repeat(600 * 1024)));
    await expect(second.getBlobExact('7', REPO, BLOB)).resolves.toEqual({
      kind: 'too_large',
    });
  });

  it('getBlobExact and getCommitTree refuse values that could change the request', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const { client } = makeClient();
    for (const call of [
      () => client.getBlobExact('7', '../x', BLOB),
      () => client.getBlobExact('7', REPO, '../x'),
      () => client.getCommitTree('7', REPO, 'main'),
    ]) {
      await expect(call()).rejects.toBeInstanceOf(GithubReadError);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('getTree keeps the mode of each file, so a symlink can be told from a file', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      json({
        truncated: false,
        tree: [
          { path: 'a.js', type: 'blob', sha: BLOB, size: 1, mode: '100644' },
          { path: 'run.js', type: 'blob', sha: SHA, size: 1, mode: '100755' },
          { path: 'link.js', type: 'blob', sha: TREE, size: 1, mode: '120000' },
        ],
      }),
    );
    const { client } = makeClient();

    const tree = await client.getTree('7', REPO, SHA);

    expect(tree.files.get('a.js')?.mode).toBe('100644');
    expect(tree.files.get('run.js')?.mode).toBe('100755');
    expect(tree.files.get('link.js')?.mode).toBe('120000');
  });

  it('getBranchHead returns the commit, or null when there is no such branch', async () => {
    const { client } = makeClient();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ object: { sha: SHA } }))
      .mockResolvedValueOnce(json({ message: 'Not Found' }, 404));

    await expect(client.getBranchHead('7', REPO, BRANCH)).resolves.toBe(SHA);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      `https://api.github.com/repos/${REPO}/git/ref/heads/${BRANCH}`,
    );
    await expect(client.getBranchHead('7', REPO, BRANCH)).resolves.toBeNull();
  });

  it('getBranchHead does not call GitHub for a branch name that could change the request', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const { client } = makeClient();
    for (const branch of ['../x', 'a b', 'a?b', '']) {
      await expect(
        client.getBranchHead('7', REPO, branch),
      ).rejects.toBeInstanceOf(GithubReadError);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('writes use the "fix" token for one repository', () => {
  it('createBlob sends the exact bytes as base64', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ sha: BLOB }, 201));
    const { client, token } = makeClient();
    const text = '﻿a = "é";\r\n';

    await expect(client.createBlob('7', REPO, text)).resolves.toBe(BLOB);

    const call = lastCall(fetchMock);
    expect(call.method).toBe('POST');
    expect(call.url).toBe(`https://api.github.com/repos/${REPO}/git/blobs`);
    expect(call.headers.Authorization).toBe('Bearer inst-token');
    expect(call.body).toEqual({
      content: Buffer.from(text, 'utf8').toString('base64'),
      encoding: 'base64',
    });
    expect(
      Buffer.from((call.body as { content: string }).content, 'base64')
        .subarray(0, 3)
        .toString('hex'),
    ).toBe('efbbbf');
    expect(token).toHaveBeenCalledWith('7', 'fix', REPO);
  });

  it('createTree builds on a tree and writes regular files only', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ sha: TREE }, 201));
    const { client } = makeClient();

    await expect(
      client.createTree('7', REPO, SHA, [
        { path: 'src/a.js', mode: '100644', sha: BLOB },
        { path: 'bin/run.js', mode: '100755', sha: BLOB },
      ]),
    ).resolves.toBe(TREE);

    expect(lastCall(fetchMock).body).toEqual({
      base_tree: SHA,
      tree: [
        { path: 'src/a.js', mode: '100644', sha: BLOB, type: 'blob' },
        { path: 'bin/run.js', mode: '100755', sha: BLOB, type: 'blob' },
      ],
    });
  });

  it('createTree refuses a symlink, a submodule, a bad hash and an empty tree, without calling GitHub', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const { client } = makeClient();
    const bad = [
      [{ path: 'a.js', mode: '120000', sha: BLOB }],
      [{ path: 'a.js', mode: '160000', sha: BLOB }],
      [{ path: 'a.js', mode: '100644', sha: 'nope' }],
      [],
    ];
    for (const entries of bad) {
      await expect(
        client.createTree('7', REPO, SHA, entries),
      ).rejects.toBeInstanceOf(BadGatewayException);
    }
    await expect(
      client.createTree('7', REPO, 'nope', [
        { path: 'a.js', mode: '100644', sha: BLOB },
      ]),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createCommit has one parent and claims no author', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json({ sha: SHA }, 201));
    const { client } = makeClient();

    await client.createCommit('7', REPO, {
      message: 'm',
      tree: TREE,
      parent: SHA,
    });

    expect(lastCall(fetchMock).body).toEqual({
      message: 'm',
      tree: TREE,
      parents: [SHA],
    });
  });

  it('createBranch creates a ref and says "exists" instead of moving one', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ ref: 'x' }, 201))
      .mockResolvedValueOnce(
        json({ message: 'Reference already exists' }, 422),
      );
    const { client } = makeClient();

    await expect(client.createBranch('7', REPO, BRANCH, SHA)).resolves.toBe(
      'created',
    );
    expect(lastCall(fetchMock).body).toEqual({
      ref: `refs/heads/${BRANCH}`,
      sha: SHA,
    });
    await expect(client.createBranch('7', REPO, BRANCH, SHA)).resolves.toBe(
      'exists',
    );
    // No PATCH or force anywhere: only POSTs were made.
    expect(
      fetchMock.mock.calls.every(
        (c) => (c[1] as RequestInit).method === 'POST',
      ),
    ).toBe(true);
  });

  it('deleteBranch treats "already gone" as done and a server error as an error', async () => {
    const { client } = makeClient();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({}, 404))
      .mockResolvedValueOnce(json({}, 500));

    await expect(
      client.deleteBranch('7', REPO, BRANCH),
    ).resolves.toBeUndefined();
    expect(lastCall(fetchMock).method).toBe('DELETE');
    await expect(
      client.deleteBranch('7', REPO, BRANCH),
    ).resolves.toBeUndefined();
    await expect(client.deleteBranch('7', REPO, BRANCH)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('refuses a branch name or repository that could change the request, without calling GitHub', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const { client } = makeClient();
    await expect(
      client.createBranch('7', REPO, '../x', SHA),
    ).rejects.toBeInstanceOf(BadGatewayException);
    await expect(client.deleteBranch('7', REPO, 'a b')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    await expect(client.createBlob('7', '../shop', 'x')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    'a %i on a write means the permission is not accepted',
    async (status) => {
      jest.spyOn(global, 'fetch').mockResolvedValue(json({}, status));
      const { client } = makeClient();

      const error = await client
        .createBlob('7', REPO, 'x')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(GithubTokenError);
    },
  );

  it('a refused token request also surfaces as a token error', async () => {
    const { client, token } = makeClient();
    token.mockRejectedValue(new GithubTokenError());
    await expect(client.createBlob('7', REPO, 'x')).rejects.toBeInstanceOf(
      GithubTokenError,
    );
  });
});

describe('pull requests', () => {
  const PR = { number: 12, html_url: 'https://github.com/acme/shop/pull/12' };
  const INPUT = { title: 't', body: 'b', head: BRANCH, base: 'main' };

  it('createPullRequest always asks for a draft', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(json(PR, 201));
    const { client } = makeClient();

    await expect(client.createPullRequest('7', REPO, INPUT)).resolves.toEqual({
      kind: 'created',
      pullRequest: { number: 12, url: PR.html_url },
    });

    const call = lastCall(fetchMock);
    expect(call.url).toBe(`https://api.github.com/repos/${REPO}/pulls`);
    expect(call.body).toEqual({ ...INPUT, draft: true });
  });

  it('tells "already exists" and "drafts not supported" from other 422 answers', async () => {
    const { client } = makeClient();
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        json(
          {
            message: 'Validation Failed',
            errors: [{ message: 'A pull request already exists for acme:x.' }],
          },
          422,
        ),
      )
      .mockResolvedValueOnce(
        json(
          {
            message: 'Validation Failed',
            errors: [
              {
                message:
                  'Draft pull requests are not supported in this repository.',
              },
            ],
          },
          422,
        ),
      )
      .mockResolvedValueOnce(
        json(
          {
            message: 'Validation Failed',
            errors: [{ message: 'No commits between main and x' }],
          },
          422,
        ),
      );

    await expect(client.createPullRequest('7', REPO, INPUT)).resolves.toEqual({
      kind: 'exists',
    });
    await expect(client.createPullRequest('7', REPO, INPUT)).resolves.toEqual({
      kind: 'draft_unsupported',
    });
    await expect(
      client.createPullRequest('7', REPO, INPUT),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('never stores a link that does not point at GitHub', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        json({ number: 12, html_url: 'https://evil.example/pull/12' }, 201),
      );
    const { client } = makeClient();

    await expect(
      client.createPullRequest('7', REPO, INPUT),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('a refused write is a token error here too', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(json({}, 403));
    const { client } = makeClient();
    await expect(
      client.createPullRequest('7', REPO, INPUT),
    ).rejects.toBeInstanceOf(GithubTokenError);
  });

  it('findPullRequest looks up the branch, in any state, and returns the first', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json([PR]))
      .mockResolvedValueOnce(json([]));
    const { client } = makeClient();

    await expect(client.findPullRequest('7', REPO, BRANCH)).resolves.toEqual({
      number: 12,
      url: PR.html_url,
    });
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      `https://api.github.com/repos/${REPO}/pulls?head=acme%3A${encodeURIComponent(BRANCH)}&state=all&per_page=1`,
    );
    await expect(client.findPullRequest('7', REPO, BRANCH)).resolves.toBeNull();
  });

  it('findPullRequest rejects an answer of the wrong shape', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(json({ nope: true }));
    const { client } = makeClient();
    await expect(
      client.findPullRequest('7', REPO, BRANCH),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
