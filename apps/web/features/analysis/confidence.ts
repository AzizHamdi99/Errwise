import type { AnalysisConfidence } from "@errwise/shared";

/** How the confidence of an AI answer is shown. It is the model's opinion, not a promise. */
export const CONFIDENCE: Record<
  AnalysisConfidence,
  { label: string; style: string }
> = {
  low: {
    label: "Low confidence",
    style: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  medium: {
    label: "Medium confidence",
    style: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  },
  high: {
    label: "High confidence",
    style:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
};
