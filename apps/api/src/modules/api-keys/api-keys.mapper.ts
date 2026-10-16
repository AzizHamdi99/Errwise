import type { ApiKey } from '@prisma/client';
import type { CreatedApiKey, PublicApiKey } from '@errwise/shared';

export function toPublicApiKey(key: ApiKey): PublicApiKey {
  return {
    id: key.id,
    projectId: key.projectId,
    name: key.name,
    prefix: key.prefix,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
  };
}

export function toCreatedApiKey(key: ApiKey, rawKey: string): CreatedApiKey {
  return { ...toPublicApiKey(key), key: rawKey };
}
