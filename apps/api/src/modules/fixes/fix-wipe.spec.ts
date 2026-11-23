import type { Prisma } from '@prisma/client';
import { wipeFixCode } from './fix-wipe';

function tx() {
  return {
    issueFix: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

const run = (
  client: ReturnType<typeof tx>,
  scope: Parameters<typeof wipeFixCode>[1],
) => wipeFixCode(client as unknown as Prisma.TransactionClient, scope);

describe('wipeFixCode', () => {
  it('deletes fixes that never reached GitHub', async () => {
    const client = tx();

    await run(client, { projectId: 'p1' });

    expect(client.issueFix.deleteMany).toHaveBeenCalledWith({
      where: {
        issue: { projectId: 'p1' },
        prNumber: null,
        prClaimedAt: null,
      },
    });
  });

  it('keeps the row and the link of a fix that opened, or is opening, a pull request', async () => {
    const client = tx();

    await run(client, { projectId: 'p1' });

    const call = client.issueFix.updateMany.mock.calls[0] as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ];
    expect(call[0].where).toEqual({
      issue: { projectId: 'p1' },
      OR: [{ prNumber: { not: null } }, { prClaimedAt: { not: null } }],
    });
    // Only the code goes: no prNumber or prUrl is touched.
    expect(Object.keys(call[0].data).sort()).toEqual(['edits', 'result']);
    expect(call[0].data.result).toEqual({});
  });

  it('never deletes a row that the update keeps, and never updates one it deletes', async () => {
    const client = tx();

    await run(client, { projectId: 'p1' });

    const del = (
      client.issueFix.deleteMany.mock.calls[0] as [{ where: object }]
    )[0].where;
    const upd = (
      client.issueFix.updateMany.mock.calls[0] as [{ where: object }]
    )[0].where;
    // A deleted row has no PR number and no claim; an updated one has at least one of them.
    expect(del).toMatchObject({ prNumber: null, prClaimedAt: null });
    expect(upd).toHaveProperty('OR');
  });

  it('can wipe a whole organization, through its projects', async () => {
    const client = tx();

    await run(client, { organizationId: 'o1' });

    expect(client.issueFix.deleteMany).toHaveBeenCalledWith({
      where: {
        issue: { project: { organizationId: 'o1' } },
        prNumber: null,
        prClaimedAt: null,
      },
    });
  });

  it('is scoped: it never builds a query without a project or organization', async () => {
    const client = tx();
    await run(client, { projectId: 'p1' });
    for (const mock of [
      client.issueFix.deleteMany,
      client.issueFix.updateMany,
    ]) {
      const where = (mock.mock.calls[0] as [{ where: { issue?: unknown } }])[0]
        .where;
      expect(where.issue).toBeDefined();
    }
  });
});
