"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { resetPasswordSchema } from "@errwise/shared";
import { Field } from "@/components/shared/field";
import { PasswordInput } from "@/components/shared/password-input";
import { Button } from "@/components/ui/button";
import { ApiError, getErrorMessage } from "@/lib/api";
import { useResetPassword } from "../queries";
import { BackToLogin } from "./forgot-password-form";
import { PasswordStrength } from "./password-strength";

// The token comes from the address, not from the form: only the password is typed.
const formSchema = resetPasswordSchema.pick({ password: true });
type FormValues = { password: string };

export function ResetPasswordView() {
  const params = useSearchParams();
  // Read once: the token is removed from the address bar below, and useSearchParams follows it.
  const [token] = useState(() => params.get("token"));

  useEffect(() => {
    // The link is a secret: keep it out of the address bar, the history and any Referer header.
    if (token) window.history.replaceState(null, "", window.location.pathname);
  }, [token]);

  if (!token) return <InvalidLink />;
  return <ResetForm token={token} />;
}

function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const reset = useResetPassword();
  const [linkInvalid, setLinkInvalid] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = handleSubmit(({ password }) =>
    reset.mutate(
      { token, password },
      {
        onSuccess: () => router.replace("/login?reset=1"),
        // 400 means unknown, expired or already used. Anything else did not use the link.
        onError: (error) => {
          if (error instanceof ApiError && error.status === 400) {
            setLinkInvalid(true);
          }
        },
      },
    ),
  );

  if (linkInvalid) return <InvalidLink />;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">
          Choose a new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Saving it signs you out of every device. You will log in again with
          the new password.
        </p>
      </header>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Field
          label="New password"
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
        </Field>
        <PasswordStrength password={watch("password")} />

        {reset.isError && !linkInvalid ? (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(reset.error)}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={reset.isPending}>
          {reset.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : null}
          Save new password
        </Button>
      </form>

      <BackToLogin />
    </div>
  );
}

/** A link works once and expires: the way out is a new one. */
function InvalidLink() {
  return (
    <div className="space-y-6">
      <TriangleAlert className="size-8 text-destructive" aria-hidden />
      <header className="space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">
          This link is invalid or has expired
        </h1>
        <p className="text-sm text-muted-foreground">
          A reset link works once and for one hour. Ask for a new one.
        </p>
      </header>
      <Button
        render={<Link href="/forgot-password" />}
        nativeButton={false}
        className="w-full"
      >
        Send me a new link
      </Button>
      <BackToLogin />
    </div>
  );
}
