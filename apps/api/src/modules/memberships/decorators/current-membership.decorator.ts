import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { OrgMembership } from '../memberships.types';

export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrgMembership => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { membership: OrgMembership }>();
    return req.membership;
  },
);
