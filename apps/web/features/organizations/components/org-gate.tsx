"use client";

import { SearchX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api";
import { setLastOrgId } from "@/lib/last-org";
import { useCurrentOrg } from "../use-current-org";

export function OrgGate({ children }: { children: React.ReactNode }) {
  const { org, isPending, error, refetch } = useCurrentOrg();

  useEffect(() => {
    if (org) setLastOrgId(org.id);
  }, [org]);

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load your organizations"
        description={getErrorMessage(error)}
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (!org) {
    return (
      <EmptyState
        icon={SearchX}
        title="Organization not found"
        description="It may not exist, or you may not be a member of it."
        action={
          <Link
            href="/organizations"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to your organizations
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}
