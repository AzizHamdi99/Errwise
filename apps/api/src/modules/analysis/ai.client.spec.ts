import {
  BadGatewayException,
  GatewayTimeoutException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AnalyzeRequest, FixRequest } from '@errwise/shared';
import type { Env } from '../../config/env';
import { AiClient } from './ai.client';

const INPUT: AnalyzeRequest = {
  type: 'TypeError',
  message: 'boom',
  environment: 'production',
};

// The exact shape apps/ai returns (copied from a real call).
const GOOD = {
  summary: 'A TypeError occurred.',
  probableCause: 'The user was undefined.',
  suggestedFix: 'Check the user first.',
  confidence: 'medium',
  framesUsed: ['at f (/app/a.js:1:1)'],
  promptVersion: 'v1',
  model: 'openai/gpt-oss-20b',
};

function client(values: Partial<Record<keyof Env, unknown>> = {}): AiClient {
  const all: Record<string, unknown> = {
    AI_SERVICE_URL: 'http://ai.test/',
    AI_SERVICE_SECRET: 'a-shared-secret-123456',
    AI_SERVICE_TIMEOUT_MS: 5_000,
    ...values,
  };
  const config = { get: (key: string) => all[key] };
  return new AiClient(config as unknown as ConfigService<Env, true>);
}

function reply(status: number, body: unknown): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
    }),
  );
}

afterEach(() => jest.restoreAllMocks());

describe('AiClient', () => {
  it('is disabled until both the URL and the secret are set', () => {
    expect(client().enabled).toBe(true);
    expect(client({ AI_SERVICE_URL: undefined }).enabled).toBe(false);
  });

  it('refuses to call anything when disabled', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(
      client({
        AI_SERVICE_URL: undefined,
        AI_SERVICE_SECRET: undefined,
      }).analyze(INPUT),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends the secret and the input, and returns the validated result', async () => {
    const fetchSpy = reply(200, GOOD);

    await expect(client().analyze(INPUT)).resolves.toEqual(GOOD);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://ai.test/analyze');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-ai-secret']).toBe(
      'a-shared-secret-123456',
    );
    expect(JSON.parse(init.body as string)).toEqual(INPUT);
  });

  it('maps the provider rate limit to a friendly 503', async () => {
    reply(503, { detail: 'llm_rate_limited' });
    await expect(client().analyze(INPUT)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('maps a gateway timeout from the AI service to 504', async () => {
    reply(504, { detail: 'llm_timeout' });
    await expect(client().analyze(INPUT)).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
  });

  it.each([401, 422, 500, 502])('maps status %i to 502', async (status) => {
    reply(status, { detail: 'x' });
    await expect(client().analyze(INPUT)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it.each([
    ['not json', 'oops'],
    ['wrong shape', { ...GOOD, confidence: 'certain' }],
    ['missing field', { summary: 'only this' }],
  ])('rejects an answer that is %s', async (_name, body) => {
    reply(200, body);
    await expect(client().analyze(INPUT)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps our own timeout to 504 and a network failure to 502', async () => {
    const timeout = Object.assign(new Error('timed out'), {
      name: 'TimeoutError',
    });
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(timeout);
    await expect(client().analyze(INPUT)).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );

    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(client().analyze(INPUT)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

const FIX_INPUT: FixRequest = {
  type: 'TypeError',
  message: 'boom',
  environment: 'production',
  files: [
    {
      file: 'src/a.js',
      startLine: 1,
      failingLine: 2,
      code: 'a();\nb();\n',
    },
  ],
};

// The exact shape apps/ai answers for /fix.
const FIX_GOOD = {
  fixable: true,
  prTitle: 'Guard the lookup',
  explanation: 'The value can be null.',
  confidence: 'high',
  edits: [{ file: 'src/a.js', search: 'b();', replace: 'b?.();' }],
  reason: '',
  promptVersion: 'fix-v1',
  model: 'openai/gpt-oss-120b',
};

describe('AiClient.fix', () => {
  it('posts to /fix with the secret and returns the validated answer', async () => {
    const fetchMock = reply(200, FIX_GOOD);

    await expect(client().fix(FIX_INPUT)).resolves.toEqual(FIX_GOOD);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://ai.test/fix');
    expect((init.headers as Record<string, string>)['x-ai-secret']).toBe(
      'a-shared-secret-123456',
    );
    expect(JSON.parse(init.body as string)).toEqual(FIX_INPUT);
  });

  it('accepts a refusal', async () => {
    const refusal = {
      ...FIX_GOOD,
      fixable: false,
      prTitle: '',
      explanation: '',
      edits: [],
      reason: 'Not a code bug.',
    };
    reply(200, refusal);
    await expect(client().fix(FIX_INPUT)).resolves.toEqual(refusal);
  });

  it.each([
    ['not json', 'oops'],
    ['a fixable answer without edits', { ...FIX_GOOD, edits: [] }],
    ['a refusal that still has edits', { ...FIX_GOOD, fixable: false }],
    ['a refusal without a reason', { ...FIX_GOOD, fixable: false, edits: [] }],
    ['an unknown confidence', { ...FIX_GOOD, confidence: 'certain' }],
  ])('rejects an answer that is %s', async (_name, body) => {
    reply(200, body);
    await expect(client().fix(FIX_INPUT)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps a provider token limit (413) to its own friendly error', async () => {
    reply(413, { detail: 'llm_too_large' });
    await expect(client().fix(FIX_INPUT)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('keeps the other mappings: busy, timeout, bad output from the service', async () => {
    reply(503, {});
    await expect(client().fix(FIX_INPUT)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    reply(504, {});
    await expect(client().fix(FIX_INPUT)).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
    reply(502, { detail: 'llm_bad_response' });
    await expect(client().fix(FIX_INPUT)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('refuses to call anything when disabled', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(
      client({ AI_SERVICE_URL: undefined }).fix(FIX_INPUT),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
