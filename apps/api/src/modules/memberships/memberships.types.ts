import type { OrgRole } from '@errwise/shared';

/** What the guard attaches to the request. */
export interface OrgMembership {
  userId: string;
  organizationId: string;
  role: OrgRole;
}
