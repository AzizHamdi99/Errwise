import { LoginForm } from "@/features/auth/components/login-form";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Log in to your Errwise workspace.
        </p>
      </header>
      {/* useSearchParams needs a Suspense boundary */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
