import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import type { AuditService } from '../audit/audit.service';
import type { MailService } from '../mail/mail.service';
import type { MembershipsService } from '../memberships/memberships.service';
import type { UsersService } from '../users/users.service';
import type { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';

const INVITATION = {
  id: 'inv-1',
  organizationId: 'o1',
  email: 'new@example.com',
  role: 'member',
  acceptedAt: null,
  revokedAt: null,
  expiresAt: new Date(Date.now() + 86_400_000),
  organization: {
    id: 'o1',
    name: 'Acme',
    slug: 'acme',
    deletedAt: null,
    createdAt: new Date('2026-11-21T00:00:00.000Z'),
  },
};

function setup() {
  const repo = {
    findInOrganization: jest.fn().mockResolvedValue(INVITATION),
    revoke: jest.fn().mockResolvedValue(true),
    findByTokenHash: jest.fn().mockResolvedValue(INVITATION),
    accept: jest.fn().mockResolvedValue(true),
  };
  const users = {
    getById: jest
      .fn()
      .mockResolvedValue({ id: 'u2', email: 'new@example.com' }),
  };
  const memberships = {
    findActive: jest.fn().mockResolvedValue({ role: 'member' }),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new InvitationsService(
    repo as unknown as InvitationsRepository,
    users as unknown as UsersService,
    memberships as unknown as MembershipsService,
    {} as MailService,
    { get: () => 7 } as unknown as ConfigService<Env, true>,
    audit as unknown as AuditService,
  );
  return { service, repo, users, audit };
}

const owner = {
  userId: 'owner-1',
  organizationId: 'o1',
  role: 'owner' as const,
};

describe('invitation audit entries', () => {
  it('records a revocation by the owner', async () => {
    const { service, audit } = setup();

    await service.revoke(owner, 'inv-1');

    expect(audit.record).toHaveBeenCalledWith({
      organizationId: 'o1',
      actorId: 'owner-1',
      action: 'invitation.revoked',
      targetType: 'invitation',
      targetId: 'inv-1',
      metadata: { email: 'new@example.com', role: 'member' },
    });
  });

  it('records nothing when another request revoked it first', async () => {
    const { service, repo, audit } = setup();
    repo.revoke.mockResolvedValue(false);

    await expect(service.revoke(owner, 'inv-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('records an acceptance with the person who joined as the actor', async () => {
    const { service, audit } = setup();

    await service.accept('u2', 'raw-token');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'o1',
        actorId: 'u2',
        action: 'invitation.accepted',
      }),
    );
  });

  it('records nothing when the invitation was sent to another address', async () => {
    const { service, users, audit } = setup();
    users.getById.mockResolvedValue({ id: 'u3', email: 'other@example.com' });

    await expect(service.accept('u3', 'raw-token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});
