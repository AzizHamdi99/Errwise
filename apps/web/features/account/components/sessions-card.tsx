"use client";

import { Loader2, Monitor } from "lucide-react";
import { toast } from "sonner";
import type { PublicSession } from "@errwise/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { describeUserAgent } from "@/lib/user-agent";
import {
  useRevokeOtherSessions,
  useRevokeSession,
  useSessions,
} from "../queries";

export function SessionsCard() {
  const sessions = useSessions();
  const revokeOthers = useRevokeOtherSessions();
  const others = sessions.data?.filter((s) => !s.current).length ?? 0;

  function onRevokeOthers() {
    revokeOthers.mutate(undefined, {
      onSuccess: () => toast.success("Signed out of every other device"),
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  }

  return (
    <section
      aria-labelledby="sessions-title"
      className="rounded-xl border bg-card p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="sessions-title" className="text-base font-medium">
            Sessions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Devices signed in to your account. Signing one out takes effect
            within 15 minutes.
          </p>
        </div>
        {others > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRevokeOthers}
            disabled={revokeOthers.isPending}
          >
            {revokeOthers.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : null}
            Sign out of all other sessions
          </Button>
        ) : null}
      </div>

      <div className="mt-6">
        {sessions.isPending ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : sessions.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(sessions.error)}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sessions.data.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SessionRow({ session }: { session: PublicSession }) {
  const revoke = useRevokeSession();

  function onRevoke() {
    revoke.mutate(session.id, {
      onSuccess: () => toast.success("Session signed out"),
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Monitor className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {describeUserAgent(session.userAgent)}
          {session.current ? (
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              This device
            </span>
          ) : null}
        </p>
        <p
          className="truncate text-xs text-muted-foreground"
          title={new Date(session.lastUsedAt).toLocaleString()}
        >
          {session.ip ?? "Unknown address"} · active{" "}
          {formatRelative(session.lastUsedAt)}
        </p>
      </div>
      {/* The current device signs out with the Log out button, which also clears the cookies. */}
      {session.current ? null : (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRevoke}
          disabled={revoke.isPending}
        >
          Sign out
        </Button>
      )}
    </li>
  );
}
