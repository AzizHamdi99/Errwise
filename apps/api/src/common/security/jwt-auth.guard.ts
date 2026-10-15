import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ACCESS_COOKIE } from '../constants';
import type { AuthUser } from '../types/auth-user';
import { TokenService } from './token.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException();

    const payload = await this.tokens.verifyAccessToken(token);
    if (!payload) throw new UnauthorizedException();

    req.user = { id: payload.sub, email: payload.email };
    return true;
  }

  private extractToken(req: Request): string | undefined {
    const fromCookie = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (fromCookie) return fromCookie;
    const [type, value] = req.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? value : undefined;
  }
}
