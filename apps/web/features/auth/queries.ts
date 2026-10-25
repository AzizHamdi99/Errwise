import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginInput, PublicUser, RegisterInput } from "@errwise/shared";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export const meKey = ["me"] as const;

function useAuthMutation<T>(path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: T) =>
      api<{ user: PublicUser }>(path, {
        method: "POST",
        body: input,
      }),
    onSuccess: ({ user }) => queryClient.setQueryData(meKey, user),
  });
}

// export function useLogout() {
//   const router = useRouter();
//   const queryClient = useQueryClient();

//   return useMutation({
//     mutationFn: () => api<void>("/auth/logout", { method: "POST" }),

//     onSettled: () => {
//       queryClient.clear();
//       router.replace("/login");
//     },
//   });
// }
export function useLogout(redirectTo = "/login") {
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    // A full reload clears every cached query and avoids a refetch race.
    onSettled: () => window.location.assign(redirectTo),
  });
}

export const useLogin = () => useAuthMutation<LoginInput>("/auth/login");

export const useRegister = () =>
  useAuthMutation<RegisterInput>("/auth/register");

export const useMe = () =>
  useQuery({
    queryKey: meKey,
    queryFn: () => api<PublicUser>("/me"),
  });
