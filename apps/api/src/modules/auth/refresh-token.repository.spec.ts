import type { PrismaService } from '../../database/prisma.service';
import { RefreshTokenRepository } from './refresh-token.repository';

function setup(count = 1) {
  const updateMany = jest.fn().mockResolvedValue({ count });
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = { refreshToken: { updateMany, findMany } };
  const repo = new RefreshTokenRepository(prisma as unknown as PrismaService);
  return { repo, updateMany, findMany };
}

describe('RefreshTokenRepository session queries are scoped by user', () => {
  it('lists only the live tokens of the user', async () => {
    const { repo, findMany } = setup();
    const now = new Date('2026-11-21T12:00:00.000Z');

    await repo.listLive('u1', now);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', revokedAt: null, expiresAt: { gt: now } },
      }),
    );
  });

  it('revokes a family only when it belongs to the user', async () => {
    const { repo, updateMany } = setup(0);

    expect(await repo.revokeFamilyOfUser('u1', 'fam-of-someone-else')).toBe(
      false,
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', familyId: 'fam-of-someone-else', revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date },
    });
  });

  it('keeps one family when asked, or revokes all of them', async () => {
    const { repo, updateMany } = setup();

    await repo.revokeAllOfUserExcept('u1', 'fam-keep');
    await repo.revokeAllOfUserExcept('u1', null);

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { userId: 'u1', revokedAt: null, familyId: { not: 'fam-keep' } },
      data: { revokedAt: expect.any(Date) as Date },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date },
    });
  });
});
