"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { changePasswordSchema } from "@errwise/shared";
import type { ChangePasswordInput, PublicUser } from "@errwise/shared";
import { Field } from "@/components/shared/field";
import { PasswordInput } from "@/components/shared/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordStrength } from "@/features/auth/components/password-strength";
import { getErrorMessage } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";
import { useChangePassword } from "../queries";

export function PasswordCard({ user }: { user: PublicUser }) {
  return (
    <section
      aria-labelledby="password-title"
      className="rounded-xl border bg-card p-6"
    >
      <h2 id="password-title" className="text-base font-medium">
        Password
      </h2>
      {user.hasPassword ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Changing it signs you out of every other device.
          </p>
          <ChangePasswordForm />
        </>
      ) : (
        // An account created with Google has no password to check against.
        <p className="mt-1 text-sm text-muted-foreground">
          You sign in with Google, so this account has no password. To add one,
          use{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Forgot password
          </Link>{" "}
          with your email: the link lets you set it.
        </p>
      )}
    </section>
  );
}

function ChangePasswordForm() {
  const change = useChangePassword();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    change.mutate(values, {
      onSuccess: () => {
        reset();
        toast.success("Password changed. Your other devices are signed out.");
      },
      onError: (error) => {
        if (!applyFieldErrors(error, setError))
          setFormError(getErrorMessage(error));
      },
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Field
        label="Current password"
        htmlFor="current-password"
        error={errors.currentPassword?.message}
      >
        <PasswordInput
          id="current-password"
          autoComplete="current-password"
          aria-invalid={!!errors.currentPassword}
          aria-describedby={
            errors.currentPassword ? "current-password-error" : undefined
          }
          {...register("currentPassword")}
        />
      </Field>

      <Field
        label="New password"
        htmlFor="new-password"
        error={errors.newPassword?.message}
      >
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          aria-invalid={!!errors.newPassword}
          aria-describedby={
            errors.newPassword ? "new-password-error" : undefined
          }
          {...register("newPassword")}
        />
      </Field>
      <PasswordStrength password={watch("newPassword")} />

      <div className="flex justify-end">
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : null}
          Change password
        </Button>
      </div>
    </form>
  );
}
