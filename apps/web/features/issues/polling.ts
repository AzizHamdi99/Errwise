export const ISSUES_POLL_MS = 20_000;

/**
 * Refetching an infinite query reloads EVERY loaded page, one request after another (each page
 * needs the cursor of the previous fresh one). With 10 pages loaded, a 20 s timer would cost
 * 10 requests per tick, per open tab. So the list only polls while a single page is loaded.
 * With more pages, the list still refreshes when the tab regains focus and after a mutation.
 */
export function issuesPollInterval(
  loadedPages: number | undefined,
): number | false {
  return (loadedPages ?? 1) > 1 ? false : ISSUES_POLL_MS;
}
