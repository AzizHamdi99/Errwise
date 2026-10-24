"use client";

import { Eyebrow } from "@/components/shared/eyebrow";
import { getPlatform } from "../platforms";
import { useCurrentProject } from "../use-current-project";
import { ProjectTabs } from "./project-tabs";

interface Props {
  title: string;
  description: string;
  /** Text after the project name in the small label. Defaults to the platform. */
  kind?: string;
  actions?: React.ReactNode;
}

export function ProjectPageHeader({
  title,
  description,
  kind,
  actions,
}: Props) {
  const { org, project } = useCurrentProject();
  if (!org || !project) return null;

  return (
    <header className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Eyebrow>
            {project.name} / {kind ?? getPlatform(project.platform).label}
          </Eyebrow>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions}
      </div>
      <ProjectTabs orgId={org.id} projectId={project.id} />
    </header>
  );
}
