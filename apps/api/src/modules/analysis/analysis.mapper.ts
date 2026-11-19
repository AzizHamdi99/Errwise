import type { IssueAnalysis } from '@prisma/client';
import { analysisResultSchema } from '@errwise/shared';
import type { PublicIssueAnalysis } from '@errwise/shared';

/** The stored JSON is validated again on the way out, so a bad row can never reach the UI. */
export function toPublicAnalysis(
  row: IssueAnalysis,
  cached: boolean,
): PublicIssueAnalysis {
  return {
    ...analysisResultSchema.parse(row.result),
    createdAt: row.createdAt.toISOString(),
    cached,
  };
}
