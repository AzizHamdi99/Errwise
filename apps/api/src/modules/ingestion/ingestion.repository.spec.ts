import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import { IngestionRepository } from './ingestion.repository';
import type { StoreEventData } from './ingestion.repository';

const TIMESTAMP = new Date('2026-11-20T10:00:00.000Z');

const data: StoreEventData = {
  projectId: 'p1',
  fingerprint: 'f1',
  fingerprintVersion: 1,
  title: 'Error: boom',
  eventId: '0198a2b4-7c1e-7a3b-8f00-1234567890ab',
  level: 'error',
  type: 'Error',
  message: 'boom',
  platform: 'node',
  environment: 'staging',
  timestamp: TIMESTAMP,
};

function conflict(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

/** A fake transaction client that records the order of the writes. */
function setup(
  overrides: {
    eventCreate?: () => Promise<unknown>;
    environmentCreateMany?: () => Promise<unknown>;
  } = {},
) {
  const calls: string[] = [];
  const createMany = jest.fn((args: Prisma.IssueEnvironmentCreateManyArgs) => {
    void args;
    calls.push('issueEnvironment.createMany');
    return overrides.environmentCreateMany?.() ?? Promise.resolve({ count: 1 });
  });
  const tx = {
    issue: {
      upsert: jest.fn(() => {
        calls.push('issue.upsert');
        // an existing, unresolved issue that was seen after this event: no other write needed
        return Promise.resolve({
          id: 'i1',
          eventCount: 5,
          status: 'unresolved',
          lastSeenAt: new Date('2030-01-01T00:00:00.000Z'),
        });
      }),
      updateMany: jest.fn(),
    },
    event: {
      create: jest.fn(() => {
        calls.push('event.create');
        return overrides.eventCreate?.() ?? Promise.resolve({});
      }),
    },
    issueEnvironment: { createMany },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
  };
  const repo = new IngestionRepository(prisma as unknown as PrismaService);
  return { repo, calls, createMany, prisma };
}

describe('IngestionRepository.store: environment summary', () => {
  it('records the environment in the same transaction, after the event', async () => {
    const { repo, calls, createMany, prisma } = setup();

    await repo.store(data);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      'issue.upsert',
      'event.create',
      'issueEnvironment.createMany',
    ]);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          issueId: 'i1',
          projectId: 'p1',
          environment: 'staging',
          firstSeenAt: TIMESTAMP,
        },
      ],
      // ON CONFLICT DO NOTHING: an environment that is already known must not fail the event
      skipDuplicates: true,
    });
  });

  it('writes the project from the event data, never anything else', async () => {
    const { repo, createMany } = setup();

    await repo.store({ ...data, projectId: 'p-from-api-key' });

    expect(createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ projectId: 'p-from-api-key' }),
    ]);
  });

  it('writes nothing for a duplicate eventId: the transaction rolls back', async () => {
    const { repo, createMany } = setup({
      eventCreate: () => Promise.reject(conflict(['projectId', 'eventId'])),
    });

    await expect(repo.store(data)).resolves.toBeNull();
    // the environment insert comes after the event, so it never ran for the duplicate
    expect(createMany).not.toHaveBeenCalled();
  });

  it('does not swallow a failure of the environment insert', async () => {
    const failure = new Error('connection lost');
    const { repo } = setup({
      environmentCreateMany: () => Promise.reject(failure),
    });

    // rejecting makes the real $transaction roll back the issue and the event too
    await expect(repo.store(data)).rejects.toBe(failure);
  });
});
