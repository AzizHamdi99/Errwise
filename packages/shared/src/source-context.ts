/**
 * What the issue page receives to show the code around a stack frame. Output only: the
 * dashboard never sends any of this, so there is nothing to validate on the way in.
 */

/** Why the whole answer has no code. Each one has a different fix, so each one is a status. */
export type SourceContextStatus =
  | "ok"
  | "disabled" // the owner has not turned source code on for the project
  | "not_connected" // no GitHub installation or repository
  | "no_commit" // the event does not say which commit was deployed
  | "commit_not_found" // GitHub does not know that commit in the repository
  | "no_permission" // the GitHub App has no access to the repository's contents
  | "rate_limited" // GitHub asked us to slow down
  | "unavailable"; // GitHub could not be reached

/** Why one frame has no code. */
export type UnresolvedFrameReason =
  | "compiled" // generated output (dist/, build/): its lines do not match the source
  | "ambiguous" // several repository files match equally well
  | "not_found" // no matching file
  | "too_large"
  | "binary"
  | "line_out_of_range" // the file is shorter than the line: not the version that ran
  | "unavailable";

export interface FoundSourceFrame {
  /** Index of the frame in the parsed stack (see parseStack), so the UI can match rows. */
  frameIndex: number;
  status: "found";
  repoPath: string;
  /** The failing line, 1-based. */
  line: number;
  /** Number of the first entry of `lines`, 1-based. */
  startLine: number;
  lines: string[];
  /** Link to the same line on GitHub, at the deployed commit. */
  url: string;
}

export interface UnresolvedSourceFrame {
  frameIndex: number;
  status: "unresolved";
  reason: UnresolvedFrameReason;
}

export type SourceFrame = FoundSourceFrame | UnresolvedSourceFrame;

export interface SourceContextResult {
  status: SourceContextStatus;
  commitSha: string | null;
  /** Only the app's own frames, and only when `status` is "ok". */
  frames: SourceFrame[];
}
