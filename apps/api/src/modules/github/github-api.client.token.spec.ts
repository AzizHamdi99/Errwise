import { BadGatewayException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env';
import { GithubApiClient, GithubTokenError } from './github-api.client';
import { GithubReadError } from './github-read';

const COMMIT = 'a'.repeat(40);

function makeClient(): GithubApiClient {
  const config = {
    get: (key: string) =>
      key === 'GITHUB_APP_PRIVATE_KEY_BASE64' ? 'a2V5' : 'x',
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('app-jwt') };
  return new GithubApiClient(
    config as unknown as ConfigService<Env, true>,
    jwt as unknown as JwtService,
  );
}

function minted(token = 'tok'): Response {
  return new Response(
    JSON.stringify({
      token,
      expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    }),
    { status: 201 },
  );
}

function sentBody(fetchMock: jest.SpyInstance, call: number) {
  const [, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

afterEach(() => jest.restoreAllMocks());

describe('GithubApiClient.getInstallationToken', () => {
  it.each([
    ['metadata', { metadata: 'read' }],
    ['issues', { issues: 'write' }],
    ['read', { contents: 'read' }],
    ['fix', { contents: 'write', pull_requests: 'write' }],
  ] as const)(
    'asks for the %s permissions only',
    async (purpose, permissions) => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(minted());

      await makeClient().getInstallationToken('7', purpose);

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toBe(
        'https://api.github.com/app/installations/7/access_tokens',
      );
      expect(sentBody(fetchMock, 0)).toEqual({ permissions });
    },
  );

  it('limits the token to the repository, by name without the owner', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(minted());

    await makeClient().getInstallationToken('7', 'fix', 'acme/shop');

    expect(sentBody(fetchMock, 0)).toEqual({
      permissions: { contents: 'write', pull_requests: 'write' },
      repositories: ['shop'],
    });
  });

  it('never serves a token minted for another purpose or repository', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(minted('read-shop'))
      .mockResolvedValueOnce(minted('fix-shop'))
      .mockResolvedValueOnce(minted('read-blog'));
    const client = makeClient();

    expect(await client.getInstallationToken('7', 'read', 'acme/shop')).toBe(
      'read-shop',
    );
    expect(await client.getInstallationToken('7', 'fix', 'acme/shop')).toBe(
      'fix-shop',
    );
    expect(await client.getInstallationToken('7', 'read', 'acme/blog')).toBe(
      'read-blog',
    );
    // Same purpose and repository: served from memory.
    expect(await client.getInstallationToken('7', 'read', 'acme/shop')).toBe(
      'read-shop',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('mints a new token when the cached one is about to expire', async () => {
    const soon = new Response(
      JSON.stringify({
        token: 'old',
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      }),
      { status: 201 },
    );
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(soon)
      .mockResolvedValueOnce(minted('new'));
    const client = makeClient();

    await client.getInstallationToken('7', 'read', 'acme/shop');
    expect(await client.getInstallationToken('7', 'read', 'acme/shop')).toBe(
      'new',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refuses a repository that could change the request, without calling GitHub', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const client = makeClient();

    for (const repo of ['acme', '../shop', 'acme/..', 'a b/c', 'a/b/c', '']) {
      await expect(
        client.getInstallationToken('7', 'fix', repo),
      ).rejects.toBeInstanceOf(BadGatewayException);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a refused permission set (422) as a token error', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 422 }));

    const error = await makeClient()
      .getInstallationToken('7', 'fix', 'acme/shop')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GithubTokenError);
    // Existing callers only know BadGateway, so they keep working unchanged.
    expect(error).toBeInstanceOf(BadGatewayException);
  });

  it('keeps other failures as plain bad gateway, not as a token error', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 500 }));

    const error = await makeClient()
      .getInstallationToken('7', 'read', 'acme/shop')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error).not.toBeInstanceOf(GithubTokenError);
  });
});

describe('reading code with a scoped token', () => {
  it('asks for a read-only token limited to the repository', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(minted())
      .mockResolvedValueOnce(new Response(COMMIT, { status: 200 }));

    await makeClient().resolveCommit('7', 'acme/shop', 'aaaaaaa');

    expect(sentBody(fetchMock, 0)).toEqual({
      permissions: { contents: 'read' },
      repositories: ['shop'],
    });
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer tok',
    );
  });

  it('answers "forbidden" when the permission was not accepted yet', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 422 }));

    const error = await makeClient()
      .resolveCommit('7', 'acme/shop', COMMIT)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GithubReadError);
    expect((error as GithubReadError).kind).toBe('forbidden');
  });

  it('answers "unavailable" when the token request fails for another reason', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 500 }));

    const error = await makeClient()
      .getTree('7', 'acme/shop', COMMIT)
      .catch((e: unknown) => e);

    expect((error as GithubReadError).kind).toBe('unavailable');
  });
});

describe('issues with a scoped token', () => {
  it('creates an issue with an issues-only token limited to the repository', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(minted())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ number: 5, html_url: 'https://gh/5' }), {
          status: 201,
        }),
      );

    await makeClient().createIssue('7', 'acme/shop', { title: 'T', body: 'B' });

    expect(sentBody(fetchMock, 0)).toEqual({
      permissions: { issues: 'write' },
      repositories: ['shop'],
    });
  });
});
