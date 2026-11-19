import type { Event, Issue } from '@prisma/client';
import { analyzeRequestSchema } from '@errwise/shared';
import type { AnalyzeRequest } from '@errwise/shared';
import { sha256 } from '../../common/utils/hash';
import { scrubEvent } from '../../common/utils/scrub';

/**
 * Part of the cache key. Bump it whenever the prompt of apps/ai changes
 * (its PROMPT_VERSION), so old analyses are not served for the new prompt.
 */
export const ANALYSIS_CACHE_VERSION = 2;

function runtimeOf(context: unknown): string | undefined {
  if (typeof context !== 'object' || context === null) return undefined;
  const version = (context as Record<string, unknown>).nodeVersion;
  return typeof version === 'string' && version
    ? `node ${version.replace(/^v/, '')}`.slice(0, 64)
    : undefined;
}

/**
 * What leaves for the AI service: text fields only, never the free-form context.
 * It is scrubbed again here, because events stored before scrubbing existed are
 * not clean.
 */
export function buildAnalysisInput(
  issue: Pick<Issue, 'type'>,
  event: Event,
): AnalyzeRequest {
  const { event: clean } = scrubEvent({
    type: event.type ?? issue.type ?? 'Error',
    message: event.message,
    stack: event.stack ?? undefined,
  });

  // Truncate after scrubbing: a placeholder like [email] can be longer than the original.
  return analyzeRequestSchema.parse({
    type: (clean.type ?? 'Error').slice(0, 200),
    message: clean.message.slice(0, 5_000),
    stack: clean.stack?.slice(0, 50_000) || undefined,
    environment: event.environment,
    release: event.release ?? undefined,
    runtime: runtimeOf(event.context),
  });
}

/** Same input, same hash: that is what makes a second request free. */
export function hashAnalysisInput(input: AnalyzeRequest): string {
  return sha256(
    JSON.stringify([
      ANALYSIS_CACHE_VERSION,
      input.type,
      input.message,
      input.stack ?? null,
      input.environment,
      input.release ?? null,
      input.runtime ?? null,
    ]),
  );
}
