import { z } from "zod";

export const PROJECT_PLATFORMS = ["node", "express", "nestjs"] as const;
export type ProjectPlatform = (typeof PROJECT_PLATFORMS)[number];

const name = z.string().trim().min(2).max(80);
const platform = z.enum(PROJECT_PLATFORMS);
/** Capped at 90 days because free databases have small storage. */
const retentionDays = z.number().int().min(1).max(90);

export const createProjectSchema = z.object({
  name,
  platform: platform.default("node"),
  retentionDays: retentionDays.default(30),
});

export const updateProjectSchema = z
  .object({
    name: name.optional(),
    platform: platform.optional(),
    retentionDays: retentionDays.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update",
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export interface PublicProject {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  platform: string;
  retentionDays: number;
  createdAt: string;
}
