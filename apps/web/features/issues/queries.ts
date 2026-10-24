import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { IssueStatus, Paginated, PublicIssue } from "@errwise/shared";
import { api } from "@/lib/api";
import type { IssueFilters } from "./use-issue-filters";

export const issuesRoot = (projectId: string) =>
  ["projects", projectId, "issues"] as const;
const base = (orgId: string, projectId: string) =>
  `/organizations/${orgId}/projects/${projectId}/issues`;

function buildQuery(filters: IssueFilters, cursor?: string): string {
  const params = new URLSearchParams({ limit: "25" });
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.environment) params.set("environment", filters.environment);
  if (filters.search) params.set("search", filters.search);
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

export function useIssues(
  orgId: string,
  projectId: string,
  filters: IssueFilters,
) {
  return useInfiniteQuery({
    queryKey: [...issuesRoot(projectId), "list", filters] as const,
    queryFn: ({ pageParam }) =>
      api<Paginated<PublicIssue>>(
        `${base(orgId, projectId)}?${buildQuery(filters, pageParam)}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!orgId && !!projectId,
    // new errors show up without a reload, and polling pauses in a hidden tab
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: issuesRoot(projectId) }),
  });
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
