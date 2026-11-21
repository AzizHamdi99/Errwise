import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type {
  IssueDetail,
  IssueListItem,
  IssueStatus,
  Paginated,
} from "@errwise/shared";
import { filtersOfListKey, issuesListRoot, issuesRoot } from "./issues-keys";

type ListData = InfiniteData<Paginated<IssueListItem>>;

/**
 * Applies a status change to what is already in the cache, instead of invalidating it.
 *
 * Invalidating the list reloads EVERY loaded page, one request after another, for each change
 * (pressing `r` on a list with 5 pages loaded cost 5 requests). The change itself is known, so:
 *  - the rows are updated in place;
 *  - in a list that filters by another status, they are removed (they no longer belong there);
 *  - a list that should now CONTAIN rows it never loaded (the "Resolved" tab after resolving
 *    something, or the "Unresolved" tab after an undo) cannot be built from here, so it is only
 *    marked stale: it reloads when someone looks at it, not now.
 * The issue detail in the cache is updated too. Filters other than the status are not affected by
 * a status change (a regressed issue stays regressed), so they need no care.
 */
export function applyStatusChange(
  queryClient: QueryClient,
  projectId: string,
  issueIds: string[],
  status: IssueStatus,
  resolvedAt: string | null,
): void {
  const ids = new Set(issueIds);

  for (const [key, data] of queryClient.getQueriesData<ListData>({
    queryKey: issuesListRoot(projectId),
  })) {
    if (!data) continue;
    const listStatus = filtersOfListKey(projectId, key)?.status;
    const belongsHere = listStatus === "all" || listStatus === status;

    let found = 0;
    const pages = data.pages.map((page) => ({
      ...page,
      items: page.items.flatMap((item) => {
        if (!ids.has(item.id)) return [item];
        found += 1;
        return belongsHere ? [{ ...item, status, resolvedAt }] : [];
      }),
    }));

    if (found > 0) queryClient.setQueryData<ListData>(key, { ...data, pages });
    // "all" shows every status, so a row it did not load is simply not loaded yet.
    if (belongsHere && listStatus !== "all" && found < ids.size) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  }

  queryClient.setQueriesData<IssueDetail>(
    { queryKey: [...issuesRoot(projectId), "detail"] },
    (detail) =>
      detail && ids.has(detail.id) ? { ...detail, status, resolvedAt } : detail,
  );
}

/** After a request that may have changed only some issues (or failed halfway): ask the server. */
export function resyncIssueLists(
  queryClient: QueryClient,
  projectId: string,
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: issuesListRoot(projectId) });
}
