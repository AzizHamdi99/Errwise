import { NotFoundException } from '@nestjs/common';
import type { AuditService } from '../audit/audit.service';
import type { ProjectsService } from '../projects/projects.service';
import type { ApiKeysRepository } from './api-keys.repository';
import { ApiKeysService } from './api-keys.service';

const KEY = {
  id: 'k1',
  projectId: 'p1',
  name: 'CI key',
  kind: 'ingest',
  prefix: 'ew_live_abcd',
  keyHash: 'hash-never-logged',
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-11-21T00:00:00.000Z'),
};

function setup() {
  const repo = {
    countActive: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue(KEY),
    findInProject: jest.fn().mockResolvedValue(KEY),
    revoke: jest.fn().mockResolvedValue(true),
  };
  const projects = { get: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new ApiKeysService(
    repo as unknown as ApiKeysRepository,
    projects as unknown as ProjectsService,
    audit as unknown as AuditService,
  );
  return { service, repo, audit };
}

describe('API key audit entries', () => {
  it('records a created key by name and prefix, never the key or its hash', async () => {
    const { service, audit } = setup();

    const created = await service.create('o1', 'p1', { name: 'CI key' }, 'u1');

    expect(audit.record).toHaveBeenCalledWith({
      organizationId: 'o1',
      actorId: 'u1',
      action: 'api_key.created',
      targetType: 'api_key',
      targetId: 'k1',
      projectId: 'p1',
      metadata: { name: 'CI key', prefix: 'ew_live_abcd' },
    });
    const logged = JSON.stringify(audit.record.mock.calls);
    expect(logged).not.toContain(created.key);
    expect(logged).not.toContain('hash-never-logged');
  });

  it('records a revocation once: a second revoke of the same key is not an event', async () => {
    const { service, repo, audit } = setup();

    await service.revoke('o1', 'p1', 'k1', 'u1');
    repo.revoke.mockResolvedValue(false);
    await service.revoke('o1', 'p1', 'k1', 'u1');

    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'api_key.revoked', targetId: 'k1' }),
    );
  });

  it('records nothing for a key that is not in the project', async () => {
    const { service, repo, audit } = setup();
    repo.findInProject.mockResolvedValue(null);

    await expect(service.revoke('o1', 'p1', 'k9', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});
