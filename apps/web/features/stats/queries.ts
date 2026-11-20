import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ProjectOverview, StatsRange } from "@errwise/shared";
import { api } from "@/lib/api";

export const statsRoot = (projectId: string) =>
  ["projects", projectId, "stats"] as const;

export function useProjectOverview(
  orgId: string,
  projectId: string,
  range: StatsRange,
) {
  return useQuery({
    queryKey: [...statsRoot(projectId), "overview", range] as const,
    queryFn: () =>
      api<ProjectOverview>(
        `/organizations/${orgId}/projects/${projectId}/stats/overview?range=${range}`,
      ),
    enabled: !!orgId && !!projectId,
    // Counts move slowly, so a minute-old answer is fine and tab switches stay instant.
    staleTime: 60_000,
    // Changing the range keeps the old charts on screen instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  });
}
