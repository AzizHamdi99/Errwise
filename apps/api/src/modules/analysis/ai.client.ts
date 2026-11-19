import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { analysisResultSchema } from '@errwise/shared';
import type { AnalysisResult, AnalyzeRequest } from '@errwise/shared';
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

  async analyze(input: AnalyzeRequest): Promise<AnalysisResult> {
    if (!this.url || !this.secret) {
      throw new ServiceUnavailableException('AI analysis is not configured');
    }

    let res: Response;
    try {
      res = await fetch(`${this.url.replace(/\/$/, '')}/analyze`, {
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
    if (!res.ok) {
      this.logger.warn(`AI service answered ${res.status}`);
      throw new BadGatewayException('AI analysis failed');
    }

    const parsed = analysisResultSchema.safeParse(await this.readJson(res));
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
