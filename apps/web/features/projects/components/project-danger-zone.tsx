"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { PublicProject } from "@errwise/shared";
import { TypeToConfirmDialog } from "@/components/shared/type-to-confirm-dialog";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api";
import { useDeleteProject } from "../queries";

export function ProjectDangerZone({
  orgId,
  project,
}: {
  orgId: string;
  project: PublicProject;
}) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteProject(orgId, project.id);
  // after success the page is about to reload, so keep the dialog locked
  const busy = remove.isPending || remove.isSuccess;

  function handleOpenChange(next: boolean) {
    if (busy) return;
    if (!next) remove.reset();
    setOpen(next);
  }

  function confirm() {
    remove.mutate(undefined, {
      // A full load drops the cached project and avoids a flash of "Project not found".
      onSuccess: () =>
        window.location.assign(`/organizations/${orgId}/projects`),
    });
  }

  return (
    <section
      aria-labelledby="project-danger-title"
      className="rounded-xl border border-destructive/40 bg-card p-6"
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Danger zone
      </p>
      <h2
        id="project-danger-title"
        className="mt-3 text-base font-medium text-destructive"
      >
        Delete project
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The project and its API keys stop working. Apps using this project will
        stop reporting.
      </p>
      <Button
        variant="outline"
        className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
        Delete project
      </Button>

      <TypeToConfirmDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Delete project"
        description={`You are about to delete ${project.name}. This can't be undone from the dashboard.`}
        consequences={[
          "The project's API keys stop working immediately.",
          "Apps using this project stop reporting errors.",
          "Its issues and events are no longer accessible.",
        ]}
        confirmText={project.name}
        actionLabel="Delete project"
        pendingLabel="Deleting…"
        isPending={busy}
        error={remove.isError ? getErrorMessage(remove.error) : null}
        onConfirm={confirm}
      />
    </section>
  );
}
