import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordView } from "@/features/auth/components/reset-password-view";

export const metadata: Metadata = {
  title: "Reset password",
  // The address of this page carries a secret token: never send it as a Referer.
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    // useSearchParams needs a Suspense boundary
    <Suspense>
      <ResetPasswordView />
    </Suspense>
  );
}
