import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateInvitationInput,
  InvitationPreview,
  PublicInvitation,
  PublicOrganization,
} from "@errwise/shared";

import { orgKeys } from "@/features/organizations/queries";
import { api } from "@/lib/api";
const TOKEN_MIN = 20; // the same bounds as the API schema
const TOKEN_MAX = 200;
export const isTokenShape = (token: string) =>
  token.length >= TOKEN_MIN && token.length <= TOKEN_MAX;

export const invitationsKey = (orgId: string) =>
  ["orgs", orgId, "invitations"] as const;
const base = (orgId: string) => `/organizations/${orgId}/invitations`;

/** The API only lets owners and admins list invitations, so pass `enabled`. */
export const useInvitations = (orgId: string, enabled = true) =>
  useQuery({
    queryKey: invitationsKey(orgId),
    queryFn: () => api<PublicInvitation[]>(base(orgId)),
    enabled: enabled && !!orgId,
  });

function useInvitationMutation<TVariables, TResult>(
  orgId: string,
  fn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: invitationsKey(orgId) }),
  });
}

export const useInvite = (orgId: string) =>
  useInvitationMutation(orgId, (input: CreateInvitationInput) =>
    api<PublicInvitation>(base(orgId), { method: "POST", body: input }),
  );

export const useResendInvitation = (orgId: string) =>
  useInvitationMutation(orgId, (id: string) =>
    api<PublicInvitation>(`${base(orgId)}/${id}/resend`, { method: "POST" }),
  );

export const useRevokeInvitation = (orgId: string) =>
  useInvitationMutation(orgId, (id: string) =>
    api<void>(`${base(orgId)}/${id}`, { method: "DELETE" }),
  );

export const usePreviewInvitation = (token: string) =>
  useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: () =>
      api<InvitationPreview>("/invitations/preview", {
        method: "POST",
        body: { token },
      }),
    enabled: isTokenShape(token),
    retry: false,
    refetchOnWindowFocus: false,
  });

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api<PublicOrganization>("/invitations/accept", {
        method: "POST",
        body: { token },
      }),
    // refreshes the sidebar before the success state shows
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orgKeys.list }),
  });
}
