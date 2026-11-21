import { z } from "zod";

export const ANALYSIS_CONFIDENCES = ["low", "medium", "high"] as const;
export type AnalysisConfidence = (typeof ANALYSIS_CONFIDENCES)[number];

export const MAX_ANALYSIS_SNIPPETS = 5;

/**
 * The lines around one failing frame. `code` is already formatted: one source line per
 * line, each prefixed with its number, the failing line marked with ">".
 */
export const sourceSnippetSchema = z.object({
  file: z.string().min(1).max(500),
  line: z.number().int().min(1),
  code: z.string().min(1).max(2_000),
});

/**
 * What the API sends to the AI service (apps/ai, AnalyzeRequest). The text is
 * scrubbed first. The limits match eventSchema, and the Python side forbids
 * unknown fields, so a change here must be made there too.
 */
export const analyzeRequestSchema = z.object({
  type: z.string().min(1).max(200),
  message: z.string().min(1).max(5_000),
  stack: z.string().max(50_000).optional(),
  environment: z.string().min(1).max(64),
  release: z.string().min(1).max(128).optional(),
  runtime: z.string().min(1).max(64).optional(),
  /** Only when the project opted in to showing its source code. */
  sourceContext: z.array(sourceSnippetSchema).max(MAX_ANALYSIS_SNIPPETS).optional(),
});

/** What the AI service answers (apps/ai, AnalyzeResponse). */
export const analysisResultSchema = z.object({
  summary: z.string().min(1).max(500),
  probableCause: z.string().min(1).max(2_000),
  suggestedFix: z.string().min(1).max(2_000),
  confidence: z.enum(ANALYSIS_CONFIDENCES),
  framesUsed: z.array(z.string().max(1_000)).max(10),
  /**
   * Optional for the tolerant reader: rows stored before prompt v4, and an AI service that
   * has not been deployed yet, do not have them. Used for the GitHub issue, plain text only.
   */
  issueTitle: z.string().min(1).max(120).optional(),
  reproSteps: z.array(z.string().min(1).max(300)).max(5).optional(),
  promptVersion: z.string().min(1).max(32),
  model: z.string().min(1).max(100),
});

/**
 * What the API keeps: the AI service's answer plus what the API knows about the request.
 * Rows stored before the code was sent have no `sourceFiles`, hence the default.
 */
export const storedAnalysisSchema = analysisResultSchema.extend({
  /** "file:line" of every snippet of source code the analysis was given. */
  sourceFiles: z.array(z.string().max(600)).max(MAX_ANALYSIS_SNIPPETS).default([]),
});

export type SourceSnippet = z.infer<typeof sourceSnippetSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type StoredAnalysis = z.infer<typeof storedAnalysisSchema>;

/** What the dashboard receives. The text is model output: show it as plain text. */
export interface PublicIssueAnalysis extends AnalysisResult {
  /** Where in the code the analysis looked, when the project shares its source code. */
  sourceFiles: string[];
  createdAt: string;
  /** True when it was read from storage and no AI call was made. */
  cached: boolean;
}
