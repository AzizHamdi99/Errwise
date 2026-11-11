import { z } from "zod";
import { envelopeSchema } from "./envelope";

export const ISSUE_CREATED = "issue.created";

// IDs only: the consumer reads the rest from the database.
export const issueCreatedSchema = envelopeSchema(
  ISSUE_CREATED,
  z.object({
    projectId: z.uuid(),
    issueId: z.uuid(),
    environment: z.string().trim().min(1).max(64),
  }),
);

export type IssueCreatedMessage = z.infer<typeof issueCreatedSchema>;
