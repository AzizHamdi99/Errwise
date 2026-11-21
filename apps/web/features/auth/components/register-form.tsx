"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { registerSchema } from "@errwise/shared";
import type { RegisterInput, RegisterResult } from "@errwise/shared";
import { Field } from "@/components/shared/field";
import { PasswordInput } from "@/components/shared/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, getErrorMessage } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";
import { useRegister } from "../queries";
import { PasswordStrength } from "./password-strength";
import { authHref } from "@/lib/auth-links";
import { CheckInbox } from "./check-inbox";
import { GoogleButton, OrDivider } from "./google-button";

export function RegisterForm() {
  const params = useSearchParams();
  const rawNext = params.get("next");
  const invitedEmail = params.get("email") ?? "";

  const registerUser = useRegister();
  const [formError, setFormError] = useState<string | null>(null);
  // Set once the account exists. Registering does not sign in: the email has to be verified first.
  const [registered, setRegistered] = useState<RegisterResult | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: invitedEmail, password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    registerUser.mutate(values, {
      onSuccess: setRegistered,
      onError: (error) => {
        if (applyFieldErrors(error, setError)) return;
        if (error instanceof ApiError && error.status === 409) {
          setError("email", { message: "This email is already registered." });
          return;
        }
        setFormError(getErrorMessage(error));
      },
    });
  });

  const loginHref = authHref("/login", { next: rawNext, email: invitedEmail });

  if (registered) {
    return (
      <CheckInbox
        email={registered.email}
        emailSent={registered.verificationEmailSent}
        loginHref={authHref("/login", {
          next: rawNext,
          email: registered.email,
        })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Start collecting errors with your team.
        </p>
      </header>

      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field
          label="Name (optional)"
          htmlFor="name"
          error={errors.name?.message}
        >
          <Input
            id="name"
            placeholder="Jane Developer"
            autoComplete="name"
            autoFocus
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            // an empty name is sent as "not provided", not as ""
            {...register("name", {
              setValueAs: (v: string) => v.trim() || undefined,
            })}
          />
        </Field>

        <Field
          label="Email"
          htmlFor="email"
          error={errors.email?.message}
          hint={
            invitedEmail
              ? "This invitation was sent to this address."
              : undefined
          }
        >
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            readOnly={!!invitedEmail}
            className={invitedEmail ? "text-muted-foreground" : undefined}
            aria-invalid={!!errors.email}
            aria-describedby={
              errors.email
                ? "email-error"
                : invitedEmail
                  ? "email-hint"
                  : undefined
            }
            {...register("email")}
          />
        </Field>

        <div className="space-y-3">
          <Field
            label="Password"
            htmlFor="password"
            error={errors.password?.message}
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
          </Field>
          <PasswordStrength password={watch("password")} />
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          By creating an account, you agree to use Errwise responsibly.
        </p>

        <Button
          type="submit"
          className="w-full"
          disabled={registerUser.isPending}
        >
          {registerUser.isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={loginHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>

      {/* Google can return a different email than the invited one, so hide it for invitations */}
      {!invitedEmail ? (
        <>
          <OrDivider />
          <GoogleButton label="Sign up with Google" />
        </>
      ) : null}
    </div>
  );
}
