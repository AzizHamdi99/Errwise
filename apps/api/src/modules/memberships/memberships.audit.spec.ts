import { ForbiddenException } from '@nestjs/common';
import type { AuditService } from '../audit/audit.service';
import type { MembershipsRepository } from './memberships.repository';
import { MembershipsService } from './memberships.service';

const ORG = 'o1';

function member(userId: string, role: string) {
  return {
    userId,
    organizationId: ORG,
    role,
    createdAt: new Date('2026-11-21T00:00:00.000Z'),
    user: {
      id: userId,
      email: `${userId}@example.com`,
      name: `Name ${userId}`,
    },
  };
}

function setup(target = member('u2', 'member')) {
  const repo = {
    find: jest.fn().mockResolvedValue(target),
    updateRole: jest.fn((userId: string, _org: string, role: string) =>
      Promise.resolve({ ...target, role }),
    ),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new MembershipsService(
    repo as unknown as MembershipsRepository,
    audit as unknown as AuditService,
  );
  return { service, repo, audit };
}

describe('member audit entries', () => {
  it('records a role change with the old and new role', async () => {
    const { service, audit } = setup();

    await service.changeRole(ORG, 'u2', 'admin', 'owner-1');

    expect(audit.record).toHaveBeenCalledWith({
      organizationId: ORG,
      actorId: 'owner-1',
      action: 'member.role_changed',
      targetType: 'member',
      targetId: 'u2',
      metadata: {
        email: 'u2@example.com',
        name: 'Name u2',
        from: 'member',
        to: 'admin',
      },
    });
  });

  it('records nothing when the role does not change', async () => {
    const { service, audit } = setup();

    await service.changeRole(ORG, 'u2', 'member', 'owner-1');

    expect(audit.record).not.toHaveBeenCalled();
  });

  it('records nothing when the change is refused', async () => {
    const { service, audit } = setup(member('u1', 'owner'));

    await expect(
      service.changeRole(ORG, 'u1', 'member', 'owner-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('records a removal, and tells a member who left from one who was removed', async () => {
    const { service, audit } = setup();

    await service.remove(
      { userId: 'admin-1', organizationId: ORG, role: 'admin' },
      'u2',
    );
    await service.remove(
      { userId: 'u2', organizationId: ORG, role: 'member' },
      'u2',
    );

    const [removed, left] = audit.record.mock.calls.map(
      (call) => (call as [{ actorId: string; metadata: { left: boolean } }])[0],
    );
    expect(removed.actorId).toBe('admin-1');
    expect(removed.metadata.left).toBe(false);
    expect(left.actorId).toBe('u2');
    expect(left.metadata.left).toBe(true);
  });

  it('records nothing when a member may not remove someone', async () => {
    const { service, repo, audit } = setup(member('u3', 'admin'));

    await expect(
      service.remove(
        { userId: 'admin-1', organizationId: ORG, role: 'admin' },
        'u3',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.delete).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
