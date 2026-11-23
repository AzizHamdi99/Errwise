import type { Event, Issue } from '@prisma/client';
import {
  MAX_FIX_FILES,
  MAX_FIX_TOTAL_CODE,
  MAX_FIX_WINDOW_CODE,
  fixRequestSchema,
} from '@errwise/shared';
import type { FixRequest } from '@errwise/shared';
import { sha256 } from '../../common/utils/hash';
import { scrubEvent } from '../../common/utils/scrub';
import { runtimeOf } from '../analysis/analysis-input';
import { isEditablePath, normalizeText } from './fix-patch';
import type { FileUnderFix } from './fix-patch';
import { cutWindow } from './fix-window';

/**
 * Part of the cache key. Bump it whenever the fix prompt of apps/ai changes (its
 * FIX_PROMPT_VERSION), so old fixes are not served for the new prompt.
 */
export const FIX_CACHE_VERSION = 1;

// What the prompt of apps/ai keeps anyway: sending more only costs tokens.
const MAX_FIX_MESSAGE = 1_000;
const MAX_FIX_STACK = 3_000;
// Below this a window is too small to be worth a call.
const MIN_WINDOW_BUDGET = 200;

/** A file as read at the deployed commit, with the line of its top failing frame. */
export interface FixCandidate {
  path: string;
  text: string;
  line: number;
}

export interface PreparedFix {
  /** What goes to the AI service. Scrubbed. */
  request: FixRequest;
  /** What the answer is checked against: the real text, and the lines the model was shown. */
  files: Map<string, FileUnderFix>;
  /** The lines as they are in the file, to see whether the default branch still has them. */
  windows: { path: string; raw: string; startLine: number }[];
}

/**
 * The scrubbed request for a fix, and what its answer will be checked against. Files that
 * cannot be edited safely are left out before the model ever sees them: tests, configuration,
 * workflows, broken UTF-8, mixed line endings. Null when nothing is left.
 */
export function buildFixInput(
  issue: Pick<Issue, 'type'>,
  event: Event,
  candidates: readonly FixCandidate[],
): PreparedFix | null {
  const files = new Map<string, FileUnderFix>();
  const windows: PreparedFix['windows'] = [];
  const shown: FixRequest['files'] = [];
  let used = 0;

  for (const candidate of candidates) {
    if (shown.length === MAX_FIX_FILES) break;
    if (!isEditablePath(candidate.path)) continue;
    const normalized = normalizeText(candidate.text);
    if (!normalized.ok) continue;

    const budget = Math.min(MAX_FIX_WINDOW_CODE, MAX_FIX_TOTAL_CODE - used);
    if (budget < MIN_WINDOW_BUDGET) break;
    const window = cutWindow(normalized.value.text, candidate.line, budget);
    if (!window) continue;

    used += window.code.length;
    shown.push({
      file: candidate.path,
      startLine: window.startLine,
      failingLine: window.failingLine,
      code: window.code,
    });
    files.set(candidate.path, {
      text: normalized.value.text,
      window: { startLine: window.startLine, endLine: window.endLine },
    });
    windows.push({
      path: candidate.path,
      raw: window.raw,
      startLine: window.startLine,
    });
  }
  if (shown.length === 0) return null;

  const { event: clean } = scrubEvent({
    type: event.type ?? issue.type ?? 'Error',
    message: event.message,
    stack: event.stack ?? undefined,
  });

  // Truncate after scrubbing: a placeholder like [email] can be longer than the original.
  const request = fixRequestSchema.parse({
    type: (clean.type ?? 'Error').slice(0, 200),
    message: clean.message.slice(0, MAX_FIX_MESSAGE),
    stack: clean.stack?.slice(0, MAX_FIX_STACK) || undefined,
    environment: event.environment,
    release: event.release ?? undefined,
    runtime: runtimeOf(event.context),
    files: shown,
  });
  return { request, files, windows };
}

/** Same input, same hash: that is what makes a second request free. */
export function hashFixInput(request: FixRequest, repo: string): string {
  return sha256(
    JSON.stringify([
      FIX_CACHE_VERSION,
      repo.toLowerCase(),
      request.type,
      request.message,
      request.stack ?? null,
      request.environment,
      request.release ?? null,
      request.runtime ?? null,
      request.files.map((f) => [f.file, f.startLine, f.failingLine, f.code]),
    ]),
  );
}
