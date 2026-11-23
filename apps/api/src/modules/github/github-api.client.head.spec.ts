import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env';
import { GithubApiClient } from './github-api.client';
import { GithubReadError } from './github-read';
import type { GithubReadErrorKind } from './github-read';

const REPO = 'acme/shop';
const HEAD = 'c'.repeat(40);

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

async function kindOf(promise: Promise<unknown>): Promise<GithubReadErrorKind> {
  const error: unknown = await promise.catch((e: unknown) => e);
  if (!(error instanceof GithubReadError)) throw new Error('not a read error');
  return error.kind;
}

afterEach(() => jest.restoreAllMocks());

describe('GithubApiClient.getDefaultBranchHead', () => {
  it('returns the default branch and where it points', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ default_branch: 'main' }))
      .mockResolvedValueOnce(
        json({ object: { sha: HEAD.toUpperCase(), type: 'commit' } }),
      );

    await expect(makeClient().getDefaultBranchHead('7', REPO)).resolves.toEqual(
      { branch: 'main', sha: HEAD },
    );

    const urls = fetchMock.mock.calls.map((c) => (c as [string])[0]);
    expect(urls).toEqual([
      `https://api.github.com/repos/${REPO}`,
      `https://api.github.com/repos/${REPO}/git/ref/heads/main`,
    ]);
  });

  it('keeps the slashes of a branch like release/1.x and encodes the rest', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ default_branch: 'release/1.x' }))
      .mockResolvedValueOnce(json({ object: { sha: HEAD } }));

    await makeClient().getDefaultBranchHead('7', REPO);

    expect((fetchMock.mock.calls[1] as [string])[0]).toBe(
      `https://api.github.com/repos/${REPO}/git/ref/heads/release/1.x`,
    );
  });

  it('refuses a branch name that could change the request, without a second call', async () => {
    for (const branch of ['../x', 'a//b', 'a b', 'a?b=c', '', '/x', 'x/..']) {
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(json({ default_branch: branch }));
      expect(await kindOf(makeClient().getDefaultBranchHead('7', REPO))).toBe(
        'unavailable',
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      jest.restoreAllMocks();
    }
  });

  it('refuses an unsafe repository without calling GitHub', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    for (const repo of ['../shop', 'acme', 'acme/..']) {
      expect(await kindOf(makeClient().getDefaultBranchHead('7', repo))).toBe(
        'not_found',
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a garbled answer as unavailable', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(json({ nope: true }));
    expect(await kindOf(makeClient().getDefaultBranchHead('7', REPO))).toBe(
      'unavailable',
    );

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ default_branch: 'main' }))
      .mockResolvedValueOnce(json({ object: { sha: 'not-a-sha' } }));
    expect(await kindOf(makeClient().getDefaultBranchHead('7', REPO))).toBe(
      'unavailable',
    );
  });

  it('keeps the kind of a failure: no permission, rate limit, missing', async () => {
    const cases: [number, GithubReadErrorKind][] = [
      [403, 'forbidden'],
      [404, 'not_found'],
      [500, 'unavailable'],
    ];
    for (const [status, kind] of cases) {
      jest.spyOn(global, 'fetch').mockResolvedValue(json({}, status));
      expect(await kindOf(makeClient().getDefaultBranchHead('7', REPO))).toBe(
        kind,
      );
      jest.restoreAllMocks();
    }
  });
});
