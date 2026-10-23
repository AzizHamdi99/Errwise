import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateProjectInput, PublicProject } from "@errwise/shared";
import { api } from "@/lib/api";

export const projectsKey = (orgId: string) =>
  ["orgs", orgId, "projects"] as const;

export function useCreateProject(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      api<PublicProject>(`/organizations/${orgId}/projects`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectsKey(orgId) }),
  });
}
