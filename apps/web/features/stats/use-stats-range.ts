"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  DEFAULT_STATS_RANGE,
  STATS_RANGES,
  type StatsRange,
} from "@errwise/shared";

/** The range lives in the URL (?range=14d) so a view can be shared and survives a reload. */
export function useStatsRange(defaultRange: StatsRange = DEFAULT_STATS_RANGE) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const range =
    STATS_RANGES.find((value) => value === params.get("range")) ?? defaultRange;

  const setRange = useCallback(
    (next: StatsRange) => {
      const query = new URLSearchParams(params.toString());
      if (next === defaultRange) query.delete("range");
      else query.set("range", next);
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    },
    [defaultRange, params, pathname, router],
  );

  return { range, setRange };
}
