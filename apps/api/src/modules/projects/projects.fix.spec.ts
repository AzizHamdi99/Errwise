import { BadRequestException } from '@nestjs/common';
import type { Project } from '@prisma/client';
import { updateProjectSchema } from '@errwise/shared';
import type { AuditService } from '../audit/audit.service';
import { ORG_ROLES_KEY } from '../memberships/decorators/org-roles.decorator';
import { ProjectsController } from './projects.controller';
import { toPublicProject } from './projects.mapper';
import type { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

const BASE = {
  id: 'p1',
  organizationId: 'o1',
  name: 'Shop',
  slug: 'shop',
  platform: 'node',
  retentionDays: 30,
  sourceContextEnabled: true,
  fixPullRequestsEnabled: false,
  createdAt: new Date('2026-11-21T00:00:00.000Z'),
} as Project;

function setup(before: Partial<Project> = {}, after: Partial<Project> = {}) {
  const repo = {
    findInOrganization: jest.fn().mockResolvedValue({ ...BASE, ...before }),
    update: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ ...BASE, ...before, ...after }),
      ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new ProjectsService(
    repo as unknown as ProjectsRepository,
    audit as unknown as AuditService,
  );
  return { service, repo, audit };
}

const actions = (audit: { record: jest.Mock }) =>
  audit.record.mock.calls.map((c) => (c as [{ action: string }])[0].action);

describe('AI fix pull requests switch', () => {
  it('can only be changed by the owner, like every project update', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const handler = ProjectsController.prototype.update;
    expect(Reflect.getMetadata(ORG_ROLES_KEY, handler)).toEqual(['owner']);
  });

  it('is accepted on its own by the update schema, as a real boolean', () => {
    expect(
      updateProjectSchema.safeParse({ fixPullRequestsEnabled: true }).success,
    ).toBe(true);
    for (const bad of ['true', 1, null]) {
      expect(
        updateProjectSchema.safeParse({ fixPullRequestsEnabled: bad }).success,
      ).toBe(false);
    }
  });

  it('is exposed on the public project', () => {
    expect(
      toPublicProject({ ...BASE, fixPullRequestsEnabled: true })
        .fixPullRequestsEnabled,
    ).toBe(true);
  });

  it('is turned on when source code is on, and audited as its own event', async () => {
    const { service, repo, audit } = setup(
      {},
      { fixPullRequestsEnabled: true },
    );

    await service.update(
      'o1',
      'p1',
      { fixPullRequestsEnabled: true },
      'owner-1',
    );

    expect(repo.update).toHaveBeenCalledWith('p1', {
      fixPullRequestsEnabled: true,
    });
    expect(actions(audit)).toEqual(['project.fix_pull_requests_enabled']);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'owner-1', projectId: 'p1' }),
    );
  });

  it('cannot be turned on while source code is off', async () => {
    const { service, repo, audit } = setup({ sourceContextEnabled: false });

    await expect(
      service.update('o1', 'p1', { fixPullRequestsEnabled: true }, 'owner-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('cannot be turned on in the same request that turns source code off', async () => {
    const { service, repo } = setup();

    await expect(
      service.update(
        'o1',
        'p1',
        { sourceContextEnabled: false, fixPullRequestsEnabled: true },
        'owner-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('can be turned on in the same request that turns source code on', async () => {
    const { service, repo } = setup(
      { sourceContextEnabled: false },
      { sourceContextEnabled: true, fixPullRequestsEnabled: true },
    );

    await service.update(
      'o1',
      'p1',
      { sourceContextEnabled: true, fixPullRequestsEnabled: true },
      'owner-1',
    );

    expect(repo.update).toHaveBeenCalledWith('p1', {
      sourceContextEnabled: true,
      fixPullRequestsEnabled: true,
    });
  });

  it('is turned off when source code is turned off, and both changes are audited', async () => {
    const { service, repo, audit } = setup(
      { fixPullRequestsEnabled: true },
      { sourceContextEnabled: false, fixPullRequestsEnabled: false },
    );

    await service.update(
      'o1',
      'p1',
      { sourceContextEnabled: false },
      'owner-1',
    );

    expect(repo.update).toHaveBeenCalledWith('p1', {
      sourceContextEnabled: false,
      fixPullRequestsEnabled: false,
    });
    expect(actions(audit)).toEqual([
      'project.source_context_disabled',
      'project.fix_pull_requests_disabled',
    ]);
  });

  it('records nothing when the value did not change', async () => {
    const { service, audit } = setup({ fixPullRequestsEnabled: true });

    await service.update(
      'o1',
      'p1',
      { fixPullRequestsEnabled: true },
      'owner-1',
    );

    expect(audit.record).not.toHaveBeenCalled();
  });

  it('is turned off by itself, and audited', async () => {
    const { service, audit } = setup(
      { fixPullRequestsEnabled: true },
      { fixPullRequestsEnabled: false },
    );

    await service.update(
      'o1',
      'p1',
      { fixPullRequestsEnabled: false },
      'owner-1',
    );

    expect(actions(audit)).toEqual(['project.fix_pull_requests_disabled']);
  });
});
