import type { Project } from '@prisma/client';
import { updateProjectSchema } from '@errwise/shared';
import { ORG_ROLES_KEY } from '../memberships/decorators/org-roles.decorator';
import { ProjectsController } from './projects.controller';
import { toPublicProject } from './projects.mapper';

describe('project source context opt-in', () => {
  it('can only be changed by the owner, like every project update', () => {
    // Only the decorator metadata is read here, the method is never called.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const handler = ProjectsController.prototype.update;
    expect(Reflect.getMetadata(ORG_ROLES_KEY, handler)).toEqual(['owner']);
  });

  it('is accepted on its own by the update schema, as a real boolean', () => {
    expect(
      updateProjectSchema.safeParse({ sourceContextEnabled: true }).success,
    ).toBe(true);
    expect(
      updateProjectSchema.safeParse({ sourceContextEnabled: false }).success,
    ).toBe(true);
    for (const bad of ['true', 1, null]) {
      expect(
        updateProjectSchema.safeParse({ sourceContextEnabled: bad }).success,
      ).toBe(false);
    }
  });

  it('is exposed on the public project', () => {
    const row = {
      id: 'p1',
      organizationId: 'o1',
      name: 'API',
      slug: 'api',
      platform: 'node',
      retentionDays: 30,
      sourceContextEnabled: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    } as Project;

    expect(toPublicProject(row).sourceContextEnabled).toBe(true);
  });
});
