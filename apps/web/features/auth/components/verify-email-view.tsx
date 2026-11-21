"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { resendVerificationSchema } from "@errwise/shared";
import type { ResendVerificationInput } from "@errwise/shared";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, getErrorMessage } from "@/lib/api";
import { useResendVerification, useVerifyEmail } from "../queries";
import { ResendVerification } from "./resend-verification";

// A new account has no organization yet: that is what the onboarding is for.
const AFTER_VERIFIED = "/login?verified=1&next=%2Fonboarding";

export function VerifyEmailView() {
  const params = useSearchParams();
  // Read once. The token is removed from the address bar below, and useSearchParams follows the
  // address, so reading it again later would find nothing.
  const [token] = useState(() => params.get("token"));
  const { mutate, status, error } = useVerifyEmail();
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true; // React runs effects twice in development: use the link only once
    mutate(token);
    // The link is a secret: keep it out of the address bar, the history and any Referer header.
    window.history.replaceState(null, "", window.location.pathname);
  }, [token, mutate]);

  if (!token) return <InvalidLink />;
  if (status === "success") return <Verified />;
  if (status === "error") {
    // 400 is the answer for a link that is unknown, expired or already used. Anything else
    // (too many requests, a server error) did not use the link, so trying again can work.
    return error instanceof ApiError && error.status === 400 ? (
      <InvalidLink />
    ) : (
      <Failed message={getErrorMessage(error)} onRetry={() => mutate(token)} />
    );
  }
  return <Verifying />;
}

function Header({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="space-y-2">
      <h1 className="text-3xl font-medium tracking-tight">{title}</h1>
      {children ? (
        <p className="text-sm text-muted-foreground">{children}</p>
      ) : null}
    </header>
  );
}

function Verifying() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
      <Header title="Verifying your email…" />
    </div>
  );
}

function Verified() {
  return (
    <div className="space-y-6">
      <CheckCircle2 className="size-8 text-primary" aria-hidden />
      <Header title="Email verified">
        Your account is active. Log in to get started.
      </Header>
      <Button
        render={<Link href={AFTER_VERIFIED} />}
        nativeButton={false}
        className="w-full"
      >
        Continue to log in
      </Button>
    </div>
  );
}

function Failed({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-6">
      <TriangleAlert className="size-8 text-destructive" aria-hidden />
      <Header title="We could not verify your email">{message}</Header>
      <Button type="button" className="w-full" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** A link works once and expires: the way out is a new one, asked for with the email address. */
function InvalidLink() {
  const resend = useResendVerification();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResendVerificationInput>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(({ email }) =>
    resend.mutate(email, { onSuccess: () => setSentTo(email) }),
  );

  return (
    <div className="space-y-6">
      <TriangleAlert className="size-8 text-destructive" aria-hidden />
      <Header title="This link is invalid or has expired">
        A link works once and expires after a while. Enter your email and we
        will send you a new one.
      </Header>

      {sentTo ? (
        <div className="space-y-4">
          <p role="status" className="text-sm text-muted-foreground">
            If <strong className="break-all text-foreground">{sentTo}</strong>{" "}
            is waiting for verification, we sent a new link.
          </p>
          <ResendVerification email={sentTo} justSent />
        </div>
      ) : (
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
          {resend.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {getErrorMessage(resend.error)}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={resend.isPending}>
            {resend.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : null}
            Send me a new link
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to log in
        </Link>
      </p>
    </div>
  );
}
