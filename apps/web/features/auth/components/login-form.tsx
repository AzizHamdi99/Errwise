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
import { EMAIL_NOT_VERIFIED } from "@errwise/shared";
import { ApiError, getErrorMessage } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";
import { safeNext } from "@/lib/safe-redirect";
import { useLogin } from "../queries";
import { authHref } from "@/lib/auth-links";
import { GoogleButton, OrDivider } from "./google-button";
import { ResendVerification } from "./resend-verification";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next");
  const sessionExpired = params.get("expired") === "1";
  const googleFailed = params.get("error") === "google";
  const justVerified = params.get("verified") === "1";
  const invitedEmail = params.get("email") ?? "";

  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  // The email of an account whose password was right but whose email is not verified yet.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: invitedEmail, password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setUnverifiedEmail(null);
    login.mutate(values, {
      onSuccess: () => router.replace(safeNext(rawNext)),
      onError: (error) => {
        if (applyFieldErrors(error, setError)) return;
        // Only said after the password was right, so it does not reveal which emails exist.
        if (error instanceof ApiError && error.code === EMAIL_NOT_VERIFIED) {
          setUnverifiedEmail(values.email);
          return;
        }
        // never say which of the two was wrong
        setFormError(
          error instanceof ApiError && error.status === 401
            ? "Invalid email or password."
            : getErrorMessage(error),
        );
      },
    });
  });

  const registerHref = authHref("/register", {
    next: rawNext,
    email: invitedEmail,
  });

  return (
    <div className="space-y-6">
      {justVerified ? (
        <Alert>
          <AlertDescription>
            Email verified. You can log in now.
          </AlertDescription>
        </Alert>
      ) : null}

      {sessionExpired ? (
        <Alert>
          <AlertDescription>
            Your session expired. Please log in again.
          </AlertDescription>
        </Alert>
      ) : null}

      {googleFailed ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            Google sign-in failed. Please try again.
          </AlertDescription>
        </Alert>
      ) : null}

      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {unverifiedEmail ? (
        <div className="space-y-3">
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              Verify your email before logging in. We sent a link to{" "}
              <strong className="break-all">{unverifiedEmail}</strong> when you
              registered.
            </AlertDescription>
          </Alert>
          <ResendVerification email={unverifiedEmail} />
        </div>
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

        <Button type="submit" className="w-full" disabled={login.isPending}>
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

      <p className="text-center text-sm text-muted-foreground">
        No account yet?{" "}
        <Link
          href={registerHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Register
        </Link>
      </p>

      <OrDivider />

      <GoogleButton />
    </div>
  );
}
