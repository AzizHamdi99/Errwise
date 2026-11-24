"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const EVERY_MS = 2_200;
const MAX_COUNT = 9;

const CODE = [
  "const user = users.get(id);",
  "",
  "return {",
  "  name: user.name,",
  "};",
];
const FAILING_LINE = 3;

/** Decorative: the steps next to it say the same thing in words. */
export function CrashDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion();
  const [run, setRun] = useState(0);
  const [count, setCount] = useState(1);

  // Only while visible, so a page left open does no work.
  useEffect(() => {
    if (!inView || reduced) return;
    const timer = setInterval(() => setRun((value) => value + 1), EVERY_MS);
    return () => clearInterval(timer);
  }, [inView, reduced]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="grid items-center md:grid-cols-[1fr_8rem_1fr]"
    >
      <div className="overflow-hidden rounded-xl border bg-card">
        <p className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
          users.service.ts
        </p>
        <pre className="overflow-hidden p-4 font-mono text-[13px] leading-6">
          {CODE.map((line, index) => (
            <span
              key={index}
              className={
                index === FAILING_LINE
                  ? "-mx-4 block bg-destructive/10 px-4 text-destructive"
                  : "block"
              }
            >
              {line || " "}
            </span>
          ))}
        </pre>
      </div>

      {/* The lane: horizontal on desktop, vertical on a phone */}
      <div className="relative h-20 [--fly-x:0rem] [--fly-y:3.5rem] md:h-10 md:[--fly-x:7rem] md:[--fly-y:0rem]">
        <span className="absolute inset-y-0 left-1/2 w-px bg-border md:inset-x-0 md:inset-y-auto md:top-1/2 md:left-0 md:h-px md:w-full" />
        {run > 0 ? (
          <span
            key={run}
            className="fly absolute top-1 left-1/2 -ml-2 size-4 rounded-full bg-destructive md:top-1/2 md:left-0 md:-mt-2 md:ml-0"
            onAnimationEnd={() =>
              setCount((value) => (value % MAX_COUNT) + 1)
            }
          />
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <p className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
          Issues
        </p>
        <div className="flex items-center gap-4 p-4">
          <span className="size-2 shrink-0 rounded-full bg-destructive" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[13px] text-destructive">
              TypeError: Cannot read properties of undefined
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              production · users.service.ts
            </p>
          </div>
          <span
            key={count}
            className="count-pop shrink-0 rounded-md bg-muted px-2.5 py-1 text-sm font-medium tabular-nums"
          >
            ×{count}
          </span>
        </div>
      </div>
    </div>
  );
}
