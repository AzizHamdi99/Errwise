import type { Project } from '@prisma/client';
import type { PublicProject } from '@errwise/shared';

export function toPublicProject(project: Project): PublicProject {
  return {
    id: project.id,
    organizationId: project.organizationId,
    name: project.name,
    slug: project.slug,
    platform: project.platform,
    retentionDays: project.retentionDays,
    createdAt: project.createdAt.toISOString(),
  };
}
