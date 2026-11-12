import type { Metadata } from "next";
import { ProjectIntegrationsView } from "@/features/github/components/project-integrations-view";

export const instant = false;

export const metadata: Metadata = { title: "Integrations" };

export default function ProjectIntegrationsPage() {
  return <ProjectIntegrationsView />;
}
