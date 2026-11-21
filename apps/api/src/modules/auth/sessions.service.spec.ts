import { NotFoundException } from '@nestjs/common';
import type { RefreshToken } from '@prisma/client';
import { sha256 } from '../../common/utils/hash';
import type { RefreshTokenRepository } from './refresh-token.repository';
import { SessionsService } from './sessions.service';

const USER = 'user-1';

function token(overrides: Partial<RefreshToken>): RefreshToken {
  return {
    id: 't',
    userId: USER,
    familyId: 'fam-a',
    tokenHash: 'h',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    revokedAt: null,
    userAgent: 'Mozilla/5.0',
    ip: '203.0.113.7',
    createdAt: new Date('2026-11-21T10:00:00.000Z'),
    ...overrides,
  };
}

function setup(cookieToken: RefreshToken | null = null) {
  const repo = {
    findByHash: jest.fn().mockResolvedValue(cookieToken),
    listLive: jest.fn().mockResolvedValue([]),
    revokeFamilyOfUser: jest.fn().mockResolvedValue(true),
    revokeAllOfUserExcept: jest.fn().mockResolvedValue(1),
  };
  const service = new SessionsService(
    repo as unknown as RefreshTokenRepository,
  );
  return { service, repo };
}

describe('SessionsService.list', () => {
  it('returns one row per family and marks the one of this request', async () => {
    const { service, repo } = setup(token({ familyId: 'fam-b' }));
    repo.listLive.mockResolvedValue([
      token({ id: '1', familyId: 'fam-b' }),
      token({ id: '2', familyId: 'fam-a', ip: null, userAgent: null }),
      token({ id: '3', familyId: 'fam-a' }),
    ]);

    const sessions = await service.list(USER, 'raw-cookie');

    expect(repo.findByHash).toHaveBeenCalledWith(sha256('raw-cookie'));
    expect(repo.listLive).toHaveBeenCalledWith(USER, expect.any(Date));
    expect(sessions).toEqual([
      {
        id: 'fam-b',
        userAgent: 'Mozilla/5.0',
        ip: '203.0.113.7',
        lastUsedAt: '2026-11-21T10:00:00.000Z',
        current: true,
      },
      {
        id: 'fam-a',
        userAgent: null,
        ip: null,
        lastUsedAt: '2026-11-21T10:00:00.000Z',
        current: false,
      },
    ]);
  });

  it('marks nothing as current without a refresh cookie', async () => {
    const { service, repo } = setup();
    repo.listLive.mockResolvedValue([token({})]);

    const sessions = await service.list(USER, undefined);

    expect(repo.findByHash).not.toHaveBeenCalled();
    expect(sessions[0].current).toBe(false);
  });

  it('never treats another user cookie as the current session', async () => {
    const { service, repo } = setup(
      token({ userId: 'someone-else', familyId: 'fam-a' }),
    );
    repo.listLive.mockResolvedValue([token({ familyId: 'fam-a' })]);

    const sessions = await service.list(USER, 'raw-cookie');

    expect(sessions[0].current).toBe(false);
  });
});

describe('SessionsService.revoke', () => {
  it('revokes the family, scoped by user', async () => {
    const { service, repo } = setup();

    await service.revoke(USER, 'fam-a');

    expect(repo.revokeFamilyOfUser).toHaveBeenCalledWith(USER, 'fam-a');
  });

  it('answers 404 for a session that is not live or not the user own', async () => {
    const { service, repo } = setup();
    repo.revokeFamilyOfUser.mockResolvedValue(false);

    await expect(service.revoke(USER, 'fam-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('SessionsService.revokeOthers', () => {
  it('keeps the session of this request', async () => {
    const { service, repo } = setup(token({ familyId: 'fam-b' }));

    await service.revokeOthers(USER, 'raw-cookie');

    expect(repo.revokeAllOfUserExcept).toHaveBeenCalledWith(USER, 'fam-b');
  });

  it('revokes every session when the request has no live session', async () => {
    const { service, repo } = setup(
      token({ familyId: 'fam-b', revokedAt: new Date() }),
    );

    await service.revokeOthers(USER, 'raw-cookie');

    expect(repo.revokeAllOfUserExcept).toHaveBeenCalledWith(USER, null);
  });
});
