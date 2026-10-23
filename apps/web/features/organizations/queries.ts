import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateOrganizationInput,
  PublicOrganization,
  UpdateOrganizationInput,
} from "@errwise/shared";
import { api } from "@/lib/api";

export const orgKeys = { list: ["organizations"] as const };

export const useOrganizations = () =>
  useQuery({
    queryKey: orgKeys.list,
    queryFn: () => api<PublicOrganization[]>("/organizations"),
  });

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) =>
      api<PublicOrganization>("/organizations", {
        method: "POST",
        body: input,
      }),
    // returned promise: the list is fresh before the caller's onSuccess runs
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgKeys.list }),
  });
}

export function useUpdateOrganization(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) =>
      api<PublicOrganization>(`/organizations/${orgId}`, {
        method: "PATCH",
        body: input,
      }),
    // refreshes the sidebar switcher and the breadcrumb
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgKeys.list }),
  });
}

export const useDeleteOrganization = (orgId: string) =>
  useMutation({
    mutationFn: () =>
      api<void>(`/organizations/${orgId}`, { method: "DELETE" }),
  });
