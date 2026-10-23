import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { OnboardingFlow } from "@/features/onbording/components/onboarding-flow";

export const metadata: Metadata = { title: "Get started" };

export default function OnboardingPage() {
  return (
    <main className="min-h-svh">
      <RequireAuth>
        <OnboardingFlow />
      </RequireAuth>
    </main>
  );
}
