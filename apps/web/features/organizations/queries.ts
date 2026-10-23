import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateOrganizationInput,
  PublicOrganization,
} from "@errwise/shared";
import { api } from "@/lib/api";

export const orgKeys = { list: ["organizations"] as const };

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) =>
      api<PublicOrganization>("/organizations", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgKeys.list }),
  });
}
