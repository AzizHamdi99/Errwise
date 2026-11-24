import generated from "./screenshots.generated.json";

/** The captures the site uses. Keep in sync with NAMES in scripts/screenshots.mjs. */
export type ScreenshotName =
  | "issues-list"
  | "issue-detail"
  | "ai-analysis"
  | "suggested-fix"
  | "github-integration"
  | "regression"
  | "project-overview"
  | "api-keys"
  | "alert-email";

export interface ScreenshotFile {
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
}

const FILES: Record<string, ScreenshotFile | undefined> = generated;

/**
 * The dark and light files of a capture. A missing variant falls back to the other one, and a
 * capture that was not taken yet gives undefined.
 */
export function getScreenshot(
  name: ScreenshotName,
): { dark: ScreenshotFile; light: ScreenshotFile } | undefined {
  const single = FILES[name];
  const dark = FILES[`${name}-dark`] ?? FILES[`${name}-light`] ?? single;
  const light = FILES[`${name}-light`] ?? FILES[`${name}-dark`] ?? single;
  return dark && light ? { dark, light } : undefined;
}
