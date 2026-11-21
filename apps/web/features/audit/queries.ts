import { useInfiniteQuery } from "@tanstack/react-query";
import type { AuditAction, Paginated, PublicAuditEntry } from "@errwise/shared";
import { api } from "@/lib/api";

export const auditLogKey = (orgId: string, action: AuditAction | null) =>
  ["orgs", orgId, "audit-log", action ?? "all"] as const;

/** Newest first. The log only grows, so it is read on demand: no polling. */
export function useAuditLog(
  orgId: string,
  action: AuditAction | null,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: auditLogKey(orgId, action),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (action) params.set("action", action);
      if (pageParam) params.set("cursor", pageParam);
      const query = params.toString();
      return api<Paginated<PublicAuditEntry>>(
        `/organizations/${orgId}/audit-log${query ? `?${query}` : ""}`,
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && !!orgId,
  });
}
