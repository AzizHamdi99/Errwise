import type { PrismaService } from '../../database/prisma.service';
import { AuditRepository } from './audit.repository';

function setup() {
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = { auditLog: { findMany } };
  const repo = new AuditRepository(prisma as unknown as PrismaService);
  return { repo, findMany };
}

type FindArgs = {
  where: Record<string, unknown>;
  orderBy: unknown;
  take: number;
};

describe('AuditRepository.list', () => {
  it('is scoped by organization, newest first by id', async () => {
    const { repo, findMany } = setup();

    await repo.list('org-1', { take: 51 });

    const args = (findMany.mock.calls[0] as [FindArgs])[0];
    expect(args.where).toEqual({ organizationId: 'org-1' });
    expect(args.orderBy).toEqual({ id: 'desc' });
    expect(args.take).toBe(51);
  });

  it('pages strictly after the cursor and filters by action', async () => {
    const { repo, findMany } = setup();

    await repo.list('org-1', {
      take: 11,
      cursor: 'last-id',
      action: 'api_key.revoked',
    });

    const args = (findMany.mock.calls[0] as [FindArgs])[0];
    expect(args.where).toEqual({
      organizationId: 'org-1',
      action: 'api_key.revoked',
      id: { lt: 'last-id' },
    });
  });
});
