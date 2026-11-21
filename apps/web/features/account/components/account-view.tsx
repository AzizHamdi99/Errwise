"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/features/auth/queries";
import { PasswordCard } from "./password-card";
import { ProfileCard } from "./profile-card";
import { SessionsCard } from "./sessions-card";

export function AccountView() {
  const { data: user } = useMe();

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Personal
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">
          Your profile, your password and the devices signed in to your account.
        </p>
      </header>

      <div className="max-w-2xl space-y-6">
        {user ? (
          <>
            <ProfileCard user={user} />
            <PasswordCard user={user} />
          </>
        ) : (
          <Skeleton className="h-64 w-full rounded-xl" />
        )}
        <SessionsCard />
      </div>
    </div>
  );
}
