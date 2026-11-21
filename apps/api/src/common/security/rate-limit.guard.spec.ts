import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimit, RateLimitGuard } from './rate-limit.guard';

class Controller {}

/**
 * A route handler as Nest sees it: a named function, with the rule the decorator attaches to it.
 * The name matters: the guard keeps separate counters per `Class.handlerName`.
 */
function route(name: string, rule?: { limit: number; windowSeconds: number }) {
  const handler = (): void => {};
  Object.defineProperty(handler, 'name', { value: name });
  if (rule) {
    RateLimit(rule.limit, rule.windowSeconds)({}, name, { value: handler });
  }
  return handler;
}

const limited = route('limited', { limit: 2, windowSeconds: 60 });
const strict = route('strict', { limit: 1, windowSeconds: 60 });
const unlimited = route('unlimited');

function context(
  handler: () => void,
  ip: string | undefined,
  headers: Record<string, string> = {},
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
      getResponse: () => ({
        setHeader: (name: string, value: string) => {
          headers[name] = value;
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  beforeEach(() => {
    guard = new RateLimitGuard(new Reflector());
  });

  it('lets a route without a rule through, however often it is called', () => {
    for (let i = 0; i < 50; i++) {
      expect(guard.canActivate(context(unlimited, '1.1.1.1'))).toBe(true);
    }
  });

  it('allows the limit, then answers 429 with Retry-After', () => {
    const headers: Record<string, string> = {};
    const call = () => guard.canActivate(context(limited, '1.1.1.1', headers));

    expect(call()).toBe(true);
    expect(call()).toBe(true);

    let error: unknown;
    try {
      call();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.TOO_MANY_REQUESTS,
    );
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('counts each client address on its own', () => {
    guard.canActivate(context(strict, '1.1.1.1'));

    expect(guard.canActivate(context(strict, '2.2.2.2'))).toBe(true);
    expect(() => guard.canActivate(context(strict, '1.1.1.1'))).toThrow(
      HttpException,
    );
  });

  it('counts each route on its own', () => {
    guard.canActivate(context(strict, '1.1.1.1'));

    // the same address, a different route: its own allowance
    expect(guard.canActivate(context(limited, '1.1.1.1'))).toBe(true);
  });

  it('does not crash on a request without an address', () => {
    expect(guard.canActivate(context(limited, undefined))).toBe(true);
  });
});
