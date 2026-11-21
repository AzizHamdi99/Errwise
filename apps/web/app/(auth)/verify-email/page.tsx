import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailView } from "@/features/auth/components/verify-email-view";

export const metadata: Metadata = {
  title: "Verify your email",
  // The address of this page carries a secret token: never send it as a Referer.
  referrer: "no-referrer",
};

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailView />
    </Suspense>
  );
}
