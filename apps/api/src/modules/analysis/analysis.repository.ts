import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Event, Issue, IssueAnalysis } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface SaveAnalysisData {
  issueId: string;
  inputHash: string;
  promptVersion: string;
  model: string;
  result: Prisma.InputJsonObject;
}

@Injectable()
export class AnalysisRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Scoped by project, so an issue from another tenant returns null. */
  findIssue(projectId: string, issueId: string): Promise<Issue | null> {
    return this.prisma.issue.findFirst({ where: { id: issueId, projectId } });
  }

  latestEvent(issueId: string): Promise<Event | null> {
    return this.prisma.event.findFirst({
      where: { issueId },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    });
  }

  findAnalysis(
    issueId: string,
    inputHash: string,
  ): Promise<IssueAnalysis | null> {
    return this.prisma.issueAnalysis.findUnique({
      where: { issueId_inputHash: { issueId, inputHash } },
    });
  }

  latestAnalysis(issueId: string): Promise<IssueAnalysis | null> {
    return this.prisma.issueAnalysis.findFirst({
      where: { issueId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  /** Two requests can finish together: the second one gets the first one's row. */
  async saveAnalysis(data: SaveAnalysisData): Promise<IssueAnalysis> {
    try {
      return await this.prisma.issueAnalysis.create({ data });
    } catch (e) {
      const duplicate =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
      const existing = duplicate
        ? await this.findAnalysis(data.issueId, data.inputHash)
        : null;
      if (!existing) throw e;
      return existing;
    }
  }

  /**
   * Takes one call from the organization's daily allowance. The limit is in the
   * `where` of a single UPDATE, so parallel requests cannot go past it:
   * count === 1 means "this request got the last slot".
   */
  async reserve(
    organizationId: string,
    day: Date,
    limit: number,
  ): Promise<boolean> {
    await this.prisma.aiUsage.createMany({
      data: [{ organizationId, day }],
      skipDuplicates: true,
    });
    const { count } = await this.prisma.aiUsage.updateMany({
      where: { organizationId, day, requests: { lt: limit } },
      data: { requests: { increment: 1 } },
    });
    return count === 1;
  }

  /** Gives the slot back when the AI call failed, so a failure does not cost quota. */
  async release(organizationId: string, day: Date): Promise<void> {
    await this.prisma.aiUsage.updateMany({
      where: { organizationId, day, requests: { gt: 0 } },
      data: { requests: { decrement: 1 } },
    });
  }
}
