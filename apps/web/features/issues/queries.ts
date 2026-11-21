import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  DEFAULT_ISSUE_SORT,
  MAX_BULK_ISSUES,
  type BulkUpdateIssuesResult,
  type IssueDetail,
  type IssueFacets,
  type IssueListItem,
  type IssueStatus,
  type Paginated,
  type PublicIssue,
} from "@errwise/shared";
import { api } from "@/lib/api";
import { applyStatusChange, resyncIssueLists } from "./issues-cache";
import { issuesListKey, issuesRoot } from "./issues-keys";
import { issuesPollInterval } from "./polling";
import type { IssueFilters } from "./use-issue-filters";

export { issuesRoot };
const base = (orgId: string, projectId: string) =>
  `/organizations/${orgId}/projects/${projectId}/issues`;

function buildQuery(filters: IssueFilters, cursor?: string): string {
  const params = new URLSearchParams({ limit: "25" });
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.environment) params.set("environment", filters.environment);
  if (filters.level) params.set("level", filters.level);
  if (filters.release) params.set("release", filters.release);
  if (filters.regressed) params.set("regressed", "true");
  if (filters.age) params.set("age", filters.age);
  if (filters.search) params.set("search", filters.search);
  if (filters.sort !== DEFAULT_ISSUE_SORT) params.set("sort", filters.sort);
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

export function useIssues(
  orgId: string,
  projectId: string,
  filters: IssueFilters,
) {
  return useInfiniteQuery({
    queryKey: issuesListKey(projectId, filters),
    queryFn: ({ pageParam }) =>
      api<Paginated<IssueListItem>>(
        `${base(orgId, projectId)}?${buildQuery(filters, pageParam)}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!orgId && !!projectId,
    // new errors show up without a reload, and polling pauses in a hidden tab
    refetchInterval: (query) =>
      issuesPollInterval(query.state.data?.pages.length),
    refetchIntervalInBackground: false,
  });
}

/**
 * The values the filters can offer (environments, releases). It lives outside `issuesRoot` on
 * purpose: changing an issue's status invalidates that root, and the facets do not change with it.
 * They are read from every row of the project, so they are fetched once and kept for a while,
 * never polled.
 */
export function useIssueFacets(orgId: string, projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "issue-facets"] as const,
    queryFn: () => api<IssueFacets>(`${base(orgId, projectId)}/facets`),
    enabled: !!orgId && !!projectId,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateIssueStatus(orgId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      issueId,
      status,
    }: {
      issueId: string;
      status: IssueStatus;
    }) =>
      api<PublicIssue>(`${base(orgId, projectId)}/${issueId}`, {
        method: "PATCH",
        body: { status },
      }),
    // The answer is the updated issue: patch the cache with it instead of reloading every page.
    onSuccess: (issue) =>
      applyStatusChange(
        queryClient,
        projectId,
        [issue.id],
        issue.status,
        issue.resolvedAt,
      ),
  });
}

/**
 * Many issues, one status. The API takes at most MAX_BULK_ISSUES at once, so a larger selection
 * is split and sent in parallel. If any part fails, some issues may have changed and others not:
 * the lists are reloaded from the server rather than guessed.
 */
export function useBulkUpdateIssueStatus(orgId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      issueIds,
      status,
    }: {
      issueIds: string[];
      status: IssueStatus;
    }) => {
      const results = await Promise.all(
        chunk(issueIds, MAX_BULK_ISSUES).map((part) =>
          api<BulkUpdateIssuesResult>(base(orgId, projectId), {
            method: "PATCH",
            body: { issueIds: part, status },
          }),
        ),
      );
      return { updated: results.reduce((sum, r) => sum + r.updated, 0) };
    },
    onSuccess: (_result, { issueIds, status }) =>
      applyStatusChange(
        queryClient,
        projectId,
        issueIds,
        status,
        status === "resolved" ? new Date().toISOString() : null,
      ),
    onError: () => resyncIssueLists(queryClient, projectId),
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    parts.push(items.slice(i, i + size));
  return parts;
}

/** Used by onboarding: polls every 3 seconds until the project has an issue. */
export function useHasIssues(orgId: string, projectId: string) {
  return useQuery({
    queryKey: [...issuesRoot(projectId), "first"],
    queryFn: () =>
      api<Paginated<PublicIssue>>(`${base(orgId, projectId)}?limit=1`),
    refetchInterval: (query) =>
      query.state.data?.items.length ? false : 3_000,
    select: (page) => page.items.length > 0,
  });
}

export function useIssue(orgId: string, projectId: string, issueId: string) {
  return useQuery({
    queryKey: [...issuesRoot(projectId), "detail", issueId] as const,
    queryFn: () => api<IssueDetail>(`${base(orgId, projectId)}/${issueId}`),
    enabled: !!orgId && !!projectId && !!issueId,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
}
