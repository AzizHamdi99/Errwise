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
