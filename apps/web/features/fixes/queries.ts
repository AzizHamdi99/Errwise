import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicIssueFix } from "@errwise/shared";
import { issuesRoot } from "@/features/issues/queries";
import { ApiError, api } from "@/lib/api";

const path = (orgId: string, projectId: string, issueId: string) =>
  `/organizations/${orgId}/projects/${projectId}/issues/${issueId}/fix`;

/** Every fix of a project: removed when the project stops allowing them (the API wipes them). */
export const fixesRoot = (projectId: string) =>
  [...issuesRoot(projectId), "fix"] as const;

export const fixKey = (projectId: string, issueId: string) =>
  [...fixesRoot(projectId), issueId] as const;

/**
 * `null` means nobody has asked for a fix of this issue yet (the API answers 404). Pass
 * `enabled` = the project's switch: a project that has not opted in never calls the API.
 */
export function useIssueFix(
  orgId: string,
  projectId: string,
  issueId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: fixKey(projectId, issueId),
    queryFn: async () => {
      try {
        return await api<PublicIssueFix>(path(orgId, projectId, issueId));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: enabled && !!orgId && !!projectId && !!issueId,
    // Short, because a switch turned off elsewhere removes the code on the server.
    staleTime: 30_000,
    retry: 1,
  });
}

/** Asks the AI once. A repeat for the same error and code is free: the API returns the stored one. */
export function useSuggestFix(
  orgId: string,
  projectId: string,
  issueId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<PublicIssueFix>(path(orgId, projectId, issueId), { method: "POST" }),
    onSuccess: (fix) =>
      queryClient.setQueryData(fixKey(projectId, issueId), fix),
  });
}

/** Owner or admin. Sends no body: the API opens the pull request with the change it stored. */
export function useOpenFixPullRequest(
  orgId: string,
  projectId: string,
  issueId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fixId: string) =>
      api<PublicIssueFix>(
        `${path(orgId, projectId, issueId)}/${fixId}/pull-request`,
        {
          method: "POST",
        },
      ),
    onSuccess: (fix) =>
      queryClient.setQueryData(fixKey(projectId, issueId), fix),
  });
}
