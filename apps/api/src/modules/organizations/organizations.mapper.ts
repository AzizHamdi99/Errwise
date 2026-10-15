import type { Organization } from '@prisma/client';
import type { OrgRole, PublicOrganization } from '@errwise/shared';

export function toPublicOrganization(
  org: Organization,
  role: OrgRole,
): PublicOrganization {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    role,
    createdAt: org.createdAt.toISOString(),
  };
}
