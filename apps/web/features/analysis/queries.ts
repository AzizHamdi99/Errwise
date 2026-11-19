import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicIssueAnalysis } from "@errwise/shared";
import { issuesRoot } from "@/features/issues/queries";
import { ApiError, api } from "@/lib/api";

const path = (orgId: string, projectId: string, issueId: string) =>
  `/organizations/${orgId}/projects/${projectId}/issues/${issueId}/analysis`;

export const analysisKey = (projectId: string, issueId: string) =>
  [...issuesRoot(projectId), "analysis", issueId] as const;

/** `null` means nobody has asked for an analysis of this issue yet (the API answers 404). */
export function useIssueAnalysis(
  orgId: string,
  projectId: string,
  issueId: string,
) {
  return useQuery({
    queryKey: analysisKey(projectId, issueId),
    queryFn: async () => {
      try {
        return await api<PublicIssueAnalysis>(path(orgId, projectId, issueId));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: !!orgId && !!projectId && !!issueId,
    // It only changes when someone asks for a new one, so no polling.
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** Calls the AI once. A repeat for the same error is free: the API returns the stored one. */
export function useAnalyzeIssue(
  orgId: string,
  projectId: string,
  issueId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<PublicIssueAnalysis>(path(orgId, projectId, issueId), {
        method: "POST",
      }),
    onSuccess: (analysis) =>
      queryClient.setQueryData(analysisKey(projectId, issueId), analysis),
  });
}
