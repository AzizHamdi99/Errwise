import { Logger } from '@nestjs/common';
import type { AuditRepository, AuditRowWithActor } from './audit.repository';
import { AuditService } from './audit.service';

const ORG = '0190f0a0-0000-7000-8000-000000000001';

function row(id: string, overrides: Partial<AuditRowWithActor> = {}) {
  return {
    id,
    organizationId: ORG,
    projectId: null,
    action: 'api_key.created',
    targetType: 'api_key',
    targetId: 'k1',
    metadata: { name: 'CI key' },
    createdAt: new Date('2026-11-21T12:00:00.000Z'),
    actor: { id: 'u1', name: 'Ada', email: 'ada@example.com' },
    ...overrides,
  } satisfies AuditRowWithActor;
}

function setup() {
  const repo = {
    create: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
  };
  const service = new AuditService(repo as unknown as AuditRepository);
  return { service, repo };
}

afterEach(() => jest.restoreAllMocks());

describe('AuditService.record', () => {
  it('writes the entry with defaults for the optional parts', async () => {
    const { service, repo } = setup();

    await service.record({
      organizationId: ORG,
      actorId: 'u1',
      action: 'organization.renamed',
      targetType: 'organization',
    });

    expect(repo.create).toHaveBeenCalledWith({
      organizationId: ORG,
      actorId: 'u1',
      action: 'organization.renamed',
      targetType: 'organization',
      targetId: null,
      projectId: null,
      metadata: {},
    });
  });

  it('never throws: a failed write must not fail the action the user completed', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { service, repo } = setup();
    repo.create.mockRejectedValue(new Error('db down'));

    await expect(
      service.record({
        organizationId: ORG,
        actorId: 'u1',
        action: 'api_key.revoked',
        targetType: 'api_key',
        metadata: { name: 'secret-looking name' },
      }),
    ).resolves.toBeUndefined();

    // The action name only: never the metadata.
    expect(error).toHaveBeenCalledWith(
      'Could not write audit entry api_key.revoked',
    );
  });

  it('caps the size of the metadata', async () => {
    const { service, repo } = setup();
    const many = Object.fromEntries(
      Array.from({ length: 15 }, (_, i) => [`k${i}`, i]),
    );

    await service.record({
      organizationId: ORG,
      actorId: 'u1',
      action: 'project.updated',
      targetType: 'project',
      metadata: { ...many, name: 'x'.repeat(500) },
    });

    const { metadata } = (
      repo.create.mock.calls[0] as [{ metadata: Record<string, unknown> }]
    )[0];
    expect(Object.keys(metadata)).toHaveLength(10);
    for (const value of Object.values(metadata)) {
      if (typeof value === 'string')
        expect(value.length).toBeLessThanOrEqual(200);
    }
  });
});

describe('AuditService.list', () => {
  it('reads one extra row to know there is a next page, and points the cursor at the last shown', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValue([row('c'), row('b'), row('a')]);

    const page = await service.list(ORG, { limit: 2 });

    expect(repo.list).toHaveBeenCalledWith(ORG, {
      cursor: undefined,
      action: undefined,
      take: 3,
    });
    expect(page.items.map((e) => e.id)).toEqual(['c', 'b']);
    expect(page.nextCursor).toBe('b');
  });

  it('has no next cursor on the last page', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValue([row('b'), row('a')]);

    const page = await service.list(ORG, { limit: 2, cursor: 'x' });

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it('passes the action filter and the cursor through', async () => {
    const { service, repo } = setup();

    await service.list(ORG, {
      limit: 50,
      cursor: 'abc',
      action: 'member.removed',
    });

    expect(repo.list).toHaveBeenCalledWith(ORG, {
      cursor: 'abc',
      action: 'member.removed',
      take: 51,
    });
  });

  it('shows a deleted actor as null and keeps only flat metadata', async () => {
    const { service, repo } = setup();
    repo.list.mockResolvedValue([
      row('a', {
        actor: null,
        metadata: { name: 'Shop', nested: { secret: 1 }, list: [1], ok: true },
      }),
    ]);

    const [entry] = (await service.list(ORG, { limit: 10 })).items;

    expect(entry.actor).toBeNull();
    expect(entry.metadata).toEqual({ name: 'Shop', ok: true });
    expect(entry.createdAt).toBe('2026-11-21T12:00:00.000Z');
  });
});
