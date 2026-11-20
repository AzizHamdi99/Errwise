import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env';
import { GithubApiClient } from './github-api.client';
import { GithubReadError, classifyGithubFailure } from './github-read';
import type { GithubReadErrorKind } from './github-read';

const REPO = 'acme/shop';
const COMMIT = 'a'.repeat(40);
const BLOB = 'b'.repeat(40);

function makeClient(): GithubApiClient {
  const config = {
    get: (key: string) =>
      key === 'GITHUB_APP_PRIVATE_KEY_BASE64' ? 'a2V5' : 'x',
  };
  const client = new GithubApiClient(
    config as unknown as ConfigService<Env, true>,
    {} as JwtService,
  );
  jest.spyOn(client, 'getInstallationToken').mockResolvedValue('inst-token');
  return client;
}

function reply(
  body: BodyInit | null,
  init: ResponseInit = { status: 200 },
): jest.SpyInstance {
  return jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response(body, init));
}

async function kindOf(promise: Promise<unknown>): Promise<GithubReadErrorKind> {
  const error: unknown = await promise.catch((e: unknown) => e);
  if (!(error instanceof GithubReadError)) throw new Error('not a read error');
  return error.kind;
}

afterEach(() => jest.restoreAllMocks());

describe('classifyGithubFailure', () => {
  const headers = (values: Record<string, string>) => new Headers(values);

  it('tells a rate limit from a missing permission, both being 403', () => {
    expect(classifyGithubFailure(403, headers({}))).toBe('forbidden');
    expect(
      classifyGithubFailure(403, headers({ 'x-ratelimit-remaining': '0' })),
    ).toBe('rate_limited');
    expect(classifyGithubFailure(403, headers({ 'retry-after': '30' }))).toBe(
      'rate_limited',
    );
    expect(classifyGithubFailure(429, headers({}))).toBe('rate_limited');
  });

  it('maps the other statuses', () => {
    expect(classifyGithubFailure(401, headers({}))).toBe('forbidden');
    for (const status of [404, 409, 422]) {
      expect(classifyGithubFailure(status, headers({}))).toBe('not_found');
    }
    for (const status of [500, 502, 503]) {
      expect(classifyGithubFailure(status, headers({}))).toBe('unavailable');
    }
  });
});

describe('GithubApiClient.resolveCommit', () => {
  it('returns the full hash and sends the installation token', async () => {
    const fetchSpy = reply(`${COMMIT.toUpperCase()}\n`);

    await expect(
      makeClient().resolveCommit('1', REPO, 'aaaaaaa'),
    ).resolves.toBe(COMMIT);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.github.com/repos/${REPO}/commits/aaaaaaa`);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer inst-token');
    expect(headers.Accept).toBe('application/vnd.github.sha');
  });

  it('does not call GitHub for values that could change the request path', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const client = makeClient();

    for (const commit of ['../../x', 'main', 'abc', `${COMMIT}/../..`, '']) {
      expect(await kindOf(client.resolveCommit('1', REPO, commit))).toBe(
        'not_found',
      );
    }
    // Every read method, not only the first: "../shop" is made of allowed characters.
    const unsafeRepos = [
      'acme',
      'acme/shop/extra',
      '../shop',
      'acme/..',
      './shop',
      'a b/c',
      '',
    ];
    for (const repo of unsafeRepos) {
      const calls = [
        client.resolveCommit('1', repo, COMMIT),
        client.getTree('1', repo, COMMIT),
        client.getBlobText('1', repo, BLOB),
      ];
      for (const call of calls) expect(await kindOf(call)).toBe('not_found');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports an unknown commit, a missing permission and a rate limit', async () => {
    const client = makeClient();
    reply('{}', { status: 404 });
    expect(await kindOf(client.resolveCommit('1', REPO, COMMIT))).toBe(
      'not_found',
    );
    reply('{}', { status: 403 });
    expect(await kindOf(client.resolveCommit('1', REPO, COMMIT))).toBe(
      'forbidden',
    );
    reply('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } });
    expect(await kindOf(client.resolveCommit('1', REPO, COMMIT))).toBe(
      'rate_limited',
    );
  });

  it('reports a network failure and a garbled answer as unavailable', async () => {
    const client = makeClient();
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await kindOf(client.resolveCommit('1', REPO, COMMIT))).toBe(
      'unavailable',
    );
    reply('<html>oops</html>');
    expect(await kindOf(client.resolveCommit('1', REPO, COMMIT))).toBe(
      'unavailable',
    );
  });

  it('reports a failed token request as unavailable', async () => {
    const client = makeClient();
    jest
      .spyOn(client, 'getInstallationToken')
      .mockRejectedValue(new Error('boom'));
    expect(await kindOf(client.resolveCommit('1', REPO, COMMIT))).toBe(
      'unavailable',
    );
  });
});

describe('GithubApiClient.getTree', () => {
  it('keeps only files, with their blob id and size', async () => {
    const fetchSpy = reply(
      JSON.stringify({
        truncated: false,
        tree: [
          { path: 'src', type: 'tree', sha: 'c'.repeat(40) },
          { path: 'src/a.ts', type: 'blob', sha: BLOB, size: 120 },
          { path: 'vendor/lib', type: 'commit', sha: 'd'.repeat(40) },
          { path: 'weird.ts', type: 'blob', sha: 'not-a-sha', size: 1 },
        ],
      }),
    );

    const tree = await makeClient().getTree('1', REPO, COMMIT);

    expect([...tree.files.entries()]).toEqual([
      ['src/a.ts', { sha: BLOB, size: 120 }],
    ]);
    expect(tree.truncated).toBe(false);
    expect((fetchSpy.mock.calls[0] as [string])[0]).toBe(
      `https://api.github.com/repos/${REPO}/git/trees/${COMMIT}?recursive=1`,
    );
  });

  it('reports a truncated tree', async () => {
    reply(JSON.stringify({ truncated: true, tree: [] }));
    expect((await makeClient().getTree('1', REPO, COMMIT)).truncated).toBe(
      true,
    );
  });

  it('refuses a short hash and a wrong shape', async () => {
    expect(await kindOf(makeClient().getTree('1', REPO, 'abc1234'))).toBe(
      'not_found',
    );
    reply(JSON.stringify({ nope: true }));
    expect(await kindOf(makeClient().getTree('1', REPO, COMMIT))).toBe(
      'unavailable',
    );
  });
});

describe('GithubApiClient.getBlobText', () => {
  it('returns the text of a file, requesting the raw content', async () => {
    const fetchSpy = reply('const a = 1;\nconst b = 2;\n');

    await expect(makeClient().getBlobText('1', REPO, BLOB)).resolves.toEqual({
      kind: 'text',
      text: 'const a = 1;\nconst b = 2;\n',
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.github.com/repos/${REPO}/git/blobs/${BLOB}`);
    expect((init.headers as Record<string, string>).Accept).toBe(
      'application/vnd.github.raw+json',
    );
  });

  it('reports a binary file instead of decoding it', async () => {
    reply(new Uint8Array([137, 80, 78, 71, 0, 1, 2]));
    await expect(makeClient().getBlobText('1', REPO, BLOB)).resolves.toEqual({
      kind: 'binary',
    });
  });

  it('reports a file that is too large, by its declared size or its real size', async () => {
    reply('x', { headers: { 'content-length': String(600 * 1024) } });
    await expect(makeClient().getBlobText('1', REPO, BLOB)).resolves.toEqual({
      kind: 'too_large',
    });
    reply('x'.repeat(600 * 1024));
    await expect(makeClient().getBlobText('1', REPO, BLOB)).resolves.toEqual({
      kind: 'too_large',
    });
  });

  it('refuses a blob id that is not a full hash', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    expect(await kindOf(makeClient().getBlobText('1', REPO, '../x'))).toBe(
      'not_found',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
