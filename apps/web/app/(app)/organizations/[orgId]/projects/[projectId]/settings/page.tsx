import type { Metadata } from "next";
import { ProjectSettingsView } from "@/features/projects/components/project-settings-view";
export const instant = false;

export const metadata: Metadata = { title: "Project settings" };

export default function ProjectSettingsPage() {
  return <ProjectSettingsView />;
}
