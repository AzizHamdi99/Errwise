import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyAuthService } from '../api-key-auth.service';
import type { ApiKeyContext } from '../api-key.types';

/** For the ingestion routes: reads x-api-key and attaches the project context. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly auth: ApiKeyAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { apiKey?: ApiKeyContext }>();
    const header = req.headers['x-api-key'];
    const raw = Array.isArray(header) ? header[0] : header;

    req.apiKey = await this.auth.authenticate(raw);
    return true;
  }
}
