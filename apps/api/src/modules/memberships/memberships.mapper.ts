import type { PublicMember } from '@errwise/shared';
import { ORG_ROLES } from '@errwise/shared';
import type { OrgRole } from '@errwise/shared';
import type { MembershipWithUser } from './memberships.repository';

/** `role` is a plain string in the database, so validate it here. */
export function toOrgRole(value: string): OrgRole {
  return (ORG_ROLES as readonly string[]).includes(value)
    ? (value as OrgRole)
    : 'member';
}

export function toPublicMember(m: MembershipWithUser): PublicMember {
  return {
    userId: m.user.id,
    email: m.user.email,
    name: m.user.name,
    role: toOrgRole(m.role),
    joinedAt: m.createdAt.toISOString(),
  };
}
