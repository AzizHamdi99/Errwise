import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { AiQuotaRepository } from './ai-quota.repository';

/** One call taken from an organization's allowance of one UTC day. */
export interface AiQuotaSlot {
  organizationId: string;
  day: Date;
}

/** The allowance resets at midnight UTC. */
function utcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * The daily AI allowance of an organization (ADR-004), shared by every feature that calls
 * apps/ai: an analysis and a fix suggestion each take one slot from the same count.
 */
@Injectable()
export class AiQuotaService {
  private readonly logger = new Logger(AiQuotaService.name);
  private readonly dailyLimit: number;

  constructor(
    config: ConfigService<Env, true>,
    private readonly repo: AiQuotaRepository,
  ) {
    this.dailyLimit = config.get('AI_DAILY_LIMIT_PER_ORG', { infer: true });
  }

  /** The slot, or null when today's allowance is used up. */
  async reserve(organizationId: string): Promise<AiQuotaSlot | null> {
    const day = utcDay(new Date());
    const reserved = await this.repo.reserve(
      organizationId,
      day,
      this.dailyLimit,
    );
    return reserved ? { organizationId, day } : null;
  }

  /** Never throws: it runs while a real error is being reported, and must not hide it. */
  async giveBack(slot: AiQuotaSlot): Promise<void> {
    try {
      await this.repo.release(slot.organizationId, slot.day);
    } catch {
      this.logger.warn('Could not give back an AI slot');
    }
  }
}
