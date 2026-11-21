import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LoginInput,
  ResetPasswordInput,
  PublicUser,
  RegisterInput,
  RegisterResult,
} from "@errwise/shared";
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

/** Registering does not sign in: it answers whether the verification email was sent. */
export const useRegister = () =>
  useMutation({
    mutationFn: (input: RegisterInput) =>
      api<RegisterResult>("/auth/register", { method: "POST", body: input }),
  });

export const useVerifyEmail = () =>
  useMutation({
    mutationFn: (token: string) =>
      api<void>("/auth/verify-email", { method: "POST", body: { token } }),
  });

/** Always succeeds for a valid address: the answer never says whether it has an account. */
export const useResendVerification = () =>
  useMutation({
    mutationFn: (email: string) =>
      api<void>("/auth/resend-verification", {
        method: "POST",
        body: { email },
      }),
  });

/** Always succeeds for a valid address: the answer never says whether it has an account. */
export const useForgotPassword = () =>
  useMutation({
    mutationFn: (email: string) =>
      api<void>("/auth/forgot-password", { method: "POST", body: { email } }),
  });

/** Does not sign in: every session is revoked, the user logs in with the new password. */
export const useResetPassword = () =>
  useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      api<void>("/auth/reset-password", { method: "POST", body: input }),
  });

export const useMe = () =>
  useQuery({
    queryKey: meKey,
    queryFn: () => api<PublicUser>("/me"),
  });
