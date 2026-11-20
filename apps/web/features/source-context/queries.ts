import { useQuery } from "@tanstack/react-query";
import type { SourceContextResult } from "@errwise/shared";
import { api } from "@/lib/api";

// Not under the issues root: changing an issue's status invalidates that root, and the code
// of a commit does not change when it does.
export const sourceKey = (projectId: string, eventId: string) =>
  ["projects", projectId, "source", eventId] as const;

interface Scope {
  orgId: string;
  projectId: string;
  issueId: string;
  eventId: string;
  /** Only ask when the project turned source code on and the event has a commit. */
  enabled: boolean;
}

export function useSourceContext({
  orgId,
  projectId,
  issueId,
  eventId,
  enabled,
}: Scope) {
  return useQuery({
    queryKey: sourceKey(projectId, eventId),
    queryFn: () =>
      api<SourceContextResult>(
        `/organizations/${orgId}/projects/${projectId}/issues/${issueId}/events/${eventId}/source`,
      ),
    enabled: enabled && !!orgId && !!projectId && !!issueId && !!eventId,
    // A commit never changes, so a good answer stays good. A problem (rate limit, GitHub
    // down, permission not accepted yet) must be asked again on the next visit.
    staleTime: (query) => (query.state.data?.status === "ok" ? 10 * 60_000 : 0),
    retry: 1,
  });
}
