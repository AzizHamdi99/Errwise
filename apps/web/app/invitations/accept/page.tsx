import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptInvitationView } from "@/features/invitations/components/accept-invitation-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Accept invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AcceptInvitationPage() {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_30%,rgb(123_87_242/0.16),transparent_70%)]"
      />
      <div className="relative flex w-full justify-center">
        {/* useSearchParams needs a Suspense boundary */}
        <Suspense
          fallback={
            <Skeleton className="h-[26rem] w-full max-w-md rounded-2xl" />
          }
        >
          <AcceptInvitationView />
        </Suspense>
      </div>
    </main>
  );
}
