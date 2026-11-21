import type { PrismaService } from '../../database/prisma.service';
import { EmailVerificationRepository } from './email-verification.repository';

const NOW = new Date('2026-11-21T12:00:00.000Z');

interface Setup {
  /** The row findUnique returns, if any. */
  link?: { userId: string } | null;
  /** How many rows deleteMany removes (0 when another request got there first). */
  deleted?: number;
}

function setup({ link = { userId: 'u1' }, deleted = 1 }: Setup = {}) {
  const deleteArgs: unknown[] = [];
  const userUpdates: unknown[] = [];
  const upserts: unknown[] = [];

  const tx = {
    emailVerification: {
      findUnique: jest.fn((args: unknown) => {
        void args;
        return Promise.resolve(link);
      }),
      deleteMany: jest.fn((args: unknown) => {
        deleteArgs.push(args);
        return Promise.resolve({ count: deleted });
      }),
    },
    user: {
      updateMany: jest.fn((args: unknown) => {
        userUpdates.push(args);
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
    emailVerification: {
      upsert: jest.fn((args: unknown) => {
        upserts.push(args);
        return Promise.resolve({});
      }),
      deleteMany: jest.fn((args: unknown) => {
        deleteArgs.push(args);
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const repo = new EmailVerificationRepository(
    prisma as unknown as PrismaService,
  );
  return { repo, tx, deleteArgs, userUpdates, upserts };
}

describe('EmailVerificationRepository.consume', () => {
  it('verifies the email and uses up the link, in one transaction', async () => {
    const { repo, deleteArgs, userUpdates } = setup();

    expect(await repo.consume('hash', NOW)).toBe(true);

    // the token AND the expiry are in the delete: that is what makes it one winner
    expect(deleteArgs).toEqual([
      { where: { tokenHash: 'hash', expiresAt: { gt: NOW } } },
    ]);
    // only a user that is not verified yet is touched
    expect(userUpdates).toEqual([
      {
        where: { id: 'u1', emailVerifiedAt: null },
        data: { emailVerifiedAt: NOW },
      },
    ]);
  });

  it('is false for an unknown link, and changes nothing', async () => {
    const { repo, tx, userUpdates } = setup({ link: null });

    expect(await repo.consume('unknown', NOW)).toBe(false);
    expect(tx.emailVerification.deleteMany).not.toHaveBeenCalled();
    expect(userUpdates).toHaveLength(0);
  });

  it('is false for an expired link: the delete matches nothing, the user is not touched', async () => {
    const { repo, userUpdates } = setup({ deleted: 0 });

    expect(await repo.consume('expired', NOW)).toBe(false);
    expect(userUpdates).toHaveLength(0);
  });

  it('is false for the request that lost a race for the same link', async () => {
    // both requests found the row; the other one deleted it first, so this delete removes 0
    const { repo, userUpdates } = setup({ link: { userId: 'u1' }, deleted: 0 });

    expect(await repo.consume('hash', NOW)).toBe(false);
    expect(userUpdates).toHaveLength(0);
  });
});

describe('EmailVerificationRepository.save and deleteLink', () => {
  it('keeps one row per user: saving replaces the previous link', async () => {
    const { repo, upserts } = setup();
    const expiresAt = new Date(NOW.getTime() + 1000);

    await repo.save('u1', 'hash', expiresAt, NOW);

    expect(upserts).toEqual([
      {
        where: { userId: 'u1' },
        create: { userId: 'u1', tokenHash: 'hash', expiresAt, sentAt: NOW },
        update: { tokenHash: 'hash', expiresAt, sentAt: NOW },
      },
    ]);
  });

  it('removes a link only if it is still that link, so a newer one is kept', async () => {
    const { repo, deleteArgs } = setup();

    await repo.deleteLink('u1', 'old-hash');

    expect(deleteArgs).toEqual([
      { where: { userId: 'u1', tokenHash: 'old-hash' } },
    ]);
  });
});
