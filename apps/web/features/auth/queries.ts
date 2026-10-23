import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, PublicUser, RegisterInput } from "@errwise/shared";
import { api } from "@/lib/api";

export const meKey = ["me"] as const;

function useAuthMutation<T>(path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: T) =>
      api<{ user: PublicUser }>(path, { method: "POST", body: input }),
    onSuccess: ({ user }) => queryClient.setQueryData(meKey, user),
  });
}

export const useLogin = () => useAuthMutation<LoginInput>("/auth/login");
export const useRegister = () =>
  useAuthMutation<RegisterInput>("/auth/register");
export const useMe = () =>
  useQuery({ queryKey: meKey, queryFn: () => api<PublicUser>("/me") });
