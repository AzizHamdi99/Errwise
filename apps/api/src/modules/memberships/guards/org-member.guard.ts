import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { idSchema } from '@errwise/shared';
import type { OrgRole } from '@errwise/shared';
import type { AuthUser } from '../../../common/types/auth-user';
import { ORG_ROLES_KEY } from '../decorators/org-roles.decorator';
import { MembershipsService } from '../memberships.service';
import type { OrgMembership } from '../memberships.types';

type OrgRequest = Request & { user?: AuthUser; membership?: OrgMembership };

/**
 * Must run after JwtAuthGuard. Checks that the user belongs to :orgId
 * and (optionally) has one of the roles set with @OrgRoles().
 * A non-member gets 404, so organization ids are not leaked.
 */
@Injectable()
export class OrgMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly memberships: MembershipsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<OrgRequest>();
    if (!req.user) throw new UnauthorizedException();

    const orgId = idSchema.safeParse(req.params.orgId);
    if (!orgId.success) throw new NotFoundException('Organization not found');

    const membership = await this.memberships.findActive(
      req.user.id,
      orgId.data,
    );
    if (!membership) throw new NotFoundException('Organization not found');

    const roles = this.reflector.getAllAndOverride<OrgRole[] | undefined>(
      ORG_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (roles && roles.length > 0 && !roles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    req.membership = membership;
    return true;
  }
}
