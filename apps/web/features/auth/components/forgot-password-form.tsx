"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { forgotPasswordSchema } from "@errwise/shared";
import type { ForgotPasswordInput } from "@errwise/shared";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api";
import { useForgotPassword } from "../queries";

export function ForgotPasswordForm() {
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(({ email }) =>
    forgot.mutate(email, { onSuccess: () => setSentTo(email) }),
  );

  if (sentTo) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <MailCheck className="size-8 text-primary" aria-hidden />
          <h1 className="text-3xl font-medium tracking-tight">
            Check your inbox
          </h1>
          {/* The same words for every address: the page never says whether it has an account. */}
          <p role="status" className="text-sm text-muted-foreground">
            If{" "}
            <strong className="break-all font-medium text-foreground">
              {sentTo}
            </strong>{" "}
            has an Errwise account, we sent it a link to choose a new password.
            The link works once and for one hour. Look in your spam folder if
            you do not see it.
          </p>
        </header>
        <BackToLogin />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">
          Forgot your password?
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the email of your account and we will send you a link to choose
          a new one.
        </p>
      </header>

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
        {forgot.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(forgot.error)}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={forgot.isPending}>
          {forgot.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : null}
          Send me a link
        </Button>
      </form>

      <BackToLogin />
    </div>
  );
}

export function BackToLogin() {
  return (
    <p className="text-center text-sm text-muted-foreground">
      <Link
        href="/login"
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        Back to log in
      </Link>
    </p>
  );
}
