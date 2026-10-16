import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { Env } from '../../config/env';
import type { ApiKeyContext } from '../api-keys/api-key.types';

const WINDOW_MS = 60_000;
const SWEEP_THRESHOLD = 1_000;

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window limit per API key, in memory. It resets on restart and is
 * per instance on serverless, which is enough for the MVP. Move to Redis later.
 * Must run after ApiKeyGuard.
 */
@Injectable()
export class IngestRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();
  private readonly limit: number;

  constructor(config: ConfigService<Env, true>) {
    this.limit = config.get('INGEST_RATE_LIMIT_PER_MINUTE', { infer: true });
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { apiKey?: ApiKeyContext }>();
    const res = http.getResponse<Response>();

    const key = req.apiKey?.apiKeyId;
    if (!key) throw new UnauthorizedException();

    const now = Date.now();
    this.sweep(now);

    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + WINDOW_MS };
      this.windows.set(key, window);
    }
    window.count += 1;

    if (window.count > this.limit) {
      res.setHeader('Retry-After', Math.ceil((window.resetAt - now) / 1000));
      throw new HttpException(
        'Rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  /** Drops expired windows so the map can't grow without bound. */
  private sweep(now: number): void {
    if (this.windows.size < SWEEP_THRESHOLD) return;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
