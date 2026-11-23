import type { FixWarning, StoredFixEdit } from "@errwise/shared";
import { ApiError, getErrorMessage } from "@/lib/api";

/**
 * Pure logic of the fix feature: what the diff looks like, which links may be followed, which
 * error text may be shown. Nothing here touches React, so it is easy to check on its own.
 */

/** Our own wording for what a patch adds. The model and the code never write these. */
export const FIX_WARNING_LABEL: Record<FixWarning, string> = {
  reads_environment: "Reads environment variables",
  runs_shell_command: "Runs a shell command",
  makes_network_call: "Makes a network call",
  adds_import: "Adds an import or a require",
  evaluates_code: "Evaluates code at run time",
};

// --- links ---------------------------------------------------------------------------------

const GITHUB_PREFIX = "https://github.com/";
const REPO = /^[\w.-]+\/[\w.-]+$/;
const COMMIT = /^[0-9a-f]{7,64}$/;

/** A link that ends up in an href: only ever to GitHub, whatever the API sent. */
export function githubLink(url: string | null | undefined): string | null {
  return url?.startsWith(GITHUB_PREFIX) ? url : null;
}

/** The commit the fix was made for, on GitHub. Null if either part looks odd. */
export function commitLink(repo: string, sha: string): string | null {
  return REPO.test(repo) && COMMIT.test(sha)
    ? `${GITHUB_PREFIX}${repo}/commit/${sha}`
    : null;
}

export const shortSha = (sha: string): string => sha.slice(0, 7);

// --- errors ----------------------------------------------------------------------------------

/**
 * The API's messages for these statuses are written for people ("The AI proposed a change that
 * does not fit the code", "GitHub could not be reached"), but getErrorMessage hides every 5xx.
 */
const FRIENDLY_STATUSES = new Set([429, 502, 503, 504]);

export function fixErrorMessage(error: unknown): string {
  if (error instanceof ApiError && FRIENDLY_STATUSES.has(error.status)) {
    return error.message;
  }
  return getErrorMessage(error);
}

// --- the diff --------------------------------------------------------------------------------

export interface DiffRow {
  kind: "context" | "remove" | "add";
  /** Line number in the file that was deployed. Null for an added line. */
  oldNumber: number | null;
  /** Line number in the changed file. Null for a removed line. */
  newNumber: number | null;
  text: string;
}

export interface FileDiff {
  file: string;
  /** One list of rows per edit, in file order. */
  hunks: DiffRow[][];
  added: number;
  removed: number;
}

function toLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  // A text that ends with a newline has no extra empty line.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function hunkOf(edit: StoredFixEdit, shift: number) {
  // Whole lines, not only the text that matched: the rest of the line is the same on both sides.
  // Older responses (a page loaded before the API was updated) have no prefix or suffix.
  const prefix = edit.prefix ?? "";
  const suffix = edit.suffix ?? "";
  const before = toLines(`${prefix}${edit.search}${suffix}`);
  const after = toLines(`${prefix}${edit.replace}${suffix}`);

  // Lines that did not change at the top and the bottom are context, not part of the change.
  const limit = Math.min(before.length, after.length);
  let head = 0;
  while (head < limit && before[head] === after[head]) head += 1;
  let tail = 0;
  while (
    tail < limit - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail += 1;
  }

  const oldStart = edit.line;
  const newStart = edit.line + shift;
  const rows: DiffRow[] = [];

  for (let i = 0; i < head; i++) {
    rows.push({
      kind: "context",
      oldNumber: oldStart + i,
      newNumber: newStart + i,
      text: before[i],
    });
  }
  const removed = before.slice(head, before.length - tail);
  const added = after.slice(head, after.length - tail);
  removed.forEach((text, i) =>
    rows.push({
      kind: "remove",
      oldNumber: oldStart + head + i,
      newNumber: null,
      text,
    }),
  );
  added.forEach((text, i) =>
    rows.push({
      kind: "add",
      oldNumber: null,
      newNumber: newStart + head + i,
      text,
    }),
  );
  for (let i = 0; i < tail; i++) {
    rows.push({
      kind: "context",
      oldNumber: oldStart + before.length - tail + i,
      newNumber: newStart + after.length - tail + i,
      text: before[before.length - tail + i],
    });
  }

  return {
    rows,
    added: added.length,
    removed: removed.length,
    delta: after.length - before.length,
  };
}

/**
 * The change as a diff per file. The edits of a file are in file order, and the line numbers
 * of the changed side take the lines added or removed by the edits above them into account.
 */
export function buildDiff(edits: readonly StoredFixEdit[]): FileDiff[] {
  const order: string[] = [];
  const byFile = new Map<string, StoredFixEdit[]>();
  for (const edit of edits) {
    const list = byFile.get(edit.file);
    if (list) list.push(edit);
    else {
      order.push(edit.file);
      byFile.set(edit.file, [edit]);
    }
  }

  return order.map((file) => {
    let shift = 0;
    let added = 0;
    let removed = 0;
    const hunks = [...(byFile.get(file) ?? [])]
      .sort((a, b) => a.line - b.line)
      .map((edit) => {
        const hunk = hunkOf(edit, shift);
        shift += hunk.delta;
        added += hunk.added;
        removed += hunk.removed;
        return hunk.rows;
      });
    return { file, hunks, added, removed };
  });
}
