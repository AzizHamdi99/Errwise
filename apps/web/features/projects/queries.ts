import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateProjectInput,
  PublicProject,
  UpdateProjectInput,
  PublicSubscription,
  UpdateSubscriptionInput,
} from "@errwise/shared";
import { api } from "@/lib/api";

export const projectsKey = (orgId: string) =>
  ["orgs", orgId, "projects"] as const;
const base = (orgId: string) => `/organizations/${orgId}/projects`;

export const useProjects = (orgId: string) =>
  useQuery({
    queryKey: projectsKey(orgId),
    queryFn: () => api<PublicProject[]>(base(orgId)),
    enabled: !!orgId,
  });

export function useCreateProject(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      api<PublicProject>(base(orgId), { method: "POST", body: input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectsKey(orgId) }),
  });
}

export function useUpdateProject(orgId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) =>
      api<PublicProject>(`${base(orgId)}/${projectId}`, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectsKey(orgId) }),
  });
}

export const useDeleteProject = (orgId: string, projectId: string) =>
  useMutation({
    mutationFn: () =>
      api<void>(`${base(orgId)}/${projectId}`, { method: "DELETE" }),
  });

// Separate key so project updates don't refetch subscriptions.
export const subscriptionKey = (orgId: string, projectId: string) =>
  ["orgs", orgId, "subscriptions", projectId] as const;

export const useSubscription = (orgId: string, projectId: string) =>
  useQuery({
    queryKey: subscriptionKey(orgId, projectId),
    queryFn: () =>
      api<PublicSubscription>(`${base(orgId)}/${projectId}/subscription`),
    enabled: !!orgId && !!projectId,
  });

export function useUpdateSubscription(orgId: string, projectId: string) {
  const queryClient = useQueryClient();
  const key = subscriptionKey(orgId, projectId);

  return useMutation({
    mutationFn: (input: UpdateSubscriptionInput) =>
      api<PublicSubscription>(`${base(orgId)}/${projectId}/subscription`, {
        method: "PUT",
        body: input,
      }),
    // Optimistic update: flip the button now, roll back if the request fails.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PublicSubscription>(key);
      queryClient.setQueryData<PublicSubscription>(key, {
        projectId,
        ...input,
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
