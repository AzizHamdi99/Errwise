import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AiQuotaRepository {
  constructor(private readonly prisma: PrismaService) {}

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
