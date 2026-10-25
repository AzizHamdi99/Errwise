import { ProjectGate } from "@/features/projects/components/project-gate";

export const instant = false;

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProjectGate>{children}</ProjectGate>;
}
