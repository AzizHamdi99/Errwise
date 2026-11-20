import { Injectable } from '@nestjs/common';
import type { ProjectSubscription } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(userId: string, projectId: string): Promise<ProjectSubscription | null> {
    return this.prisma.projectSubscription.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
  }

  /**
   * One user's subscriptions in one organization. Filtered through the project
   * relation, so projects of other organizations and deleted projects never appear.
   */
  listForUserInOrganization(
    userId: string,
    organizationId: string,
  ): Promise<ProjectSubscription[]> {
    return this.prisma.projectSubscription.findMany({
      where: { userId, project: { organizationId, deletedAt: null } },
    });
  }

  upsert(
    userId: string,
    projectId: string,
    emailNewIssues: boolean,
  ): Promise<ProjectSubscription> {
    return this.prisma.projectSubscription.upsert({
      where: { userId_projectId: { userId, projectId } },
      create: { userId, projectId, emailNewIssues },
      update: { emailNewIssues },
    });
  }
}
