"use client";

import { useScroll, useTransform } from "motion/react";
import * as m from "motion/react-m";
import { useRef } from "react";

/** Leans back slightly, then flattens as it is scrolled into place. Never hides its content. */
export function TiltOnScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.9", "start 0.15"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 1], [10, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.97, 1]);

  return (
    <div ref={ref} className="relative [perspective:1600px]">
      {/* MotionConfig does not cover scroll-linked values, so reduced motion is handled in CSS */}
      <m.div
        style={{ rotateX, scale }}
        className="origin-top motion-reduce:transform-none!"
      >
        {children}
      </m.div>
    </div>
  );
}
