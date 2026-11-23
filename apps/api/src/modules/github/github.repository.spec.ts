import type { PrismaService } from '../../database/prisma.service';
import { GithubRepository } from './github.repository';

/**
 * A prisma whose transaction client is a separate object, so a test can tell what ran inside
 * the transaction from what ran outside it.
 */
function setup() {
  const tx = {
    project: { update: jest.fn().mockResolvedValue({}) },
    issueFix: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const outside = { project: { update: jest.fn() } };
  const prisma = {
    ...outside,
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  return {
    repo: new GithubRepository(prisma as unknown as PrismaService),
    tx,
    outside,
  };
}

function expectWipedInTransaction(tx: ReturnType<typeof setup>['tx']) {
  expect(tx.issueFix.deleteMany).toHaveBeenCalledWith({
    where: {
      issue: { projectId: 'p1' },
      prNumber: null,
      prClaimedAt: null,
    },
  });
  expect(tx.issueFix.updateMany).toHaveBeenCalled();
}

describe('GithubRepository.disconnect', () => {
  it('also switches source code and AI fixes off: no repository, no consent to use it', async () => {
    const { repo, tx } = setup();

    await repo.disconnect('p1');

    expect(tx.project.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        githubInstallationId: null,
        githubRepo: null,
        sourceContextEnabled: false,
        fixPullRequestsEnabled: false,
      },
    });
  });

  it('removes the code of the stored fixes, in the same transaction', async () => {
    const { repo, tx, outside } = setup();

    await repo.disconnect('p1');

    expectWipedInTransaction(tx);
    expect(outside.project.update).not.toHaveBeenCalled();
  });
});

describe('GithubRepository.saveRepo and saveInstallation', () => {
  it('removes the code of the stored fixes when another repository is chosen', async () => {
    const { repo, tx } = setup();

    await repo.saveRepo('p1', 'acme/other');

    expect(tx.project.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { githubRepo: 'acme/other' },
    });
    expectWipedInTransaction(tx);
  });

  it('removes it when a new installation is connected, which also clears the repository', async () => {
    const { repo, tx } = setup();

    await repo.saveInstallation('p1', '99');

    expect(tx.project.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { githubInstallationId: '99', githubRepo: null },
    });
    expectWipedInTransaction(tx);
  });

  it('does not report success when the wipe fails: the whole change rolls back', async () => {
    const { repo, tx } = setup();
    tx.issueFix.deleteMany.mockRejectedValue(new Error('db down'));

    await expect(repo.saveRepo('p1', 'acme/other')).rejects.toThrow('db down');
  });
});
