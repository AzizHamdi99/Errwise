import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PublicMember, UpdateMemberRoleInput } from "@errwise/shared";
import { api } from "@/lib/api";

export const membersKey = (orgId: string) =>
  ["orgs", orgId, "members"] as const;
const base = (orgId: string) => `/organizations/${orgId}/members`;

export const useMembers = (orgId: string) =>
  useQuery({
    queryKey: membersKey(orgId),
    queryFn: () => api<PublicMember[]>(base(orgId)),
    enabled: !!orgId,
  });

export function useChangeRole(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      role,
    }: { userId: string } & UpdateMemberRoleInput) =>
      api<PublicMember>(`${base(orgId)}/${userId}`, {
        method: "PATCH",
        body: { role },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: membersKey(orgId) }),
  });
}

/** Used both to remove someone and to leave (removing yourself). */
export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<void>(`${base(orgId)}/${userId}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: membersKey(orgId) }),
  });
}
