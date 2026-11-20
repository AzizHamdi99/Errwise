import type {
  SourceContextResult,
  SourceFrame,
  UnresolvedFrameReason,
} from "@errwise/shared";

/** One line under the stack trace header that says what to do, never more than that. */
export interface SourceBanner {
  tone: "info" | "warning";
  text: string;
  action?:
    | { kind: "link"; label: string; href: string; external?: boolean }
    | { kind: "retry"; label: string };
}

export interface SourceView {
  /** Every frame the API answered for, by its index in the parsed stack. */
  frames: ReadonlyMap<number, SourceFrame>;
  loading: boolean;
  banner: SourceBanner | null;
}

/** Short label next to a frame that has no code. */
export const REASON_LABEL: Record<UnresolvedFrameReason, string> = {
  compiled: "compiled code",
  ambiguous: "several matching files",
  not_found: "not in the repository",
  too_large: "file too large",
  binary: "binary file",
  line_out_of_range: "file differs",
  unavailable: "could not load",
};

/** What the label means, for the tooltip. */
export const REASON_HINT: Record<UnresolvedFrameReason, string> = {
  compiled:
    "This frame is generated code (dist, build). Its lines do not match your source.",
  ambiguous:
    "Several files in the repository match this path equally well, so none is shown.",
  not_found: "No file in the repository at this commit matches this path.",
  too_large: "This file is too large to show.",
  binary: "This file is not text.",
  line_out_of_range:
    "The file at this commit is shorter than the line in the error: it is not the version that ran.",
  unavailable: "GitHub could not be reached for this file.",
};

interface Input {
  /** The project's switch. */
  sourceEnabled: boolean;
  /** Only the owner can change the switch and the GitHub permission. */
  canManage: boolean;
  commitSha: string | null;
  integrationsHref: string;
  query: {
    isLoading: boolean;
    isError: boolean;
    data: SourceContextResult | undefined;
  };
}

const EMPTY: ReadonlyMap<number, SourceFrame> = new Map();

const GITHUB_INSTALLATIONS = "https://github.com/settings/installations";

const retry = (label = "Try again") => ({ kind: "retry" as const, label });

/**
 * Pure: turns what we know into what to show. Members are not nagged about things only the
 * owner can fix, and nothing is shown while the project has not opted in.
 */
export function buildSourceView(input: Input): SourceView {
  const { sourceEnabled, canManage, commitSha, integrationsHref, query } =
    input;
  const view = (banner: SourceBanner | null, loading = false): SourceView => ({
    frames: EMPTY,
    loading,
    banner,
  });

  if (!sourceEnabled) {
    return view(
      canManage
        ? {
            tone: "info",
            text: "See the code behind each frame, straight from your GitHub repository.",
            action: {
              kind: "link",
              label: "Turn on source code",
              href: integrationsHref,
            },
          }
        : null,
    );
  }

  if (!commitSha) {
    return view({
      tone: "info",
      text: "This event does not say which commit ran, so there is no code to show. Update @errwise/node to 0.2.0, or set ERRWISE_COMMIT_SHA.",
    });
  }

  if (query.isLoading) return view(null, true);
  if (query.isError || !query.data) {
    return view({
      tone: "warning",
      text: "Could not load the source code.",
      action: retry(),
    });
  }

  const result = query.data;
  switch (result.status) {
    case "ok":
      return okView(result);
    case "disabled":
      return view(null);
    case "not_connected":
      return view(
        canManage
          ? {
              tone: "info",
              text: "GitHub is not connected to this project.",
              action: {
                kind: "link",
                label: "Connect GitHub",
                href: integrationsHref,
              },
            }
          : null,
      );
    case "no_commit":
      return view({
        tone: "info",
        text: "This event does not say which commit ran, so there is no code to show.",
      });
    case "commit_not_found":
      return view({
        tone: "warning",
        text: `GitHub does not know commit ${commitSha.slice(0, 7)} in the connected repository. Push it, or check which repository is connected.`,
      });
    case "no_permission":
      return view(
        canManage
          ? {
              tone: "warning",
              text: "Errwise cannot read this repository. Accept the “Contents: read” permission on the GitHub installation.",
              action: {
                kind: "link",
                label: "Open GitHub settings",
                href: GITHUB_INSTALLATIONS,
                external: true,
              },
            }
          : {
              tone: "warning",
              text: "Errwise cannot read this repository. Ask the organization owner to accept the new GitHub permission.",
            },
      );
    case "rate_limited":
      return view({
        tone: "warning",
        text: "GitHub is limiting requests right now. Try again in a minute.",
        action: retry(),
      });
    case "unavailable":
      return view({
        tone: "warning",
        text: "Could not reach GitHub.",
        action: retry(),
      });
  }
}

function okView(result: SourceContextResult): SourceView {
  const frames = new Map(result.frames.map((f) => [f.frameIndex, f]));
  const anyFound = result.frames.some((f) => f.status === "found");
  const anyCompiled = result.frames.some(
    (f) => f.status === "unresolved" && f.reason === "compiled",
  );

  // The most common reason for an empty result deserves one clear sentence.
  const banner: SourceBanner | null =
    !anyFound && anyCompiled
      ? {
          tone: "info",
          text: "These frames point at compiled code. Run your app with --enable-source-maps, or deploy plain JavaScript, to see the source here.",
        }
      : null;

  return { frames, loading: false, banner };
}
