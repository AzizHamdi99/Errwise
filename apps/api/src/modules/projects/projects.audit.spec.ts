import { NotFoundException } from '@nestjs/common';
import type { Project } from '@prisma/client';
import type { AuditService } from '../audit/audit.service';
import type { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

const BEFORE = {
  id: 'p1',
  organizationId: 'o1',
  name: 'Shop',
  slug: 'shop',
  platform: 'node',
  retentionDays: 30,
  sourceContextEnabled: false,
  createdAt: new Date('2026-11-21T00:00:00.000Z'),
} as Project;

function setup(after: Partial<Project> = {}) {
  const repo = {
    findInOrganization: jest.fn().mockResolvedValue(BEFORE),
    update: jest.fn().mockResolvedValue({ ...BEFORE, ...after }),
    softDelete: jest.fn().mockResolvedValue(undefined),
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

describe('project audit entries', () => {
  it('records turning source code on as its own event', async () => {
    const { service, audit } = setup({ sourceContextEnabled: true });

    await service.update('o1', 'p1', { sourceContextEnabled: true }, 'owner-1');

    expect(actions(audit)).toEqual(['project.source_context_enabled']);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'owner-1', projectId: 'p1' }),
    );
  });

  it('records the settings that really changed, with the old name', async () => {
    const { service, audit } = setup({ name: 'Store', retentionDays: 60 });

    await service.update(
      'o1',
      'p1',
      { name: 'Store', retentionDays: 60 },
      'owner-1',
    );

    expect(actions(audit)).toEqual(['project.updated']);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          name: 'Store',
          fields: 'name, retentionDays',
          previousName: 'Shop',
        },
      }),
    );
  });

  it('records nothing when the update changes nothing', async () => {
    const { service, audit } = setup();

    await service.update('o1', 'p1', { name: 'Shop' }, 'owner-1');

    expect(audit.record).not.toHaveBeenCalled();
  });

  it('records a deletion with the name, which outlives the project', async () => {
    const { service, audit } = setup();

    await service.remove('o1', 'p1', 'owner-1');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'project.deleted',
        metadata: { name: 'Shop' },
      }),
    );
  });

  it('records nothing for a project of another organization', async () => {
    const { service, repo, audit } = setup();
    repo.findInOrganization.mockResolvedValue(null);

    await expect(service.remove('o2', 'p1', 'u9')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.softDelete).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
