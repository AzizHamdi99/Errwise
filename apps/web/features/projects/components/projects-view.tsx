"use client";

import { FolderPlus, Plus, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/features/organizations/use-current-org";
import { getErrorMessage } from "@/lib/api";
import { can } from "@/lib/permissions";
import { useProjects } from "../queries";
import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectCard } from "./project-card";

const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

export function ProjectsView() {
  const { org } = useCurrentOrg();
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isPending, isError, error, refetch } = useProjects(
    org?.id ?? "",
  );

  if (!org) return null; // OrgGate guarantees this never happens

  const canWrite = can(org.role, "project.write");
  const newProject = canWrite ? (
    <Button onClick={() => setCreateOpen(true)}>
      <Plus aria-hidden />
      New project
    </Button>
  ) : null;

  let body: React.ReactNode;
  if (isPending) {
    body = (
      <div className={GRID} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  } else if (isError) {
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load projects"
        description={getErrorMessage(error)}
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else if (data.length === 0) {
    body = (
      <EmptyState
        icon={FolderPlus}
        title="No projects yet"
        description={
          canWrite
            ? "Create a project to get an API key and start collecting errors."
            : "Ask an owner of this organization to create a project."
        }
        action={newProject}
      />
    );
  } else {
    body = (
      <ul className={GRID}>
        {data.map((project) => (
          <li key={project.id}>
            <ProjectCard project={project} canEdit={canWrite} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {org.name} / Workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Services sending errors to your workspace.
          </p>
        </div>
        {canWrite ? (
          newProject
        ) : (
          <p className="text-xs text-muted-foreground">
            Only owners can create projects.
          </p>
        )}
      </header>

      {body}

      <p className="flex items-center gap-2 rounded-xl border bg-card/40 px-5 py-4 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-emerald-500" aria-hidden />
        Project data is isolated by organization. Each project uses its own API
        keys.
      </p>

      <CreateProjectDialog
        orgId={org.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
