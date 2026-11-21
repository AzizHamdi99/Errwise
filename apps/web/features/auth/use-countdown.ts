"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A countdown in whole seconds, for a button that must wait before it can be used again.
 * It is measured against the clock, so it stays right if the tab was in the background.
 */
export function useCountdown() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [endsAt]);

  const start = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setEndsAt(current + seconds * 1000);
  }, []);

  const remaining =
    endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));
  return { remaining, start };
}
