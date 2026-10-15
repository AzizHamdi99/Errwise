import type { InvitationPreview, PublicInvitation } from '@errwise/shared';
import { toOrgRole } from '../memberships/memberships.mapper';
import type { InvitationWithRelations } from './invitations.repository';

export function inviterLabel(inv: InvitationWithRelations): string | null {
  return inv.invitedBy?.name ?? inv.invitedBy?.email ?? null;
}

export function toPublicInvitation(
  inv: InvitationWithRelations,
): PublicInvitation {
  return {
    id: inv.id,
    email: inv.email,
    role: toOrgRole(inv.role),
    invitedBy: inviterLabel(inv),
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  };
}

export function toInvitationPreview(
  inv: InvitationWithRelations,
): InvitationPreview {
  return {
    organizationName: inv.organization.name,
    email: inv.email,
    role: toOrgRole(inv.role),
    inviterName: inviterLabel(inv),
    expiresAt: inv.expiresAt.toISOString(),
  };
}
