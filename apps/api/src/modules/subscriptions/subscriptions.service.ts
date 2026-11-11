import { Injectable } from '@nestjs/common';
import type { PublicSubscription } from '@errwise/shared';
import { ProjectsService } from '../projects/projects.service';
import { SubscriptionsRepository } from './subscriptions.repository';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly repo: SubscriptionsRepository,
    private readonly projects: ProjectsService,
  ) {}

  async get(
    organizationId: string,
    projectId: string,
    userId: string,
  ): Promise<PublicSubscription> {
    await this.projects.get(organizationId, projectId); // 404 if not in this organization
    const sub = await this.repo.find(userId, projectId);
    return { projectId, emailNewIssues: sub?.emailNewIssues ?? false }; // no row = not subscribed
  }

  async update(
    organizationId: string,
    projectId: string,
    userId: string,
    emailNewIssues: boolean,
  ): Promise<PublicSubscription> {
    await this.projects.get(organizationId, projectId);
    const sub = await this.repo.upsert(userId, projectId, emailNewIssues);
    return { projectId, emailNewIssues: sub.emailNewIssues };
  }
}
