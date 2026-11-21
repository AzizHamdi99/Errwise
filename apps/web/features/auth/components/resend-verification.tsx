"use client";

import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api";
import { useResendVerification } from "../queries";
import { useCountdown } from "../use-countdown";

/**
 * How long the button waits between two sends. It matches the server's default cooldown
 * (EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS); the server decides, this only avoids pointless clicks.
 */
const COOLDOWN_SECONDS = 60;

interface Props {
  email: string;
  /** True right after an email was sent: the button starts out waiting. */
  justSent?: boolean;
}

export function ResendVerification({ email, justSent = false }: Props) {
  const resend = useResendVerification();
  const { remaining, start } = useCountdown();

  useEffect(() => {
    if (justSent) start(COOLDOWN_SECONDS);
  }, [justSent, start]);

  const waiting = remaining > 0;

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={waiting || resend.isPending}
        onClick={() =>
          resend.mutate(email, { onSuccess: () => start(COOLDOWN_SECONDS) })
        }
      >
        {resend.isPending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : null}
        {waiting ? `Send again in ${remaining}s` : "Send the email again"}
      </Button>

      {/* The answer is the same whether or not the address has an account, so the text says "if". */}
      {resend.isSuccess ? (
        <p role="status" className="text-sm text-muted-foreground">
          If this address is waiting for verification, we sent a new link. The
          previous one no longer works.
        </p>
      ) : null}
      {resend.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {getErrorMessage(resend.error)}
        </p>
      ) : null}
    </div>
  );
}
