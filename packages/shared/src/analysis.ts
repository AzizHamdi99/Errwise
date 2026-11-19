import { z } from "zod";

export const ANALYSIS_CONFIDENCES = ["low", "medium", "high"] as const;
export type AnalysisConfidence = (typeof ANALYSIS_CONFIDENCES)[number];

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
});

/** What the AI service answers (apps/ai, AnalyzeResponse). */
export const analysisResultSchema = z.object({
  summary: z.string().min(1).max(500),
  probableCause: z.string().min(1).max(2_000),
  suggestedFix: z.string().min(1).max(2_000),
  confidence: z.enum(ANALYSIS_CONFIDENCES),
  framesUsed: z.array(z.string().max(1_000)).max(10),
  promptVersion: z.string().min(1).max(32),
  model: z.string().min(1).max(100),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/** What the dashboard receives. The text is model output: show it as plain text. */
export interface PublicIssueAnalysis extends AnalysisResult {
  createdAt: string;
  /** True when it was read from storage and no AI call was made. */
  cached: boolean;
}
