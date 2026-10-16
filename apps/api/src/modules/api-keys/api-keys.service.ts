import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateApiKeyInput,
  CreatedApiKey,
  PublicApiKey,
} from '@errwise/shared';
import { ProjectsService } from '../projects/projects.service';
import { generateApiKey } from './api-key.util';
import { toCreatedApiKey, toPublicApiKey } from './api-keys.mapper';
import { ApiKeysRepository } from './api-keys.repository';

const MAX_ACTIVE_KEYS_PER_PROJECT = 10;

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly repo: ApiKeysRepository,
    private readonly projects: ProjectsService,
  ) {}

  async create(
    organizationId: string,
    projectId: string,
    input: CreateApiKeyInput,
  ): Promise<CreatedApiKey> {
    await this.projects.get(organizationId, projectId); // 404 if not in this organization

    if (
      (await this.repo.countActive(projectId)) >= MAX_ACTIVE_KEYS_PER_PROJECT
    ) {
      throw new BadRequestException(
        `A project can have at most ${MAX_ACTIVE_KEYS_PER_PROJECT} active keys`,
      );
    }

    const { key, prefix, keyHash } = generateApiKey();
    const record = await this.repo.create({
      projectId,
      name: input.name,
      prefix,
      keyHash,
    });
    return toCreatedApiKey(record, key);
  }

  async list(
    organizationId: string,
    projectId: string,
  ): Promise<PublicApiKey[]> {
    await this.projects.get(organizationId, projectId);
    const keys = await this.repo.listByProject(projectId);
    return keys.map(toPublicApiKey);
  }

  async revoke(
    organizationId: string,
    projectId: string,
    keyId: string,
  ): Promise<void> {
    await this.projects.get(organizationId, projectId);
    const key = await this.repo.findInProject(projectId, keyId);
    if (!key) throw new NotFoundException('API key not found');
    // Revoking twice is fine: the key stays revoked.
    await this.repo.revoke(key.id);
  }
}
