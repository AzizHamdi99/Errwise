"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { loginSchema } from "@errwise/shared";
import type { LoginInput } from "@errwise/shared";
import { Field } from "@/components/shared/field";
import { PasswordInput } from "@/components/shared/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, getErrorMessage } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";
import { safeNext } from "@/lib/safe-redirect";
import { useLogin } from "../queries";
import { authHref } from "@/lib/auth-links";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next");
  const sessionExpired = params.get("expired") === "1";
  const invitedEmail = params.get("email") ?? "";
  useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: invitedEmail, password: "" },
  });

  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: () => router.replace(safeNext(rawNext)),
      onError: (error) => {
        if (applyFieldErrors(error, setError)) return;
        // never say which of the two was wrong
        setFormError(
          error instanceof ApiError && error.status === 401
            ? "Invalid email or password."
            : getErrorMessage(error),
        );
      },
    });
  });

  // const registerHref = rawNext
  //   ? `/register?next=${encodeURIComponent(rawNext)}`
  //   : "/register";
  const registerHref = authHref("/register", {
    next: rawNext,
    email: invitedEmail,
  });

  return (
    <div className="space-y-6">
      {sessionExpired ? (
        <Alert>
          <AlertDescription>
            Your session expired. Please log in again.
          </AlertDescription>
        </Alert>
      ) : null}

      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
        </Field>

        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Logging in…
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>

      <div className="border-t pt-6 text-sm text-muted-foreground">
        No account yet?{" "}
        <Link
          href={registerHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
