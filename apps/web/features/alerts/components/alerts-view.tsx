"use client";

import { Bell, FolderPlus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Eyebrow } from "@/components/shared/eyebrow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/features/organizations/use-current-org";
import { useMySubscriptions, useProjects } from "@/features/projects/queries";
import { getErrorMessage } from "@/lib/api";
import { AlertRow } from "./alert-row";

export function AlertsView() {
  const { org } = useCurrentOrg();
  const projects = useProjects(org?.id ?? "");
  const subscriptions = useMySubscriptions(org?.id ?? "");

  if (!org) return null; // OrgGate guarantees this never happens

  // No row means "not subscribed", same as the project page.
  const onFor = new Set(
    (subscriptions.data ?? [])
      .filter((item) => item.emailNewIssues)
      .map((item) => item.projectId),
  );

  const failed = projects.isError || subscriptions.isError;
  const loading = projects.isPending || subscriptions.isPending;
  const list = projects.data ?? [];

  let body: React.ReactNode;
  if (failed) {
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load your alerts"
        description={getErrorMessage(projects.error ?? subscriptions.error)}
        action={
          <Button
            variant="outline"
            onClick={() => {
              void projects.refetch();
              void subscriptions.refetch();
            }}
          >
            Try again
          </Button>
        }
      />
    );
  } else if (loading) {
    body = (
      <div aria-busy="true" className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  } else if (list.length === 0) {
    body = (
      <EmptyState
        icon={FolderPlus}
        title="No projects yet"
        description="Create a project, then choose here whether it emails you."
        action={
          <Button
            render={<Link href={`/organizations/${org.id}/projects`} />}
            nativeButton={false}
          >
            Go to projects
          </Button>
        }
      />
    );
  } else {
    const count = list.filter((project) => onFor.has(project.id)).length;
    body = (
      <section aria-label="Email alerts" className="rounded-xl border bg-card">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-sm font-medium">Email alerts</h2>
          <p className="text-xs text-muted-foreground">
            On for {count} of {list.length}{" "}
            {list.length === 1 ? "project" : "projects"}
          </p>
        </header>
        <ul>
          {list.map((project) => (
            <AlertRow
              key={project.id}
              orgId={org.id}
              project={project}
              on={onFor.has(project.id)}
            />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Eyebrow>{org.name} / Workspace</Eyebrow>
        <h1 className="text-3xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Choose which projects send you an email.
        </p>
      </header>

      <p className="flex items-start gap-2 rounded-xl border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        <Bell className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          You get an email when a new issue appears in a project, and when an
          issue you had resolved comes back. These choices are yours only:
          teammates set their own.
        </span>
      </p>

      {body}
    </div>
  );
}
