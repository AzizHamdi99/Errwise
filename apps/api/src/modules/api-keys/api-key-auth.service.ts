import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { API_KEY_PATTERN, hashApiKey } from './api-key.util';
import type { ApiKeyContext } from './api-key.types';
import { ApiKeysRepository } from './api-keys.repository';

/** Write lastUsedAt at most once a minute per key, to avoid a write on every event. */
const LAST_USED_THROTTLE_MS = 60_000;

@Injectable()
export class ApiKeyAuthService {
  private readonly logger = new Logger(ApiKeyAuthService.name);

  constructor(private readonly repo: ApiKeysRepository) {}

  /**
   * Validates a raw key. Every failure gives the same 401, so a caller
   * can't tell a wrong key from a revoked one.
   */
  async authenticate(rawKey: string | undefined): Promise<ApiKeyContext> {
    if (!rawKey || !API_KEY_PATTERN.test(rawKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const record = await this.repo.findByHashWithProject(hashApiKey(rawKey));
    if (
      !record ||
      record.revokedAt !== null ||
      record.project.deletedAt !== null ||
      record.project.organization.deletedAt !== null
    ) {
      throw new UnauthorizedException('Invalid API key');
    }

    const stale =
      !record.lastUsedAt ||
      Date.now() - record.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS;
    if (stale) {
      // Never slow down or fail an event because of this bookkeeping write.
      this.repo.touchLastUsed(record.id).catch((e: Error) => {
        this.logger.warn(`Could not update lastUsedAt: ${e.message}`);
      });
    }

    return {
      apiKeyId: record.id,
      projectId: record.projectId,
      organizationId: record.project.organizationId,
    };
  }
}
