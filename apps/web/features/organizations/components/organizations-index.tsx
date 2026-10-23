"use client";

import { Building2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api";
import { getLastOrgId } from "@/lib/last-org";
import { useOrganizations } from "../queries";
import { CreateOrganizationDialog } from "./create-organization-dialog";

export function OrganizationsIndex() {
  const router = useRouter();
  const { data: orgs, isPending, error, refetch } = useOrganizations();
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!orgs?.length) return;
    const target = orgs.find((o) => o.id === getLastOrgId()) ?? orgs[0];
    router.replace(`/organizations/${target.id}/projects`);
  }, [orgs, router]);

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

  // loading, or about to redirect
  if (isPending || orgs.length > 0) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <>
      <EmptyState
        icon={Building2}
        title="Create your first organization"
        description="Organizations hold your projects and your team. Create one to start collecting errors."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            Create organization
          </Button>
        }
      />
      <CreateOrganizationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </>
  );
}
