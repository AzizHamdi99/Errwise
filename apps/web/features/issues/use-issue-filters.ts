"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ISSUE_STATUSES } from "@errwise/shared";

export const STATUS_FILTERS = [...ISSUE_STATUSES, "all"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

const DEFAULT_STATUS: StatusFilter = "unresolved";

export interface IssueFilters {
  status: StatusFilter;
  environment?: string;
  search: string;
}

export function useIssueFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters: IssueFilters = {
    status:
      STATUS_FILTERS.find((s) => s === params.get("status")) ?? DEFAULT_STATUS,
    environment: params.get("env") ?? undefined,
    search: params.get("q") ?? "",
  };

  const update = useCallback(
    (patch: Partial<IssueFilters>) => {
      const next = new URLSearchParams(params.toString());
      const set = (key: string, value: string | undefined, fallback = "") => {
        if (value && value !== fallback) next.set(key, value);
        else next.delete(key);
      };

      if ("status" in patch) set("status", patch.status, DEFAULT_STATUS);
      if ("environment" in patch) set("env", patch.environment);
      if ("search" in patch) set("q", patch.search?.trim());

      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  const clear = useCallback(
    () => router.replace(pathname, { scroll: false }),
    [pathname, router],
  );

  return { filters, update, clear };
}
