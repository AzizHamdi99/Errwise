import type { PrismaService } from '../../database/prisma.service';
import { PasswordResetRepository } from './password-reset.repository';

const NOW = new Date('2026-11-21T12:00:00.000Z');

interface Setup {
  /** The row findUnique returns, if any. */
  link?: { userId: string } | null;
  /** How many rows deleteMany removes (0 when another request got there first, or expired). */
  deleted?: number;
}

function setup({ link = { userId: 'u1' }, deleted = 1 }: Setup = {}) {
  const tx = {
    passwordReset: {
      findUnique: jest.fn().mockResolvedValue(link),
      deleteMany: jest.fn().mockResolvedValue({ count: deleted }),
    },
    user: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    emailVerification: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    refreshToken: {
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
    passwordReset: {
      findUnique: jest.fn(),
    },
  };
  const repo = new PasswordResetRepository(prisma as unknown as PrismaService);
  return { repo, tx, prisma };
}

describe('PasswordResetRepository.consume', () => {
  it('sets the password, verifies the email and revokes every session, in one transaction', async () => {
    const { repo, tx, prisma } = setup();

    expect(await repo.consume('hash', NOW, 'new-hash')).toBe(true);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // The expiry is in the where: an expired link deletes nothing and wins nothing.
    expect(tx.passwordReset.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: 'hash', expiresAt: { gt: NOW } },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'new-hash' },
    });
    // Only an unverified email changes: a verified date is kept.
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', emailVerifiedAt: null },
      data: { emailVerifiedAt: NOW },
    });
    expect(tx.emailVerification.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: NOW },
    });
  });

  it('changes nothing for an unknown link', async () => {
    const { repo, tx } = setup({ link: null });

    expect(await repo.consume('hash', NOW, 'new-hash')).toBe(false);

    expect(tx.passwordReset.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('changes nothing when the link expired or another request used it first', async () => {
    const { repo, tx } = setup({ deleted: 0 });

    expect(await repo.consume('hash', NOW, 'new-hash')).toBe(false);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe('PasswordResetRepository.isUsable', () => {
  it('is true only for a link that exists and has not expired', async () => {
    const { repo, prisma } = setup();
    const find = prisma.passwordReset.findUnique;

    find.mockResolvedValueOnce({ expiresAt: new Date(NOW.getTime() + 1) });
    expect(await repo.isUsable('hash', NOW)).toBe(true);

    find.mockResolvedValueOnce({ expiresAt: NOW });
    expect(await repo.isUsable('hash', NOW)).toBe(false);

    find.mockResolvedValueOnce(null);
    expect(await repo.isUsable('hash', NOW)).toBe(false);
  });
});
