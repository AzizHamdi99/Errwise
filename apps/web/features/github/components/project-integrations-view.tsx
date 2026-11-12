"use client";

import { ProjectPageHeader } from "@/features/projects/components/project-page-header";
import { useCurrentProject } from "@/features/projects/use-current-project";
import { can } from "@/lib/permissions";
import { GithubIntegrationCard } from "./github-integration-card";

export function ProjectIntegrationsView() {
  const { org, project } = useCurrentProject();
  if (!org || !project) return null; // ProjectGate guarantees this never happens

  return (
    <div className="space-y-8">
      <ProjectPageHeader
        title="Integrations"
        description="Connect Errwise to the tools your team already uses."
        kind="Project"
      />
      <div className="max-w-2xl space-y-6">
        {/* key: switching project remounts the card with fresh state */}
        <GithubIntegrationCard
          key={project.id}
          orgId={org.id}
          projectId={project.id}
          canManage={can(org.role, "github.manage")}
        />
      </div>
    </div>
  );
}
