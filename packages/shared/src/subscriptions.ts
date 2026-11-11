import { z } from "zod";

export const updateSubscriptionSchema = z.object({
  emailNewIssues: z.boolean(),
});

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export interface PublicSubscription {
  projectId: string;
  emailNewIssues: boolean;
}
