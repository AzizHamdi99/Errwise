import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  IssueStats,
  OrgOverview,
  ProjectOverview,
  ReleasesOverview,
  StatsRange,
} from "@errwise/shared";
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

export const orgStatsRoot = (orgId: string) =>
  ["organizations", orgId, "stats"] as const;

export function useOrgOverview(orgId: string, range: StatsRange) {
  return useQuery({
    queryKey: [...orgStatsRoot(orgId), "overview", range] as const,
    queryFn: () =>
      api<OrgOverview>(`/organizations/${orgId}/stats/overview?range=${range}`),
    enabled: !!orgId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useIssueStats(
  orgId: string,
  projectId: string,
  issueId: string,
  range: StatsRange,
) {
  return useQuery({
    queryKey: [...statsRoot(projectId), "issue", issueId, range] as const,
    queryFn: () =>
      api<IssueStats>(
        `/organizations/${orgId}/projects/${projectId}/issues/${issueId}/stats?range=${range}`,
      ),
    enabled: !!orgId && !!projectId && !!issueId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useReleases(
  orgId: string,
  projectId: string,
  range: StatsRange,
) {
  return useQuery({
    queryKey: [...statsRoot(projectId), "releases", range] as const,
    queryFn: () =>
      api<ReleasesOverview>(
        `/organizations/${orgId}/projects/${projectId}/stats/releases?range=${range}`,
      ),
    enabled: !!orgId && !!projectId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
