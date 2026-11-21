"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  DEFAULT_ISSUE_SORT,
  EVENT_LEVELS,
  ISSUE_AGES,
  ISSUE_SORTS,
  ISSUE_STATUSES,
  type EventLevel,
  type IssueAge,
  type IssueSort,
} from "@errwise/shared";

export const STATUS_FILTERS = [...ISSUE_STATUSES, "all"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

const DEFAULT_STATUS: StatusFilter = "unresolved";

export interface IssueFilters {
  status: StatusFilter;
  environment?: string;
  level?: EventLevel;
  /** The release the issue was first seen in. */
  release?: string;
  /** Only issues that came back after being resolved. */
  regressed: boolean;
  /** "New issues": first seen within this window. */
  age?: IssueAge;
  search: string;
  /** How the list is ordered. It is not a filter: clearing the filters keeps it. */
  sort: IssueSort;
}

/** True when something hides issues, so an empty list means "no match", not "no errors yet". */
export function isFiltered(filters: IssueFilters): boolean {
  return (
    !!filters.environment ||
    !!filters.level ||
    !!filters.release ||
    filters.regressed ||
    !!filters.age ||
    !!filters.search ||
    filters.status === "resolved" ||
    filters.status === "ignored"
  );
}

export function useIssueFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const filters: IssueFilters = {
    status:
      STATUS_FILTERS.find((s) => s === params.get("status")) ?? DEFAULT_STATUS,
    environment: params.get("env") ?? undefined,
    level: EVENT_LEVELS.find((l) => l === params.get("level")),
    release: params.get("release") ?? undefined,
    regressed: params.get("regressed") === "true",
    age: ISSUE_AGES.find((a) => a === params.get("age")),
    search: params.get("q") ?? "",
    sort:
      ISSUE_SORTS.find((s) => s === params.get("sort")) ?? DEFAULT_ISSUE_SORT,
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
      if ("level" in patch) set("level", patch.level);
      if ("release" in patch) set("release", patch.release);
      if ("regressed" in patch)
        set("regressed", patch.regressed ? "true" : undefined);
      if ("age" in patch) set("age", patch.age);
      if ("search" in patch) set("q", patch.search?.trim());
      if ("sort" in patch) set("sort", patch.sort, DEFAULT_ISSUE_SORT);

      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  // Keeps the sort: it is a display choice, not something that hid the issues.
  const clear = useCallback(() => {
    const next = new URLSearchParams();
    const sort = params.get("sort");
    if (sort) next.set("sort", sort);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [params, pathname, router]);

  return { filters, update, clear };
}
