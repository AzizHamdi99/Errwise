"use client";

import { GitPullRequestDraft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGithubConnection } from "@/features/github/use-github";
import { useUpdateProject } from "@/features/projects/queries";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fixesRoot } from "../queries";

interface Props {
  orgId: string;
  projectId: string;
  /** The switch of this feature. */
  enabled: boolean;
  /** The switch for source code: this feature cannot be on without it. */
  sourceEnabled: boolean;
  /** Owner only. Everyone else sees the state but cannot change it. */
  canManage: boolean;
}

const FACTS = [
  "The AI proposes a small change to the code behind a stack trace. Your team reads it as a diff in Errwise first.",
  "Only an owner or admin can then open it as a draft pull request. Errwise never merges anything.",
  "The pushed branch runs your CI and preview deployments, possibly with your secrets, before anyone merges it. Read the diff before you open it.",
  "The AI reads the error text your app reports, which anyone with an API key of this project can influence. Treat a suggestion as untrusted until you have read it.",
  "Errwise keeps only the changed lines. They are removed when you turn this off, turn source code off, disconnect GitHub or choose another repository.",
];

export function FixPullRequestsCard({
  orgId,
  projectId,
  enabled,
  sourceEnabled,
  canManage,
}: Props) {
  const connection = useGithubConnection(orgId, projectId);
  const update = useUpdateProject(orgId, projectId);
  const queryClient = useQueryClient();

  const ready =
    connection.data?.installed === true && connection.data.repo !== null;

  function toggle() {
    const next = !enabled;
    update.mutate(
      { fixPullRequestsEnabled: next },
      {
        onSuccess: () => {
          // The API removes the stored code when this is turned off: drop what we remember.
          queryClient.removeQueries({ queryKey: fixesRoot(projectId) });
          toast.success(
            next
              ? "AI fix pull requests turned on"
              : "AI fix pull requests turned off",
          );
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  }

  let body: React.ReactNode;
  if (connection.isPending) {
    body = <Skeleton className="h-9 w-full" />;
  } else if (connection.isError) {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          {getErrorMessage(connection.error)}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => connection.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  } else if (!ready) {
    body = (
      <p className="text-sm text-muted-foreground">
        Connect GitHub and choose a repository above first. Fixes are made for
        that repository.
      </p>
    );
  } else if (!sourceEnabled && !enabled) {
    body = (
      <p className="text-sm text-muted-foreground">
        Turn on source code above first. A fix is made from the code around the
        failing lines.
      </p>
    );
  } else {
    body = (
      <div className="space-y-5">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {FACTS.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Needs the GitHub permissions <strong>Contents: Read and write</strong>{" "}
          and <strong>Pull requests: Read and write</strong>. If you installed
          Errwise before, GitHub asks the installation owner to accept them at
          github.com/settings/installations. Until then, nothing else changes.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span
              aria-hidden
              className={cn(
                "size-2 rounded-full",
                enabled ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
            />
            {enabled ? "On" : "Off"}
          </p>
          {canManage ? (
            <Button
              variant={enabled ? "outline" : "default"}
              onClick={toggle}
              disabled={update.isPending}
            >
              {update.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              {enabled ? "Turn off" : "Turn on AI fix pull requests"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only the organization owner can change this.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="AI fix pull requests"
      className="rounded-xl border bg-card p-6"
    >
      <header className="mb-6 flex items-start gap-3">
        <GitPullRequestDraft
          className="mt-0.5 size-5 text-muted-foreground"
          aria-hidden
        />
        <div>
          <h2 className="text-base font-semibold">AI fix pull requests</h2>
          <p className="text-sm text-muted-foreground">
            Let the AI suggest a code fix for an error, and open it as a draft
            pull request.
          </p>
        </div>
      </header>
      {body}
    </section>
  );
}
