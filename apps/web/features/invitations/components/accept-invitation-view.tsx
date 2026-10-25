"use client";

import { CheckCircle2, Link2Off, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { PublicOrganization } from "@errwise/shared";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogout, useMe } from "@/features/auth/queries";
import { ApiError, getErrorMessage } from "@/lib/api";
import { authHref } from "@/lib/auth-links";
import { setLastOrgId } from "@/lib/last-org";
import {
  isTokenShape,
  useAcceptInvitation,
  usePreviewInvitation,
} from "../queries";
import { InvitationCard } from "./invitation-card";

const workspaceHref = (org: PublicOrganization) =>
  `/organizations/${org.id}/projects`;
const isStatus = (error: unknown, ...statuses: number[]) =>
  error instanceof ApiError && statuses.includes(error.status);

export function AcceptInvitationView() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const preview = usePreviewInvitation(token);
  const me = useMe();
  const accept = useAcceptInvitation();
  const [joined, setJoined] = useState<PublicOrganization | null>(null);

  const next = `/invitations/accept?token=${encodeURIComponent(token)}`;
  const invitation = preview.data;
  const logout = useLogout(
    authHref("/login", { next, email: invitation?.email }),
  );

  useEffect(() => {
    if (!joined) return;
    const timer = setTimeout(() => router.replace(workspaceHref(joined)), 1500);
    return () => clearTimeout(timer);
  }, [joined, router]);

  if (joined) return <JoinedCard org={joined} />;

  // one friendly message for a missing, unknown, used, revoked or expired link
  if (
    !isTokenShape(token) ||
    isStatus(preview.error, 400, 404) ||
    isStatus(accept.error, 404)
  ) {
    return <InvalidInvitation />;
  }

  if (!invitation) {
    return preview.isError ? (
      <div className="w-full max-w-md">
        <EmptyState
          icon={TriangleAlert}
          title="Couldn't load this invitation"
          description={getErrorMessage(preview.error)}
          className="bg-card"
          action={
            <Button variant="outline" onClick={() => preview.refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    ) : (
      <Skeleton
        className="h-[26rem] w-full max-w-md rounded-2xl"
        aria-busy="true"
      />
    );
  }

  const user = me.data;
  const matches =
    !!user && user.email.toLowerCase() === invitation.email.toLowerCase();

  function handleAccept() {
    accept.mutate(token, {
      onSuccess: (org) => {
        setLastOrgId(org.id);
        toast.success(`You joined ${org.name}`);
        setJoined(org);
      },
    });
  }

  let actions: React.ReactNode;
  if (me.isPending) {
    actions = <Skeleton className="h-9 w-48" aria-busy="true" />;
  } else if (!user) {
    // logged out: the email travels in the link, and the register form locks it
    actions = (
      <div className="flex flex-wrap gap-3">
        <Link
          href={authHref("/register", { next, email: invitation.email })}
          className={buttonVariants()}
        >
          Create account
        </Link>
        <Link
          href={authHref("/login", { next, email: invitation.email })}
          className={buttonVariants({ variant: "outline" })}
        >
          Log in
        </Link>
      </div>
    );
  } else if (matches) {
    actions = (
      <>
        {accept.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{getErrorMessage(accept.error)}</AlertDescription>
          </Alert>
        ) : null}
        <Button onClick={handleAccept} disabled={accept.isPending}>
          {accept.isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Joining…
            </>
          ) : (
            "Accept invitation"
          )}
        </Button>
      </>
    );
  } else {
    actions = (
      <>
        <Alert role="alert">
          <AlertDescription>
            This invitation was sent to {invitation.email}, but you are logged
            in as {user.email}.
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          {logout.isPending ? "Logging out…" : "Log out and switch account"}
        </Button>
      </>
    );
  }

  return <InvitationCard preview={invitation}>{actions}</InvitationCard>;
}

function InvalidInvitation() {
  return (
    <div className="w-full max-w-md">
      <EmptyState
        icon={Link2Off}
        title="This invitation isn't valid"
        description="This invitation is invalid or has expired. Ask the person who invited you to send a new one."
        className="bg-card"
        action={
          <Link
            href="/organizations"
            className={buttonVariants({ variant: "outline" })}
          >
            Go to dashboard
          </Link>
        }
      />
    </div>
  );
}

function JoinedCard({ org }: { org: PublicOrganization }) {
  return (
    <section
      role="status"
      className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-[0_0_60px_-24px_var(--primary)]"
    >
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
        <CheckCircle2
          className="size-6 motion-safe:animate-in motion-safe:zoom-in-50"
          aria-hidden
        />
      </span>
      <h1 className="mt-5 text-2xl font-medium tracking-tight">
        You joined {org.name}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Taking you to your workspace…
      </p>
      <Link href={workspaceHref(org)} className={`${buttonVariants()} mt-6`}>
        Open workspace
      </Link>
    </section>
  );
}
