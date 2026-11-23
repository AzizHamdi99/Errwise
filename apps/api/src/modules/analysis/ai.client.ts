import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ZodType } from 'zod';
import { analysisResultSchema, fixResultSchema } from '@errwise/shared';
import type {
  AnalysisResult,
  AnalyzeRequest,
  FixRequest,
  FixResult,
} from '@errwise/shared';
import type { Env } from '../../config/env';

/**
 * The only door to apps/ai. It never logs the request, the response or the
 * secret: only status codes and error names.
 */
@Injectable()
export class AiClient {
  private readonly logger = new Logger(AiClient.name);
  private readonly url?: string;
  private readonly secret?: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService<Env, true>) {
    this.url = config.get('AI_SERVICE_URL', { infer: true });
    this.secret = config.get('AI_SERVICE_SECRET', { infer: true });
    this.timeoutMs = config.get('AI_SERVICE_TIMEOUT_MS', { infer: true });
  }

  get enabled(): boolean {
    return Boolean(this.url && this.secret);
  }

  analyze(input: AnalyzeRequest): Promise<AnalysisResult> {
    return this.call('/analyze', input, analysisResultSchema);
  }

  /** A code fix for an error (ADR-009). The edits are not trusted yet: see fix-patch.ts. */
  fix(input: FixRequest): Promise<FixResult> {
    return this.call('/fix', input, fixResultSchema);
  }

  private async call<T>(
    path: string,
    input: unknown,
    schema: ZodType<T>,
  ): Promise<T> {
    if (!this.url || !this.secret) {
      throw new ServiceUnavailableException('AI analysis is not configured');
    }

    let res: Response;
    try {
      res = await fetch(`${this.url.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ai-secret': this.secret,
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      this.logger.warn(`AI service ${timedOut ? 'timed out' : 'unreachable'}`);
      throw timedOut
        ? new GatewayTimeoutException('AI analysis timed out')
        : new BadGatewayException('AI service is unreachable');
    }

    if (res.status === 503) {
      // The provider's rate limit: a normal, temporary condition on a free tier.
      throw new ServiceUnavailableException(
        'AI is busy right now, try again in a minute',
      );
    }
    if (res.status === 504) {
      throw new GatewayTimeoutException('AI analysis timed out');
    }
    if (res.status === 413) {
      // The provider counts the request against a per-minute token limit.
      throw new PayloadTooLargeException(
        'The AI cannot take this much code right now, try again in a minute',
      );
    }
    if (!res.ok) {
      this.logger.warn(`AI service answered ${res.status}`);
      throw new BadGatewayException('AI analysis failed');
    }

    const parsed = schema.safeParse(await this.readJson(res));
    if (!parsed.success) {
      this.logger.warn('AI service answered with an unexpected shape');
      throw new BadGatewayException('AI analysis failed');
    }
    return parsed.data;
  }

  private async readJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
}
