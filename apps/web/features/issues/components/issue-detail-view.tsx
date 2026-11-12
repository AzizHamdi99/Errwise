"use client";

import { ArrowLeft, SearchX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { IssueStatus } from "@errwise/shared";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProject } from "@/features/projects/use-current-project";
import { ApiError, getErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useIssue, useUpdateIssueStatus } from "../queries";
import { EventDetailsCard } from "./event-details-card";
import { IssueStatusBadge, issueStatusMeta } from "./issue-status-badge";
import { IssueStatusControl } from "./issue-status-control";
import { RecentEventsCard } from "./recent-events-card";
import { StackTraceCard } from "./stack-trace-card";
import { GithubIssueButton } from "@/features/github/components/github-issue-button";
import { can } from "@/lib/permissions";

const STATUS_TOAST: Record<IssueStatus, string> = {
  resolved: "Issue resolved",
  ignored: "Issue ignored",
  unresolved: "Issue reopened",
};

const LEVEL_STYLE: Record<string, string> = {
  fatal: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
};

/** The API title is "Type: message", so split it to style the two parts. */
function splitTitle(title: string, type: string | null) {
  if (type && title.startsWith(`${type}: `)) {
    return { type, message: title.slice(type.length + 2) };
  }
  return { type: null, message: title };
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function IssueDetailView() {
  const { issueId } = useParams<{ issueId: string }>();
  const { org, project } = useCurrentProject();
  const orgId = org?.id ?? "";
  const projectId = project?.id ?? "";

  const query = useIssue(orgId, projectId, issueId);
  const updateStatus = useUpdateIssueStatus(orgId, projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Hooks must run on every render, so this stays above the early returns.
  // ASSUMPTION 1: the detail response carries the events as `issue.events`
  const events = useMemo(
    () =>
      [...(query.data?.events ?? [])].sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp),
      ),
    [query.data],
  );
  const selected = events.find((e) => e.id === selectedId) ?? events[0] ?? null;

  if (!org || !project) return null; // ProjectGate guarantees this never happens

  const listHref = `/organizations/${orgId}/projects/${projectId}/issues`;

  const backLink = (
    <Link
      href={listHref}
      className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="size-4" aria-hidden />
      All issues
    </Link>
  );

  if (query.isPending) return <DetailSkeleton />;

  if (query.isError) {
    const notFound =
      query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="space-y-6">
        {backLink}
        <EmptyState
          icon={notFound ? SearchX : TriangleAlert}
          title={notFound ? "Issue not found" : "Couldn't load this issue"}
          description={
            notFound
              ? "It may have been deleted, or the link is wrong."
              : getErrorMessage(query.error)
          }
          action={
            notFound ? (
              <Button variant="outline" render={<Link href={listHref} />}>
                Back to issues
              </Button>
            ) : (
              <Button variant="outline" onClick={() => query.refetch()}>
                Try again
              </Button>
            )
          }
        />
      </div>
    );
  }

  // Narrowed here: query.data is IssueDetail, not undefined.
  // ASSUMPTION 2: the detail response is the issue itself (PublicIssue & { events })
  const issue = query.data;

  function setStatus(status: IssueStatus) {
    const previous = issue.status;
    updateStatus.mutate(
      { issueId: issue.id, status },
      {
        onSuccess: () =>
          toast(STATUS_TOAST[status], {
            action: {
              label: "Undo",
              onClick: () =>
                updateStatus.mutate({ issueId: issue.id, status: previous }),
            },
          }),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  }

  const { icon: StatusIcon, text } = issueStatusMeta(issue.status);
  const { type, message } = splitTitle(issue.title, issue.type);
  const releases =
    issue.firstRelease && issue.lastRelease
      ? issue.firstRelease === issue.lastRelease
        ? `release ${issue.lastRelease}`
        : `first release ${issue.firstRelease} · last release ${issue.lastRelease}`
      : issue.lastRelease
        ? `release ${issue.lastRelease}`
        : null;

  return (
    <div className="space-y-6">
      {backLink}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start gap-3">
            <StatusIcon
              className={cn("mt-1.5 size-5 shrink-0", text)}
              aria-hidden
            />
            <h1 className="text-xl leading-8 font-semibold tracking-tight break-words">
              {type ? <span>{type}: </span> : null}
              <span className={type ? "font-normal" : undefined}>
                {message}
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <IssueStatusBadge status={issue.status} />
            <span
              className={cn(
                "rounded-md px-2 py-0.5 font-medium capitalize",
                LEVEL_STYLE[issue.level] ?? "bg-muted text-muted-foreground",
              )}
            >
              {issue.level}
            </span>
            <span>{issue.eventCount.toLocaleString()} events</span>
            <span title={new Date(issue.firstSeenAt).toLocaleString()}>
              first seen {formatRelative(issue.firstSeenAt)}
            </span>
            <span title={new Date(issue.lastSeenAt).toLocaleString()}>
              last seen {formatRelative(issue.lastSeenAt)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {issue.environments.map((environment) => (
              <span
                key={environment}
                className="rounded-md border bg-card px-2 py-0.5"
              >
                {environment}
              </span>
            ))}
            {releases ? <span>{releases}</span> : null}
          </div>
        </div>

        {/* <IssueStatusControl
          status={issue.status}
          pending={updateStatus.isPending}
          onChange={setStatus}
        /> */}
        <div className="flex flex-wrap items-center gap-2">
          <GithubIssueButton
            orgId={orgId}
            projectId={projectId}
            issueId={issue.id}
            link={issue.github}
            canManage={can(org.role, "github.manage")}
          />
          <IssueStatusControl
            status={issue.status}
            pending={updateStatus.isPending}
            onChange={setStatus}
          />
        </div>
      </header>

      {selected ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <StackTraceCard stack={selected.stack} message={selected.message} />
            <RecentEventsCard
              events={events}
              total={issue.eventCount}
              selectedId={selected.id}
              onSelect={setSelectedId}
            />
          </div>
          <EventDetailsCard event={selected} />
        </div>
      ) : (
        <EmptyState
          icon={TriangleAlert}
          title="No events to show"
          description="This issue has no stored events. They may have been removed by the retention job."
        />
      )}
    </div>
  );
}
