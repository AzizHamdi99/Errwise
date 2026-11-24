"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

/** Only the features the site uses. `strict` fails if a full `motion.*` component slips in. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
