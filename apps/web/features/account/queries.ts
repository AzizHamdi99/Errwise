import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ChangePasswordInput,
  PublicSession,
  PublicUser,
  UpdateProfileInput,
} from "@errwise/shared";
import { meKey } from "@/features/auth/queries";
import { api } from "@/lib/api";

export const sessionsKey = [...meKey, "sessions"] as const;

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api<PublicUser>("/me", { method: "PATCH", body: input }),
    onSuccess: (user) => queryClient.setQueryData(meKey, user),
  });
}

/** Signs out every other device: the session list changes too. */
export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      api<void>("/me/password", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
  });
}

export const useSessions = () =>
  useQuery({
    queryKey: sessionsKey,
    queryFn: () => api<PublicSession[]>("/me/sessions"),
  });

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api<void>(`/me/sessions/${sessionId}`, { method: "DELETE" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>("/me/sessions/revoke-others", { method: "POST" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
  });
}
