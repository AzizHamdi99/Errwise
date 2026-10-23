import { useQuery } from "@tanstack/react-query";
import type { Paginated, PublicIssue } from "@errwise/shared";
import { api } from "@/lib/api";

export function useHasIssues(orgId: string, projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "issues", "first"],
    queryFn: () =>
      api<Paginated<PublicIssue>>(
        `/organizations/${orgId}/projects/${projectId}/issues?limit=1`,
      ),
    refetchInterval: (query) =>
      query.state.data?.items.length ? false : 3_000,
    select: (page) => page.items.length > 0,
  });
}
