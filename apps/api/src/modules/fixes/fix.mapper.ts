import type { IssueFix } from '@prisma/client';
import { z } from 'zod';
import { storedFixEditSchema, storedFixResultSchema } from '@errwise/shared';
import type { FixSuggestion, PublicIssueFix } from '@errwise/shared';

const editsSchema = z.array(storedFixEditSchema);

/**
 * The stored JSON is validated again: a row that no longer fits (or that was wiped) has no
 * suggestion, it never fails the request. The pull request link does not depend on it.
 */
export function toPublicFix(row: IssueFix, cached: boolean): PublicIssueFix {
  const result = storedFixResultSchema.safeParse(row.result);
  const edits = editsSchema.safeParse(row.edits);

  let suggestion: FixSuggestion | null = null;
  if (result.success && edits.success) {
    const r = result.data;
    suggestion = {
      fixable: r.fixable,
      prTitle: r.prTitle,
      explanation: r.explanation,
      confidence: r.confidence,
      reason: r.reason,
      files: r.files,
      warnings: r.warnings,
      model: r.model,
      edits: edits.data,
    };
  }

  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    cached,
    repo: row.repo,
    commitSha: row.commitSha,
    pullRequest:
      row.prNumber !== null && row.prUrl
        ? { number: row.prNumber, url: row.prUrl }
        : null,
    suggestion,
  };
}
