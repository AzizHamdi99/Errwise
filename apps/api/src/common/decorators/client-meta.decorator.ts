import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface ClientMeta {
  userAgent: string | null;
  ip: string | null;
}

export const Client = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClientMeta => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return {
      userAgent: req.headers['user-agent']?.slice(0, 255) ?? null,
      ip: req.ip ?? null,
    };
  },
);
