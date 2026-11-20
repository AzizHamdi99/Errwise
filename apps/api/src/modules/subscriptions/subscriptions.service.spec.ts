import { NotFoundException } from '@nestjs/common';
import type { ProjectSubscription } from '@prisma/client';
import type { ProjectsService } from '../projects/projects.service';
import type { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';

function setup() {
  const repo = {
    find: jest.fn().mockResolvedValue(null),
    listForUserInOrganization: jest.fn().mockResolvedValue([]),
    upsert: jest.fn(),
  };
  const projects = { get: jest.fn().mockResolvedValue({ id: 'p1' }) };
  const service = new SubscriptionsService(
    repo as unknown as SubscriptionsRepository,
    projects as unknown as ProjectsService,
  );
  return { service, repo, projects };
}

const row = (projectId: string, emailNewIssues: boolean) =>
  ({ userId: 'u1', projectId, emailNewIssues }) as ProjectSubscription;

describe('SubscriptionsService.listMine', () => {
  it('asks for this user in this organization only', async () => {
    const { service, repo } = setup();
    await service.listMine('org-1', 'u1');

    expect(repo.listForUserInOrganization).toHaveBeenCalledWith('u1', 'org-1');
  });

  it('returns the public shape, keeping the ones turned off', async () => {
    const { service, repo } = setup();
    repo.listForUserInOrganization.mockResolvedValue([
      row('p1', true),
      row('p2', false),
    ]);

    await expect(service.listMine('org-1', 'u1')).resolves.toEqual([
      { projectId: 'p1', emailNewIssues: true },
      { projectId: 'p2', emailNewIssues: false },
    ]);
  });

  it('is an empty list for someone who subscribed to nothing', async () => {
    const { service } = setup();
    await expect(service.listMine('org-1', 'u1')).resolves.toEqual([]);
  });
});

describe('SubscriptionsService.get and update', () => {
  it('reads no row as "not subscribed"', async () => {
    const { service } = setup();
    await expect(service.get('org-1', 'p1', 'u1')).resolves.toEqual({
      projectId: 'p1',
      emailNewIssues: false,
    });
  });

  it('answers 404 for a project of another organization, for reads and writes', async () => {
    const { service, repo, projects } = setup();
    projects.get.mockRejectedValue(new NotFoundException());

    await expect(service.get('other-org', 'p1', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.update('other-org', 'p1', 'u1', true),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.find).not.toHaveBeenCalled();
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
