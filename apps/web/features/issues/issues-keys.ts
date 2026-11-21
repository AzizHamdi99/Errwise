import type { IssueFilters } from "./use-issue-filters";

/** The root of every cached query about the issues of one project. */
export const issuesRoot = (projectId: string) =>
  ["projects", projectId, "issues"] as const;

/** All the cached lists of a project (one per combination of filters). */
export const issuesListRoot = (projectId: string) =>
  [...issuesRoot(projectId), "list"] as const;

export const issuesListKey = (projectId: string, filters: IssueFilters) =>
  [...issuesListRoot(projectId), filters] as const;

/** Reads the filters back out of a list key, so nobody has to count positions. */
export function filtersOfListKey(
  projectId: string,
  key: readonly unknown[],
): IssueFilters | undefined {
  return key[issuesListRoot(projectId).length] as IssueFilters | undefined;
}
