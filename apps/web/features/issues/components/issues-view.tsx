"use client";

import {
  ArrowDown,
  CheckCircle2,
  EyeOff,
  Loader2,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { IssueStatus, PublicIssue } from "@errwise/shared";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectPageHeader } from "@/features/projects/components/project-page-header";
import { useCurrentProject } from "@/features/projects/use-current-project";
import { getErrorMessage } from "@/lib/api";
import {
  useBulkUpdateIssueStatus,
  useIssueFacets,
  useIssues,
  useUpdateIssueStatus,
} from "../queries";
import { useIssueFilters } from "../use-issue-filters";
import { useIssueShortcuts } from "../use-issue-shortcuts";
import { IssueRow } from "./issue-row";
import { IssuesEmptyState } from "./issues-empty-state";
import { IssuesFilters } from "./issues-filters";

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
  ["x", "select"],
  ["esc", "clear selection"],
  ["/", "search"],
] as const;

const BULK_TOAST: Record<IssueStatus, (count: number) => string> = {
  resolved: (n) => `${n} ${n === 1 ? "issue" : "issues"} resolved`,
  ignored: (n) => `${n} ${n === 1 ? "issue" : "issues"} ignored`,
  unresolved: (n) => `${n} ${n === 1 ? "issue" : "issues"} reopened`,
};

const NO_SELECTION: ReadonlySet<string> = new Set();

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
  const bulk = useBulkUpdateIssueStatus(orgId, projectId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const issues = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  // The choices come from the project's own data. While they load (or if they fail), the filters
  // still work: a value taken from the URL is shown by the select itself.
  const facets = useIssueFacets(orgId, projectId);
  const activeIndex = issues.findIndex((issue) => issue.id === activeId);

  // The ticked issues belong to the filters they were ticked under: a different filter or sort
  // starts from nothing. Stored with its key, so no effect has to reset it. Only rows that are
  // still loaded count: one that left the list (it changed status) is dropped by itself.
  const filterKey = JSON.stringify(filters);
  const [selection, setSelection] = useState<{
    key: string;
    ids: ReadonlySet<string>;
  }>({ key: filterKey, ids: NO_SELECTION });
  const selectedIds =
    selection.key === filterKey ? selection.ids : NO_SELECTION;
  const selectedIssues = useMemo(
    () => issues.filter((issue) => selectedIds.has(issue.id)),
    [issues, selectedIds],
  );
  const allSelected =
    issues.length > 0 && selectedIssues.length === issues.length;

  function selectIds(ids: ReadonlySet<string>) {
    setSelection({ key: filterKey, ids });
  }
  function toggleSelected(issue: PublicIssue) {
    const next = new Set(selectedIds);
    if (!next.delete(issue.id)) next.add(issue.id);
    selectIds(next);
  }
  function toggleAll() {
    selectIds(allSelected ? NO_SELECTION : new Set(issues.map((i) => i.id)));
  }

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

  function bulkSet(status: IssueStatus) {
    // Only the issues that would change: an undo must not touch the others.
    const targets = selectedIssues.filter((issue) => issue.status !== status);
    if (targets.length === 0) {
      toast("Nothing to change: they already have that status");
      return;
    }
    const previous = targets.map((issue) => ({
      id: issue.id,
      status: issue.status,
    }));
    bulk.mutate(
      { issueIds: targets.map((issue) => issue.id), status },
      {
        onSuccess: ({ updated }) => {
          selectIds(NO_SELECTION);
          toast(BULK_TOAST[status](updated), {
            action: { label: "Undo", onClick: () => undoBulk(previous) },
          });
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  }

  /** The issues had different statuses before: one request per previous status, at most three. */
  function undoBulk(previous: { id: string; status: IssueStatus }[]) {
    const byStatus = new Map<IssueStatus, string[]>();
    for (const { id, status } of previous) {
      byStatus.set(status, [...(byStatus.get(status) ?? []), id]);
    }
    Promise.all(
      [...byStatus].map(([status, issueIds]) =>
        bulk.mutateAsync({ issueIds, status }),
      ),
    ).catch((error: unknown) => toast.error(getErrorMessage(error)));
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
    onToggleSelect: () => {
      const issue = issues[activeIndex];
      if (issue) toggleSelected(issue);
    },
    onClearSelection: () => {
      if (selectedIds.size > 0) selectIds(NO_SELECTION);
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
            selected={selectedIds.has(issue.id)}
            onActivate={() => setActiveId(issue.id)}
            onToggleSelected={toggleSelected}
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
            environments={facets.data?.environments ?? []}
            releases={facets.data?.releases ?? []}
            onChange={update}
            searchKey={searchKey}
            searchRef={searchRef}
          />
        </div>

        {issues.length > 0 ? (
          // Sticks under the top bar (h-16), so the actions stay in reach while scrolling.
          <div className="sticky top-16 z-20 flex min-h-12 flex-wrap items-center gap-3 border-b bg-card px-4 py-2">
            <Checkbox
              checked={allSelected}
              indeterminate={selectedIssues.length > 0 && !allSelected}
              onCheckedChange={toggleAll}
              aria-label={
                allSelected
                  ? "Clear the selection"
                  : "Select all the issues loaded"
              }
            />
            {selectedIssues.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Select all loaded
              </span>
            ) : (
              <>
                <span className="text-xs font-medium" aria-live="polite">
                  {selectedIssues.length} selected
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulk.isPending}
                    onClick={() => bulkSet("resolved")}
                  >
                    <CheckCircle2 aria-hidden />
                    Resolve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulk.isPending}
                    onClick={() => bulkSet("ignored")}
                  >
                    <EyeOff aria-hidden />
                    Ignore
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulk.isPending}
                    onClick={() => bulkSet("unresolved")}
                  >
                    <RotateCcw aria-hidden />
                    Reopen
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => selectIds(NO_SELECTION)}
                >
                  Clear
                </Button>
              </>
            )}
          </div>
        ) : null}

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
