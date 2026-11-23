import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import type { AiQuotaRepository } from './ai-quota.repository';
import { AiQuotaService } from './ai-quota.service';

function setup(limit = 20) {
  const repo = {
    reserve: jest.fn().mockResolvedValue(true),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AiQuotaService(
    { get: () => limit } as unknown as ConfigService<Env, true>,
    repo as unknown as AiQuotaRepository,
  );
  return { service, repo };
}

afterEach(() => jest.useRealTimers());

describe('AiQuotaService', () => {
  it('reserves against the configured limit, for the current UTC day', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-05T23:59:59Z'));
    const { service, repo } = setup(3);

    const slot = await service.reserve('org1');

    expect(repo.reserve).toHaveBeenCalledWith(
      'org1',
      new Date('2026-03-05T00:00:00Z'),
      3,
    );
    expect(slot).toEqual({
      organizationId: 'org1',
      day: new Date('2026-03-05T00:00:00Z'),
    });
  });

  it('returns null when the allowance is used up', async () => {
    const { service, repo } = setup();
    repo.reserve.mockResolvedValue(false);

    await expect(service.reserve('org1')).resolves.toBeNull();
  });

  it('gives a slot back on the day it was taken, even after midnight', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-05T23:59:59Z'));
    const { service, repo } = setup();
    const slot = await service.reserve('org1');

    jest.setSystemTime(new Date('2026-03-06T00:00:01Z'));
    await service.giveBack(slot!);

    expect(repo.release).toHaveBeenCalledWith(
      'org1',
      new Date('2026-03-05T00:00:00Z'),
    );
  });

  it('never throws when giving a slot back', async () => {
    const { service, repo } = setup();
    repo.release.mockRejectedValue(new Error('db down'));

    await expect(
      service.giveBack({ organizationId: 'org1', day: new Date() }),
    ).resolves.toBeUndefined();
  });
});
