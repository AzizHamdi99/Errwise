import { z } from "zod";
import { ANALYSIS_CONFIDENCES } from "./analysis";

/**
 * AI fix suggestions (ADR-009). The contract between the API and the AI service
 * (apps/ai, FixRequest and FixResponse). It lives twice and must change together with
 * apps/ai/app/schemas/fix.py, which also forbids unknown fields.
 *
 * The model answers with search/replace edits, not a diff: models get diff line numbers
 * wrong. The API checks every edit against the real file before it stores anything.
 */

export const MAX_FIX_FILES = 3;
export const MAX_FIX_EDITS = 5;
/** One window of code. */
export const MAX_FIX_WINDOW_CODE = 4_000;
/**
 * All windows together. The free provider plan allows 8,000 tokens a minute for the prompt
 * and the answer together, so this is what fits next to the report and the answer.
 */
export const MAX_FIX_TOTAL_CODE = 10_000;
/** Code only. Never dotfiles, configuration, lock files or workflows. */
export const FIX_FILE_EXTENSIONS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "mts",
  "cts",
] as const;

/**
 * The raw lines around one failing frame, from the repository at the deployed commit, with
 * secrets removed. No line numbers inside `code`: the model copies text from it, and a
 * prefix would never match the file. The numbers are given beside it.
 */
export const fixWindowSchema = z
  .object({
    file: z.string().min(1).max(500),
    /** Number of the first line of `code`, 1-based. */
    startLine: z.number().int().min(1),
    failingLine: z.number().int().min(1),
    code: z.string().min(1).max(MAX_FIX_WINDOW_CODE),
  })
  .refine((w) => w.failingLine >= w.startLine, {
    message: "failingLine is before startLine",
  });

/** What the API sends. Text fields are scrubbed first and use the limits of eventSchema. */
export const fixRequestSchema = z
  .object({
    type: z.string().min(1).max(200),
    message: z.string().min(1).max(5_000),
    stack: z.string().max(50_000).optional(),
    environment: z.string().min(1).max(64),
    release: z.string().min(1).max(128).optional(),
    runtime: z.string().min(1).max(64).optional(),
    files: z.array(fixWindowSchema).min(1).max(MAX_FIX_FILES),
  })
  .refine(
    (r) => r.files.reduce((sum, f) => sum + f.code.length, 0) <= MAX_FIX_TOTAL_CODE,
    { message: "Too much code for one request" },
  )
  .refine((r) => new Set(r.files.map((f) => f.file)).size === r.files.length, {
    message: "One window per file",
  });

/** Replace the one occurrence of `search` in `file` with `replace`. */
export const fixEditSchema = z.object({
  file: z.string().min(1).max(500),
  search: z.string().min(1).max(2_000),
  /** May be empty: removing a line is an edit. */
  replace: z.string().max(2_000),
});

const fixAnswerShape = {
  /** False when the code shown does not allow a safe, local fix. */
  fixable: z.boolean(),
  /** Plain text. Empty when not fixable. */
  prTitle: z.string().max(120),
  /** What was wrong and what the change does. Plain text. Empty when not fixable. */
  explanation: z.string().max(1_500),
  confidence: z.enum(ANALYSIS_CONFIDENCES),
  edits: z.array(fixEditSchema).max(MAX_FIX_EDITS),
  /** Why there is no fix. Empty when fixable. */
  reason: z.string().max(500),
};

type FixAnswerRule = {
  fixable: boolean;
  prTitle: string;
  explanation: string;
  edits: unknown[];
  reason: string;
};

/** A fixable answer is complete, and a refusal carries a reason and no edits. */
function isConsistent(a: FixAnswerRule): boolean {
  return a.fixable
    ? a.prTitle.trim() !== "" && a.explanation.trim() !== "" && a.edits.length > 0
    : a.edits.length === 0 && a.reason.trim() !== "";
}

const consistency = {
  message: "Answer does not match its fixable flag",
};

/** What the AI service answers (apps/ai, FixResponse). */
export const fixResultSchema = z
  .object({
    ...fixAnswerShape,
    promptVersion: z.string().min(1).max(32),
    model: z.string().min(1).max(100),
  })
  .refine(isConsistent, consistency);

export type FixWindow = z.infer<typeof fixWindowSchema>;
export type FixRequest = z.infer<typeof fixRequestSchema>;
export type FixEdit = z.infer<typeof fixEditSchema>;
export type FixResult = z.infer<typeof fixResultSchema>;

/**
 * Things in a patch worth a second look. A fixed list, so the dashboard shows its own wording and
 * never text the model or the code produced.
 */
export const FIX_WARNINGS = [
  "reads_environment",
  "runs_shell_command",
  "makes_network_call",
  "adds_import",
  "evaluates_code",
] as const;
export type FixWarning = (typeof FIX_WARNINGS)[number];

/**
 * A validated edit. `line` is where `search` starts in the file that was deployed. `prefix` and
 * `suffix` are the rest of the first and last line around the match, with secrets removed, so
 * the dashboard can show whole lines and not only the part that changed. Older rows have none.
 */
export const MAX_FIX_LINE_CONTEXT = 300;
export const storedFixEditSchema = fixEditSchema.extend({
  line: z.number().int().min(1),
  prefix: z.string().max(MAX_FIX_LINE_CONTEXT).default(""),
  suffix: z.string().max(MAX_FIX_LINE_CONTEXT).default(""),
});

/** What the API keeps next to the edits (IssueFix.result): everything except the code. */
export const storedFixResultSchema = z.object({
  fixable: z.boolean(),
  prTitle: z.string().max(120),
  explanation: z.string().max(1_500),
  confidence: z.enum(ANALYSIS_CONFIDENCES),
  reason: z.string().max(500),
  /** "file:line" of every window of code the model was given. */
  files: z.array(z.string().max(600)).max(MAX_FIX_FILES),
  warnings: z.array(z.enum(FIX_WARNINGS)).max(FIX_WARNINGS.length),
  promptVersion: z.string().min(1).max(32),
  model: z.string().min(1).max(100),
});

export type StoredFixEdit = z.infer<typeof storedFixEditSchema>;
export type StoredFixResult = z.infer<typeof storedFixResultSchema>;

export interface FixPullRequestLink {
  number: number;
  url: string;
}

/** The suggestion itself. Model output: show it as plain text, never as HTML or markdown. */
export interface FixSuggestion extends Omit<StoredFixResult, "promptVersion"> {
  edits: StoredFixEdit[];
}

/** What the dashboard receives. */
export interface PublicIssueFix {
  id: string;
  createdAt: string;
  /** True when it was read from storage and no AI call was made. */
  cached: boolean;
  repo: string;
  commitSha: string;
  pullRequest: FixPullRequestLink | null;
  /**
   * Null once the code of the fix was removed (a switch was turned off, GitHub was disconnected
   * or the repository changed). The pull request link, if any, stays.
   */
  suggestion: FixSuggestion | null;
}
