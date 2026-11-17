import { z } from "zod";
import { envelopeSchema } from "./envelope";

export const ISSUE_REGRESSED = "issue.regressed";

// IDs only: the consumer reads the rest from the database.
export const issueRegressedSchema = envelopeSchema(
  ISSUE_REGRESSED,
  z.object({
    projectId: z.uuid(),
    issueId: z.uuid(),
    environment: z.string().trim().min(1).max(64),
  }),
);

export type IssueRegressedMessage = z.infer<typeof issueRegressedSchema>;
