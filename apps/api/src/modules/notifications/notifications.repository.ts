import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findIssueContext(issueId: string) {
    return this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { project: { include: { organization: true } } },
    });
  }

  /** Subscribed members who are still members of the organization. */
  async findRecipients(
    projectId: string,
    organizationId: string,
  ): Promise<{ email: string }[]> {
    const subscriptions = await this.prisma.projectSubscription.findMany({
      where: {
        projectId,
        emailNewIssues: true,
        user: { memberships: { some: { organizationId } } },
      },
      select: { user: { select: { email: true } } },
    });
    return subscriptions.map((subscription) => subscription.user);
  }

  async markNotified(issueId: string): Promise<void> {
    await this.prisma.issue.update({
      where: { id: issueId },
      data: { lastNotifiedAt: new Date() },
    });
  }
}
