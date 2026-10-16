import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(60).default("Default"),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export interface PublicApiKey {
  id: string;
  projectId: string;
  name: string;
  /** First 12 characters, for recognizing a key. Never enough to use it. */
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** Only returned by the create endpoint, once. */
export interface CreatedApiKey extends PublicApiKey {
  key: string;
}
