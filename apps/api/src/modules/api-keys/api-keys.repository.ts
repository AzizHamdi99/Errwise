import { Injectable } from '@nestjs/common';
import type { ApiKey, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const authInclude = {
  project: { include: { organization: true } },
} satisfies Prisma.ApiKeyInclude;

export type ApiKeyWithProject = Prisma.ApiKeyGetPayload<{
  include: typeof authInclude;
}>;

export interface CreateApiKeyData {
  projectId: string;
  name: string;
  prefix: string;
  keyHash: string;
}

@Injectable()
export class ApiKeysRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateApiKeyData): Promise<ApiKey> {
    return this.prisma.apiKey.create({ data });
  }

  countActive(projectId: string): Promise<number> {
    return this.prisma.apiKey.count({
      where: { projectId, revokedAt: null },
    });
  }

  listByProject(projectId: string): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findInProject(projectId: string, id: string): Promise<ApiKey | null> {
    return this.prisma.apiKey.findFirst({ where: { id, projectId } });
  }

  /** Returns false if it was already revoked. */
  async revoke(id: string): Promise<boolean> {
    const { count } = await this.prisma.apiKey.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count > 0;
  }

  // ---- used by ingestion ----

  findByHashWithProject(keyHash: string): Promise<ApiKeyWithProject | null> {
    return this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: authInclude,
    });
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }
}
