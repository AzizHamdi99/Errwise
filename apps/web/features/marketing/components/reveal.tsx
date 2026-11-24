"use client";

import * as m from "motion/react-m";

interface Props {
  children: React.ReactNode;
  className?: string;
  /** Seconds, to stagger siblings. */
  delay?: number;
}

/** Fades and slides in once, when scrolled into view. `data-reveal` is the no-JavaScript hook. */
export function Reveal({ children, className, delay = 0 }: Props) {
  return (
    <m.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
