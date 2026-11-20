"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  DEFAULT_STATS_RANGE,
  STATS_RANGES,
  type StatsRange,
} from "@errwise/shared";

/** The range lives in the URL (?range=14d) so a view can be shared and survives a reload. */
export function useStatsRange() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const range =
    STATS_RANGES.find((value) => value === params.get("range")) ??
    DEFAULT_STATS_RANGE;

  const setRange = useCallback(
    (next: StatsRange) => {
      const query = new URLSearchParams(params.toString());
      if (next === DEFAULT_STATS_RANGE) query.delete("range");
      else query.set("range", next);
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  return { range, setRange };
}
