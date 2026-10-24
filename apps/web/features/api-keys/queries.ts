import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatedApiKey, PublicApiKey } from "@errwise/shared";
import { api } from "@/lib/api";

export const apiKeysKey = (projectId: string) =>
  ["projects", projectId, "api-keys"] as const;
const base = (orgId: string, projectId: string) =>
  `/organizations/${orgId}/projects/${projectId}/api-keys`;

export const useApiKeys = (orgId: string, projectId: string) =>
  useQuery({
    queryKey: apiKeysKey(projectId),
    queryFn: () => api<PublicApiKey[]>(base(orgId, projectId)),
    enabled: !!orgId && !!projectId,
  });

export function useCreateApiKey(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      name = "Default",
    }: {
      projectId: string;
      name?: string;
    }) =>
      api<CreatedApiKey>(base(orgId, projectId), {
        method: "POST",
        body: { name },
      }),
    onSuccess: (_key, { projectId }) =>
      queryClient.invalidateQueries({ queryKey: apiKeysKey(projectId) }),
    // The response holds the raw key: don't keep it in the mutation cache.
    gcTime: 0,
  });
}

export function useRevokeApiKey(orgId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) =>
      api<void>(`${base(orgId, projectId)}/${keyId}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: apiKeysKey(projectId) }),
  });
}
