import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';
import { GithubRepository } from './github.repository';

interface WebhookInput {
  rawBody: Buffer | undefined;
  signature: string | undefined;
  event: string | undefined;
  deliveryId: string | undefined;
}

/** Only the fields we use from GitHub's `issues` event. */
const issuesPayloadSchema = z.object({
  action: z.string(),
  issue: z.object({ number: z.number().int() }),
  repository: z.object({ full_name: z.string() }),
  installation: z.object({ id: z.union([z.number(), z.string()]) }),
});

@Injectable()
export class GithubWebhookService {
  private readonly logger = new Logger(GithubWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly repo: GithubRepository,
  ) {}

  async handle(input: WebhookInput) {
    const { rawBody, signature, event, deliveryId } = input;
    if (!rawBody || !signature || !event || !deliveryId) {
      throw new UnauthorizedException();
    }
    this.verifySignature(rawBody, signature);

    // GitHub retries failed deliveries: process each delivery once.
    const isNew = await this.markDelivery(deliveryId, event);
    if (!isNew) return { ok: true, duplicate: true };

    if (event === 'ping') return { ok: true, pong: true };

    try {
      if (event === 'issues') await this.handleIssuesEvent(rawBody);
    } catch (error) {
      // Let GitHub's retry be processed instead of being flagged as a duplicate.
      await this.prisma.githubWebhookDelivery
        .delete({ where: { id: deliveryId } })
        .catch(() => undefined);
      throw error;
    }
    return { ok: true };
  }

  private async handleIssuesEvent(rawBody: Buffer): Promise<void> {
    const parsed = issuesPayloadSchema.safeParse(
      JSON.parse(rawBody.toString('utf8')),
    );
    if (!parsed.success) {
      this.logger.warn('Ignoring issues event with an unexpected payload');
      return;
    }
    const { action, issue, repository, installation } = parsed.data;
    if (action !== 'closed' && action !== 'reopened') return;

    await this.repo.applyGithubIssueState(
      {
        repo: repository.full_name,
        installationId: String(installation.id),
        number: issue.number,
      },
      action === 'closed' ? 'closed' : 'open',
    );
    this.logger.log(
      `GitHub issue ${repository.full_name}#${issue.number} ${action}`,
    );
  }

  private verifySignature(rawBody: Buffer, signature: string): void {
    const secret = this.config.get('GITHUB_WEBHOOK_SECRET', { infer: true });
    const expected =
      'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid signature');
    }
  }

  /** Returns false when this delivery was already recorded. */
  private async markDelivery(id: string, event: string): Promise<boolean> {
    try {
      await this.prisma.githubWebhookDelivery.create({ data: { id, event } });
      return true;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return false;
      throw e;
    }
  }
}
