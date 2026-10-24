import { useParams } from "next/navigation";
import { useCurrentOrg } from "@/features/organizations/use-current-org";
import { useProjects } from "./queries";

export function useCurrentProject() {
  const { projectId } = useParams<{ projectId?: string }>();
  const { org } = useCurrentOrg();
  const {
    data: projects,
    isPending,
    error,
    refetch,
  } = useProjects(org?.id ?? "");
  const project = projects?.find((p) => p.id === projectId) ?? null;
  return { org, project, isPending, error, refetch };
}
