"use client";

import { can } from "@/lib/permissions";
import { useCurrentProject } from "../use-current-project";
import { ProjectDangerZone } from "./project-danger-zone";
import { ProjectGeneralCard } from "./project-general-card";
import { ProjectPageHeader } from "./project-page-header";

export function ProjectSettingsView() {
  const { org, project } = useCurrentProject();
  if (!org || !project) return null; // ProjectGate guarantees this never happens

  const canWrite = can(org.role, "project.write");

  return (
    <div className="space-y-8">
      <ProjectPageHeader
        title="Project settings"
        description="Manage project access, keys and event retention."
        kind="Project"
      />
      <div className="max-w-2xl space-y-6">
        {/* key: switching project remounts the form with fresh values */}
        <ProjectGeneralCard
          key={project.id}
          orgId={org.id}
          project={project}
          canEdit={canWrite}
        />
        {canWrite ? (
          <ProjectDangerZone orgId={org.id} project={project} />
        ) : null}
      </div>
    </div>
  );
}
