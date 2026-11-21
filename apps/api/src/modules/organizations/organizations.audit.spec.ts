import type { AuditService } from '../audit/audit.service';
import type { OrganizationsRepository } from './organizations.repository';
import { OrganizationsService } from './organizations.service';

const ORG = {
  id: 'o1',
  name: 'Acme',
  slug: 'acme',
  createdAt: new Date('2026-11-21T00:00:00.000Z'),
  updatedAt: new Date('2026-11-21T00:00:00.000Z'),
  deletedAt: null,
};

function setup(newName: string) {
  const repo = {
    findById: jest.fn().mockResolvedValue(ORG),
    update: jest.fn().mockResolvedValue({ ...ORG, name: newName }),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new OrganizationsService(
    repo as unknown as OrganizationsRepository,
    audit as unknown as AuditService,
  );
  return { service, audit };
}

describe('organization audit entries', () => {
  it('records a rename with the old and new name', async () => {
    const { service, audit } = setup('Acme Inc');

    await service.update('o1', 'owner', { name: 'Acme Inc' }, 'owner-1');

    expect(audit.record).toHaveBeenCalledWith({
      organizationId: 'o1',
      actorId: 'owner-1',
      action: 'organization.renamed',
      targetType: 'organization',
      targetId: 'o1',
      metadata: { from: 'Acme', to: 'Acme Inc' },
    });
  });

  it('records nothing when the name is unchanged', async () => {
    const { service, audit } = setup('Acme');

    await service.update('o1', 'owner', { name: 'Acme' }, 'owner-1');

    expect(audit.record).not.toHaveBeenCalled();
  });
});
