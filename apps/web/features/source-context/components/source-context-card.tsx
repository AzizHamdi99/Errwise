"use client";

import { Code2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGithubConnection } from "@/features/github/use-github";
import { useUpdateProject } from "@/features/projects/queries";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Props {
  orgId: string;
  projectId: string;
  enabled: boolean;
  /** AI fix pull requests are on: turning source code off turns them off too. */
  fixesEnabled?: boolean;
  /** Owner only. Everyone else sees the state but cannot change it. */
  canManage: boolean;
}

const FACTS = [
  "Read from GitHub when someone opens an issue, at the commit that was deployed.",
  "Errwise does not store your code.",
  "When on, the lines around the failing frame are also sent to the AI analysis.",
];

export function SourceContextCard({
  orgId,
  projectId,
  enabled,
  fixesEnabled = false,
  canManage,
}: Props) {
  const connection = useGithubConnection(orgId, projectId);
  const update = useUpdateProject(orgId, projectId);

  const ready =
    connection.data?.installed === true && connection.data.repo !== null;

  function toggle() {
    const next = !enabled;
    update.mutate(
      { sourceContextEnabled: next },
      {
        onSuccess: () =>
          toast.success(
            next ? "Source code turned on" : "Source code turned off",
          ),
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
        Connect GitHub and choose a repository above first. Source code is read
        from that repository.
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
          Needs the GitHub permission <strong>Contents: read</strong>. If you
          installed Errwise before, GitHub asks the owner to accept it. Your app
          must also report its commit: use <code>@errwise/node</code> 0.2.0 or
          set <code>ERRWISE_COMMIT_SHA</code>.
        </p>

        {enabled && fixesEnabled ? (
          <p className="text-xs text-muted-foreground">
            Turning this off also turns off AI fix pull requests, which need it.
          </p>
        ) : null}

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
              {enabled ? "Turn off" : "Turn on source code"}
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
    <section aria-label="Source code" className="rounded-xl border bg-card p-6">
      <header className="mb-6 flex items-start gap-3">
        <Code2 className="mt-0.5 size-5 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-base font-semibold">Source code</h2>
          <p className="text-sm text-muted-foreground">
            Show the code around each stack frame on the issue page.
          </p>
        </div>
      </header>
      {body}
    </section>
  );
}
