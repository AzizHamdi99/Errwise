import { SetMetadata } from '@nestjs/common';
import type { OrgRole } from '@errwise/shared';

export const ORG_ROLES_KEY = 'org_roles';

/** Restricts a route to these roles. Without it, any member can access. */
export const OrgRoles = (...roles: OrgRole[]) =>
  SetMetadata(ORG_ROLES_KEY, roles);
