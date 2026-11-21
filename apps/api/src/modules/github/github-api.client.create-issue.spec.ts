import { BadGatewayException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env';
import { GithubApiClient } from './github-api.client';

const INPUT = {
  title: 'T',
  body: 'B',
  labels: ['errwise', 'bug', 'level:error'],
};
const EXPECTED = { number: 5, url: 'https://gh/5' };

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

const created = () =>
  new Response(JSON.stringify({ number: 5, html_url: 'https://gh/5' }), {
    status: 201,
  });
const refused = () =>
  new Response('{"message":"Validation Failed"}', { status: 422 });

function sentBodies(fetchMock: jest.SpyInstance): Record<string, unknown>[] {
  return fetchMock.mock.calls.map((call) => {
    const [, init] = call as [string, RequestInit];
    return JSON.parse(init.body as string) as Record<string, unknown>;
  });
}

afterEach(() => jest.restoreAllMocks());

describe('GithubApiClient.createIssue', () => {
  it('sends the labels with the issue', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(created());

    await expect(
      makeClient().createIssue('1', 'acme/shop', INPUT),
    ).resolves.toEqual(EXPECTED);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBodies(fetchMock)[0]).toEqual(INPUT);
  });

  it('retries once without the labels when GitHub answers 422', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(refused())
      .mockResolvedValueOnce(created());

    await expect(
      makeClient().createIssue('1', 'acme/shop', INPUT),
    ).resolves.toEqual(EXPECTED);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBodies(fetchMock)[1]).toEqual({ title: 'T', body: 'B' });
  });

  it('gives up after that one retry', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(refused())
      .mockResolvedValueOnce(refused());

    await expect(
      makeClient().createIssue('1', 'acme/shop', INPUT),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 422 when there were no labels to drop', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(refused());

    await expect(
      makeClient().createIssue('1', 'acme/shop', { title: 'T', body: 'B' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry other failures, a retry could create a second issue', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 500 }));

    await expect(
      makeClient().createIssue('1', 'acme/shop', INPUT),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
