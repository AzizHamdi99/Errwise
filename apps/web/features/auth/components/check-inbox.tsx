import { MailCheck } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResendVerification } from "./resend-verification";

interface Props {
  email: string;
  /** False when the account was created but the email could not be sent. */
  emailSent: boolean;
  loginHref: string;
}

/** Shown after registering: the account exists, but cannot be used until the link is opened. */
export function CheckInbox({ email, emailSent, loginHref }: Props) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <MailCheck className="size-8 text-primary" aria-hidden />
        <h1 className="text-3xl font-medium tracking-tight">
          Check your inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to{" "}
          <strong className="break-all font-medium text-foreground">
            {email}
          </strong>
          . Open it to activate your account, then sign in. If you do not see
          it, look in your spam folder.
        </p>
      </header>

      {emailSent ? null : (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            Your account was created, but we could not send the email just now.
            Please try again below.
          </AlertDescription>
        </Alert>
      )}

      <ResendVerification email={email} justSent={emailSent} />

      <p className="text-center text-sm text-muted-foreground">
        Already verified?{" "}
        <Link
          href={loginHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
