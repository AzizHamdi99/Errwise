import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { FixedWindowLimiter } from '../utils/fixed-window-limiter';

const RATE_LIMIT_KEY = 'rateLimit';

interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

/** Limits a public route per client address. Use it with `@UseGuards(RateLimitGuard)`. */
export const RateLimit = (limit: number, windowSeconds: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowSeconds } satisfies RateLimitRule);

/**
 * Answers 429 (with Retry-After) once a client address has used a route's allowance. Each route
 * has its own counters. The address is `req.ip`, so behind a proxy it is only the client's if
 * Express is told how many proxies to trust. Counters live in memory (see FixedWindowLimiter).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiters = new Map<string, FixedWindowLimiter>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.get<RateLimitRule | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!rule) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const route = `${context.getClass().name}.${context.getHandler().name}`;
    let limiter = this.limiters.get(route);
    if (!limiter) {
      limiter = new FixedWindowLimiter(rule.limit, rule.windowSeconds * 1000);
      this.limiters.set(route, limiter);
    }

    const { allowed, retryAfterSeconds } = limiter.hit(req.ip ?? 'unknown');
    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      throw new HttpException(
        'Too many requests, try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
