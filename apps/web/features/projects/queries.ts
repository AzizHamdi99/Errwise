import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateProjectInput,
  PublicProject,
  UpdateProjectInput,
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
