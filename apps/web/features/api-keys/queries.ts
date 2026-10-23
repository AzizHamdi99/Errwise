import { useMutation } from "@tanstack/react-query";
import type { CreatedApiKey } from "@errwise/shared";
import { api } from "@/lib/api";

export function useCreateApiKey(orgId: string) {
  return useMutation({
    mutationFn: ({
      projectId,
      name = "Default",
    }: {
      projectId: string;
      name?: string;
    }) =>
      api<CreatedApiKey>(
        `/organizations/${orgId}/projects/${projectId}/api-keys`,
        {
          method: "POST",
          body: { name },
        },
      ),
    // The response holds the raw key: don't keep it in the mutation cache.
    gcTime: 0,
  });
}
