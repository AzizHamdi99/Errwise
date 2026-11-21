import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import type { AuditService } from '../audit/audit.service';
import type { MembershipsService } from '../memberships/memberships.service';
import type { GithubApiClient } from './github-api.client';
import { GithubIntegrationService } from './github-integration.service';
import type { GithubStateService } from './github-state.service';
import type { GithubRepository } from './github.repository';

function setup() {
  const repo = {
    findProject: jest.fn().mockResolvedValue({
      id: 'p1',
      githubInstallationId: '99',
      githubRepo: 'acme/old',
    }),
    saveRepo: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
  const github = {
    listRepositories: jest
      .fn()
      .mockResolvedValue([{ fullName: 'acme/shop', private: true }]),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new GithubIntegrationService(
    { get: () => 'errwise' } as unknown as ConfigService<Env, true>,
    repo as unknown as GithubRepository,
    github as unknown as GithubApiClient,
    {} as GithubStateService,
    {} as MembershipsService,
    audit as unknown as AuditService,
  );
  return { service, repo, audit };
}

describe('GitHub integration audit entries', () => {
  it('records the repository chosen and the previous one', async () => {
    const { service, audit } = setup();

    await service.selectRepository('o1', 'p1', 'ACME/shop', 'owner-1');

    expect(audit.record).toHaveBeenCalledWith({
      organizationId: 'o1',
      actorId: 'owner-1',
      action: 'github.repo_selected',
      targetType: 'project',
      targetId: 'p1',
      projectId: 'p1',
      metadata: { repo: 'acme/shop', previousRepo: 'acme/old' },
    });
  });

  it('records nothing when the repository is not in the installation', async () => {
    const { service, repo, audit } = setup();

    await expect(
      service.selectRepository('o1', 'p1', 'evil/repo', 'owner-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.saveRepo).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('records a disconnect with the repository it was linked to', async () => {
    const { service, audit } = setup();

    await service.disconnect('o1', 'p1', 'owner-1');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'github.disconnected',
        metadata: { repo: 'acme/old' },
      }),
    );
  });
});
