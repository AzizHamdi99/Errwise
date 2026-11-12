"use client";

import { ExternalLink, GitBranch, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { GithubIssueLink } from "@errwise/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api";
import { useCreateGithubIssue, useGithubConnection } from "../use-github";

interface Props {
  orgId: string;
  projectId: string;
  issueId: string;
  link: GithubIssueLink | null;
  /** Owner only: decides whether the "not connected" state offers a way to fix it. */
  canManage: boolean;
}

export function GithubIssueButton({
  orgId,
  projectId,
  issueId,
  link,
  canManage,
}: Props) {
  const connection = useGithubConnection(orgId, projectId);
  const create = useCreateGithubIssue(orgId, projectId);

  // Already created: always a link, whatever the connection state is now.
  if (link) {
    return (
      <Button
        variant="outline"
        size="sm"
        render={<a href={link.url} target="_blank" rel="noopener noreferrer" />}
      >
        <ExternalLink aria-hidden />
        GitHub #{link.number}
      </Button>
    );
  }

  if (connection.isPending) return <Skeleton className="h-8 w-40" />;

  // A failed status request must not hide the whole header: show nothing.
  if (connection.isError) return null;

  const ready = connection.data.installed && connection.data.repo !== null;

  if (!ready) {
    if (canManage) {
      return (
        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              href={`/organizations/${orgId}/projects/${projectId}/integrations`}
            />
          }
        >
          <GitBranch aria-hidden />
          Connect GitHub
        </Button>
      );
    }
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        title="Ask the organization owner to connect GitHub"
      >
        <GitBranch aria-hidden />
        Create GitHub issue
      </Button>
    );
  }

  function onCreate() {
    create.mutate(issueId, {
      onSuccess: (created) =>
        toast.success(`GitHub issue #${created.number} created`, {
          action: {
            label: "Open",
            onClick: () =>
              window.open(created.url, "_blank", "noopener,noreferrer"),
          },
        }),
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onCreate}
      disabled={create.isPending}
    >
      {create.isPending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <GitBranch aria-hidden />
      )}
      Create GitHub issue
    </Button>
  );
}
