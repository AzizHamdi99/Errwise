"use client";

import { ArrowDown, Loader2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { IssueStatus, PublicIssue } from "@errwise/shared";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectPageHeader } from "@/features/projects/components/project-page-header";
import { useCurrentProject } from "@/features/projects/use-current-project";
import { getErrorMessage } from "@/lib/api";
import { useIssues, useUpdateIssueStatus } from "../queries";
import { useIssueFilters } from "../use-issue-filters";
import { useIssueShortcuts } from "../use-issue-shortcuts";
import { IssueRow } from "./issue-row";
import { IssuesEmptyState } from "./issues-empty-state";
import { IssuesFilters } from "./issues-filters";

// There is no "list environments" endpoint yet, so offer the usual ones
// plus any environment seen in the loaded issues.
const SUGGESTED_ENVIRONMENTS = ["production", "staging", "development"];

const STATUS_TOAST: Record<IssueStatus, string> = {
  resolved: "Issue resolved",
  ignored: "Issue ignored",
  unresolved: "Issue reopened",
};

const HINTS = [
  ["↑ ↓", "move"],
  ["↵", "open"],
  ["r", "resolve"],
  ["i", "ignore"],
  ["/", "search"],
] as const;

const toggleResolved = (status: IssueStatus): IssueStatus =>
  status === "resolved" ? "unresolved" : "resolved";
const toggleIgnored = (status: IssueStatus): IssueStatus =>
  status === "ignored" ? "unresolved" : "ignored";

export function IssuesView() {
  const router = useRouter();
  const { org, project } = useCurrentProject();
  const orgId = org?.id ?? "";
  const projectId = project?.id ?? "";

  const { filters, update, clear } = useIssueFilters();
  const query = useIssues(orgId, projectId, filters);
  const updateStatus = useUpdateIssueStatus(orgId, projectId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const issues = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const environments = useMemo(
    () => [
      ...new Set([
        ...SUGGESTED_ENVIRONMENTS,
        ...issues.flatMap((issue) => issue.environments),
        ...(filters.environment ? [filters.environment] : []),
      ]),
    ],
    [issues, filters.environment],
  );
  const activeIndex = issues.findIndex((issue) => issue.id === activeId);

  const issueHref = (issue: PublicIssue) =>
    `/organizations/${orgId}/projects/${projectId}/issues/${issue.id}`;

  function setStatus(issue: PublicIssue, status: IssueStatus) {
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

  function clearFilters() {
    clear();
    setSearchKey((key) => key + 1);
  }

  useIssueShortcuts({
    onMove: (delta) => {
      if (issues.length === 0) return;
      const next =
        activeIndex === -1
          ? delta > 0
            ? 0
            : issues.length - 1
          : Math.min(Math.max(activeIndex + delta, 0), issues.length - 1);
      const target = issues[next];
      if (target) setActiveId(target.id);
    },
    onOpen: () => {
      const issue = issues[activeIndex];
      if (issue) router.push(issueHref(issue));
    },
    onResolve: () => {
      const issue = issues[activeIndex];
      if (issue) setStatus(issue, toggleResolved(issue.status));
    },
    onIgnore: () => {
      const issue = issues[activeIndex];
      if (issue) setStatus(issue, toggleIgnored(issue.status));
    },
    onSearch: () => searchRef.current?.focus(),
  });

  useEffect(() => {
    if (activeId) {
      document
        .getElementById(`issue-${activeId}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [activeId]);

  if (!org || !project) return null; // ProjectGate guarantees this never happens

  let body: React.ReactNode;
  if (query.isPending) {
    body = (
      <div aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex gap-3 border-b px-4 py-4 last:border-b-0"
          >
            <Skeleton className="size-4 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (query.isError) {
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load issues"
        description={getErrorMessage(query.error)}
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        }
        className="rounded-none border-0"
      />
    );
  } else if (issues.length === 0) {
    body = (
      <IssuesEmptyState
        filters={filters}
        apiKeysHref={`/organizations/${org.id}/projects/${project.id}/api-keys`}
        onClear={clearFilters}
        onShowAll={() => update({ status: "all" })}
      />
    );
  } else {
    body = (
      <ul>
        {issues.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            href={issueHref(issue)}
            active={issue.id === activeId}
            onActivate={() => setActiveId(issue.id)}
            onToggleResolved={(item) =>
              setStatus(item, toggleResolved(item.status))
            }
            onToggleIgnored={(item) =>
              setStatus(item, toggleIgnored(item.status))
            }
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-8">
      <ProjectPageHeader
        title="Issues"
        description="Grouped errors across your environments and releases."
      />

      <section aria-label="Issues" className="rounded-xl border bg-card">
        <div className="border-b p-4">
          <IssuesFilters
            filters={filters}
            environments={environments}
            onChange={update}
            searchKey={searchKey}
            searchRef={searchRef}
          />
        </div>

        {body}

        {issues.length > 0 ? (
          <footer className="flex items-center justify-between gap-4 border-t px-4 py-3 text-xs text-muted-foreground">
            <ul className="hidden flex-wrap items-center gap-4 md:flex">
              {HINTS.map(([keys, label]) => (
                <li key={label} className="flex items-center gap-1.5">
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    {keys}
                  </kbd>
                  {label}
                </li>
              ))}
            </ul>
            {query.hasNextPage ? (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <ArrowDown aria-hidden />
                )}
                Load more
              </Button>
            ) : null}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
