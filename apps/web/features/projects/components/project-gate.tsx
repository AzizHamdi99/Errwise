"use client";

import { SearchX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api";
import { useCurrentProject } from "../use-current-project";

export function ProjectGate({ children }: { children: React.ReactNode }) {
  const { org, project, isPending, error, refetch } = useCurrentProject();

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load this project"
        description={getErrorMessage(error)}
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon={SearchX}
        title="Project not found"
        description="It may have been deleted, or it belongs to another organization."
        action={
          <Button asChild variant="outline">
            <Link
              href={
                org ? `/organizations/${org.id}/projects` : "/organizations"
              }
            >
              Back to projects
            </Link>
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
