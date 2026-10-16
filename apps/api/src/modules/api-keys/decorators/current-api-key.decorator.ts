import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { ApiKeyContext } from '../api-key.types';

export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { apiKey: ApiKeyContext }>();
    return req.apiKey;
  },
);
