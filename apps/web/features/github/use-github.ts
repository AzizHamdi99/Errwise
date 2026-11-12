import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CompleteGithubInstallationInput,
  GithubConnection,
  GithubInstallResult,
  GithubInstallUrl,
  GithubRepo,
  GithubIssueLink,
} from "@errwise/shared";
import { api } from "@/lib/api";
import { issuesRoot } from "@/features/issues/queries";

const base = (orgId: string, projectId: string) =>
  `/organizations/${orgId}/projects/${projectId}/github`;

export const githubKey = (orgId: string, projectId: string) =>
  ["orgs", orgId, "projects", projectId, "github"] as const;

export const githubReposKey = (orgId: string, projectId: string) =>
  [...githubKey(orgId, projectId), "repositories"] as const;

/** Visible to every member. */
export const useGithubConnection = (orgId: string, projectId: string) =>
  useQuery({
    queryKey: githubKey(orgId, projectId),
    queryFn: () => api<GithubConnection>(base(orgId, projectId)),
    enabled: !!orgId && !!projectId,
  });

/** Owner only: pass `enabled` = installed && canManage so members never call it. */
export const useGithubRepositories = (
  orgId: string,
  projectId: string,
  enabled: boolean,
) =>
  useQuery({
    queryKey: githubReposKey(orgId, projectId),
    queryFn: () => api<GithubRepo[]>(`${base(orgId, projectId)}/repositories`),
    enabled: enabled && !!orgId && !!projectId,
    staleTime: 60_000,
  });

/** Asks the API for the GitHub install URL, then sends the owner there. */
export const useStartGithubConnect = (orgId: string, projectId: string) =>
  useMutation({
    mutationFn: () =>
      api<GithubInstallUrl>(`${base(orgId, projectId)}/install-url`, {
        method: "POST",
      }),
    onSuccess: ({ url }) => window.location.assign(url),
  });

export function useSelectGithubRepo(orgId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repo: string) =>
      api<GithubConnection>(`${base(orgId, projectId)}/repository`, {
        method: "PUT",
        body: { repo },
      }),
    onSuccess: (connection) =>
      queryClient.setQueryData(githubKey(orgId, projectId), connection),
  });
}

export function useDisconnectGithub(orgId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>(base(orgId, projectId), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData<GithubConnection>(githubKey(orgId, projectId), {
        installed: false,
        repo: null,
      });
      queryClient.removeQueries({ queryKey: githubReposKey(orgId, projectId) });
    },
  });
}

/** Not scoped to a project: the callback page only knows the signed state. */
export function useCompleteGithubInstallation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteGithubInstallationInput) =>
      api<GithubInstallResult>("/integrations/github/complete", {
        method: "POST",
        body: input,
      }),
    onSuccess: ({ organizationId, projectId }) =>
      queryClient.invalidateQueries({
        queryKey: githubKey(organizationId, projectId),
      }),
  });
}

/** Any member can call it. The API returns the existing link if one already exists. */
export function useCreateGithubIssue(orgId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (issueId: string) =>
      api<GithubIssueLink>(
        `/organizations/${orgId}/projects/${projectId}/issues/${issueId}/github`,
        { method: "POST" },
      ),
    // Refetch the detail so `issue.github` fills in and the button becomes a link.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: issuesRoot(projectId) }),
  });
}
