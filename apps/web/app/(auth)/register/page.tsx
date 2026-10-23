import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-medium tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Start collecting errors with your team.
        </p>
      </header>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </>
  );
}
