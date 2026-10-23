import { AppShell } from "@/components/layout/app-shell";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { Suspense } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <RequireAuth>
        <AppShell>{children}</AppShell>
      </RequireAuth>
    </Suspense>
  );
}
