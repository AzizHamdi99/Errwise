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

// Separate keys so project updates don't refetch subscriptions. Everything about the
// signed-in member's subscriptions sits under one root, so one invalidation refreshes
// the project page toggle and the Alerts page together.
export const subscriptionsRoot = (orgId: string) =>
  ["orgs", orgId, "subscriptions"] as const;
export const subscriptionKey = (orgId: string, projectId: string) =>
  [...subscriptionsRoot(orgId), projectId] as const;
// "mine" is not a project id (those are UUIDs), so it cannot collide with a subscriptionKey.
export const mySubscriptionsKey = (orgId: string) =>
  [...subscriptionsRoot(orgId), "mine"] as const;

export const useSubscription = (orgId: string, projectId: string) =>
  useQuery({
    queryKey: subscriptionKey(orgId, projectId),
    queryFn: () =>
      api<PublicSubscription>(`${base(orgId)}/${projectId}/subscription`),
    enabled: !!orgId && !!projectId,
  });

/** All of my subscriptions in the organization, in one request. A project that is not listed is "off". */
export const useMySubscriptions = (orgId: string) =>
  useQuery({
    queryKey: mySubscriptionsKey(orgId),
    queryFn: () =>
      api<PublicSubscription[]>(`/organizations/${orgId}/subscriptions`),
    enabled: !!orgId,
  });

export function useUpdateSubscription(orgId: string, projectId: string) {
  const queryClient = useQueryClient();
  const key = subscriptionKey(orgId, projectId);
  const listKey = mySubscriptionsKey(orgId);

  // Replaces this project's entry and leaves the others alone, so two quick toggles
  // on different rows never undo each other.
  const setInList = (entry: PublicSubscription | undefined) =>
    queryClient.setQueryData<PublicSubscription[]>(listKey, (list) => {
      if (!list) return list; // not loaded: nothing to keep in sync
      const others = list.filter((item) => item.projectId !== projectId);
      return entry ? [...others, entry] : others;
    });

  return useMutation({
    mutationFn: (input: UpdateSubscriptionInput) =>
      api<PublicSubscription>(`${base(orgId)}/${projectId}/subscription`, {
        method: "PUT",
        body: input,
      }),
    // Optimistic update: flip the button now, roll back if the request fails.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<PublicSubscription>(key);
      const previousInList = queryClient
        .getQueryData<PublicSubscription[]>(listKey)
        ?.find((item) => item.projectId === projectId);
      const next: PublicSubscription = { projectId, ...input };
      queryClient.setQueryData<PublicSubscription>(key, next);
      setInList(next);
      return { previous, previousInList };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      setInList(context?.previousInList);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: subscriptionsRoot(orgId) }),
  });
}
