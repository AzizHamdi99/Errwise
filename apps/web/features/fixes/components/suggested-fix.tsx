import { ExternalLink, GitPullRequestDraft, TriangleAlert } from "lucide-react";
import type { PublicIssueFix } from "@errwise/shared";
import { Eyebrow } from "@/components/shared/eyebrow";
import { Button } from "@/components/ui/button";
import { CONFIDENCE } from "@/features/analysis/confidence";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  FIX_WARNING_LABEL,
  buildDiff,
  commitLink,
  githubLink,
  shortSha,
} from "../fix-view";
import { FixDiff } from "./fix-diff";
import { FixShell } from "./fix-shell";

interface Props {
  fix: PublicIssueFix;
  /** Owner or admin: the only roles that may open the pull request. */
  canOpen: boolean;
  onOpen: () => void;
}

function PullRequestLink({ fix }: { fix: PublicIssueFix }) {
  if (!fix.pullRequest) return null;
  const href = githubLink(fix.pullRequest.url);
  const label = `Draft pull request #${fix.pullRequest.number}`;
  if (!href) return <span className="text-sm font-medium">{label}</span>;
  return (
    <Button
      variant="outline"
      size="sm"
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      <ExternalLink aria-hidden />
      {label}
    </Button>
  );
}

/**
 * What the AI suggested, as a diff to read. Everything from the model is plain text. Nothing
 * here writes to GitHub: opening the pull request is the dialog's job, after this is read.
 */
export function SuggestedFix({ fix, canOpen, onOpen }: Props) {
  const { suggestion } = fix;

  if (!suggestion) {
    return (
      <FixShell>
        <div className="space-y-3 px-4 py-4 text-sm">
          <p className="text-muted-foreground">
            The code of this suggestion is no longer kept: AI fix pull requests
            were turned off, GitHub was disconnected, or the repository was
            changed.
          </p>
          <PullRequestLink fix={fix} />
        </div>
      </FixShell>
    );
  }

  const confidence = CONFIDENCE[suggestion.confidence];
  const badge = (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-medium",
        confidence.style,
      )}
      title="How sure the model is, based on the evidence it was given. It can be wrong."
    >
      {confidence.label}
    </span>
  );

  const commitHref = commitLink(fix.repo, fix.commitSha);
  const footer = (
    <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
      <span>
        AI-generated and can be wrong. Errwise has not run this change.
      </span>
      <span title={new Date(fix.createdAt).toLocaleString()}>
        {suggestion.model} · {formatRelative(fix.createdAt)}
      </span>
    </footer>
  );

  if (!suggestion.fixable) {
    return (
      <FixShell actions={badge}>
        <div className="space-y-2 px-4 py-4">
          <p className="text-sm font-medium">
            The AI found no safe change to make in the code
          </p>
          <p className="text-sm leading-6 whitespace-pre-line text-muted-foreground">
            {suggestion.reason}
          </p>
          <p className="text-xs text-muted-foreground">
            This is often right: the cause is a setting, a service or a decision
            rather than a line of code. The analysis above can help you look.
          </p>
        </div>
        {footer}
      </FixShell>
    );
  }

  const diff = buildDiff(suggestion.edits);

  return (
    <FixShell actions={badge}>
      <div className="space-y-5 px-4 py-4">
        <div className="space-y-1.5">
          <Eyebrow>What was wrong</Eyebrow>
          <p className="text-sm leading-6 font-medium">{suggestion.prTitle}</p>
          <p className="text-sm leading-6 whitespace-pre-line">
            {suggestion.explanation}
          </p>
        </div>

        {suggestion.warnings.length > 0 ? (
          <div
            role="note"
            className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400"
          >
            <p className="flex items-center gap-2 font-medium">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              Worth a second look
            </p>
            <ul className="list-disc pl-6">
              {suggestion.warnings.map((warning) => (
                <li key={warning}>{FIX_WARNING_LABEL[warning]}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-2">
          <Eyebrow>The change</Eyebrow>
          <FixDiff files={diff} />
          <p className="text-xs text-muted-foreground">
            Made for the code deployed at commit{" "}
            {commitHref ? (
              <a
                href={commitHref}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded font-mono text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {shortSha(fix.commitSha)}
              </a>
            ) : (
              <span className="font-mono">{shortSha(fix.commitSha)}</span>
            )}
            . If your default branch has changed that code since, opening the
            pull request will say so.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {fix.pullRequest ? (
            <PullRequestLink fix={fix} />
          ) : canOpen ? (
            <>
              <Button onClick={onOpen}>
                <GitPullRequestDraft aria-hidden />
                Open draft pull request
              </Button>
              <p className="text-xs text-muted-foreground">
                Nothing is written to GitHub until you do.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              An owner or admin opens the pull request, after reading the
              change.
            </p>
          )}
        </div>
      </div>
      {footer}
    </FixShell>
  );
}
