"use client";

import { ShieldCheck, TriangleAlert, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fixErrorMessage, githubLink } from "../fix-view";
import { useIssueFix, useOpenFixPullRequest, useSuggestFix } from "../queries";
import { FixLoading, FixShell } from "./fix-shell";
import { OpenPullRequestDialog } from "./open-pull-request-dialog";
import { SuggestedFix } from "./suggested-fix";

interface Props {
  orgId: string;
  projectId: string;
  issueId: string;
  /** The project's switch for AI fix pull requests. */
  enabled: boolean;
  /** The project's switch for source code: the fix feature needs it. */
  sourceEnabled: boolean;
  /** Owner: may turn the feature on. */
  canManage: boolean;
  /** Owner or admin: may open the pull request. */
  canOpen: boolean;
  integrationsHref: string;
}

function Privacy() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        The code around the failing lines is sent to the AI with secrets and
        personal data removed. A suggestion uses one of the organization&apos;s
        daily AI requests.
      </span>
    </p>
  );
}

export function SuggestedFixCard({
  orgId,
  projectId,
  issueId,
  enabled,
  sourceEnabled,
  canManage,
  canOpen,
  integrationsHref,
}: Props) {
  const query = useIssueFix(orgId, projectId, issueId, enabled);
  const suggest = useSuggestFix(orgId, projectId, issueId);
  const open = useOpenFixPullRequest(orgId, projectId, issueId);
  const [confirming, setConfirming] = useState(false);

  if (!enabled) {
    // Not nagged about a feature that depends on a choice they have not made yet.
    if (!canManage || !sourceEnabled) return null;
    return (
      <FixShell>
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-medium">Let the AI suggest code fixes</p>
            <p className="max-w-prose text-sm text-muted-foreground">
              Source code is already on for this project. You can also let the
              AI propose a change to it, which your team reads here and an owner
              or admin can open as a draft pull request.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={integrationsHref} />}
          >
            Review the settings
          </Button>
        </div>
      </FixShell>
    );
  }

  if (query.isPending) {
    return (
      <FixShell>
        <FixLoading label="Checking for a suggestion…" />
      </FixShell>
    );
  }
  if (suggest.isPending) {
    return (
      <FixShell>
        <FixLoading label="Reading your code and writing a fix…" />
      </FixShell>
    );
  }

  const fix = query.data;
  if (fix) {
    const edits = fix.suggestion?.edits ?? [];
    const files = [...new Set(edits.map((edit) => edit.file))];

    return (
      <>
        <SuggestedFix
          fix={fix}
          canOpen={canOpen}
          onOpen={() => setConfirming(true)}
        />
        <OpenPullRequestDialog
          open={confirming}
          onOpenChange={(next) => {
            if (!next) open.reset();
            setConfirming(next);
          }}
          repo={fix.repo}
          branch={`errwise/fix-${fix.id}`}
          files={files}
          isPending={open.isPending}
          error={open.isError ? fixErrorMessage(open.error) : null}
          onConfirm={() =>
            open.mutate(fix.id, {
              onSuccess: (opened) => {
                setConfirming(false);
                const href = githubLink(opened.pullRequest?.url);
                toast.success(
                  `Draft pull request #${opened.pullRequest?.number ?? ""} opened`,
                  href
                    ? {
                        action: {
                          label: "Open",
                          onClick: () =>
                            window.open(href, "_blank", "noopener,noreferrer"),
                        },
                      }
                    : undefined,
                );
              },
            })
          }
        />
      </>
    );
  }

  // Either the first load failed, or asking for a suggestion failed.
  const failure = suggest.isError
    ? suggest.error
    : query.isError
      ? query.error
      : null;

  if (failure) {
    return (
      <FixShell>
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden
            />
            <div className="space-y-1">
              <p className="text-sm font-medium">No suggestion this time</p>
              <p role="alert" className="text-sm text-muted-foreground">
                {fixErrorMessage(failure)}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              suggest.isError ? suggest.mutate() : query.refetch()
            }
          >
            Try again
          </Button>
        </div>
      </FixShell>
    );
  }

  return (
    <FixShell>
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium">Fix this error</p>
          <p className="max-w-prose text-sm text-muted-foreground">
            Ask the AI for a change to your code that fixes it. You read the
            change here first. Nothing is written to GitHub until an owner or
            admin opens a draft pull request.
          </p>
          <Privacy />
        </div>
        <Button size="sm" onClick={() => suggest.mutate()}>
          <Wrench aria-hidden />
          Suggest a fix
        </Button>
      </div>
    </FixShell>
  );
}
