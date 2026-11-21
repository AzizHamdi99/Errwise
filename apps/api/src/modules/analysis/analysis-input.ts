import type { Event, Issue } from '@prisma/client';
import { MAX_ANALYSIS_SNIPPETS, analyzeRequestSchema } from '@errwise/shared';
import type {
  AnalyzeRequest,
  SourceContextResult,
  SourceSnippet,
} from '@errwise/shared';
import { sha256 } from '../../common/utils/hash';
import { scrubEvent, scrubText } from '../../common/utils/scrub';

/**
 * Part of the cache key. Bump it whenever the prompt of apps/ai changes
 * (its PROMPT_VERSION), so old analyses are not served for the new prompt.
 */
export const ANALYSIS_CACHE_VERSION = 4;

const MAX_SNIPPET_CODE = 2_000;
const MAX_SNIPPET_LINE = 150;

function runtimeOf(context: unknown): string | undefined {
  if (typeof context !== 'object' || context === null) return undefined;
  const version = (context as Record<string, unknown>).nodeVersion;
  return typeof version === 'string' && version
    ? `node ${version.replace(/^v/, '')}`.slice(0, 64)
    : undefined;
}

/**
 * The code the analysis may see: the frames that have code, at most five, scrubbed like
 * every other text that leaves. Each line carries its number and the failing one is
 * marked, so the model can cite exact lines.
 */
export function buildSourceSnippets(
  source: SourceContextResult | null,
): SourceSnippet[] {
  if (source?.status !== 'ok') return [];

  const snippets: SourceSnippet[] = [];
  for (const frame of source.frames) {
    if (frame.status !== 'found') continue;
    const last = frame.startLine + frame.lines.length - 1;
    const width = String(last).length;
    const code = frame.lines
      .map((text, i) => {
        const number = frame.startLine + i;
        const mark = number === frame.line ? '>' : ' ';
        return `${mark} ${String(number).padStart(width)} | ${text.slice(0, MAX_SNIPPET_LINE)}`;
      })
      .join('\n');

    snippets.push({
      file: scrubText(frame.repoPath).slice(0, 500),
      line: frame.line,
      // Truncate after scrubbing: a placeholder can be longer than the text it replaces.
      code: scrubText(code).slice(0, MAX_SNIPPET_CODE),
    });
    if (snippets.length === MAX_ANALYSIS_SNIPPETS) break;
  }
  return snippets;
}

/**
 * What leaves for the AI service: text fields only, never the free-form context.
 * It is scrubbed again here, because events stored before scrubbing existed are
 * not clean.
 */
export function buildAnalysisInput(
  issue: Pick<Issue, 'type'>,
  event: Event,
  snippets: SourceSnippet[] = [],
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
    sourceContext: snippets.length > 0 ? snippets : undefined,
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
      input.sourceContext?.map((s) => [s.file, s.line, s.code]) ?? null,
    ]),
  );
}
