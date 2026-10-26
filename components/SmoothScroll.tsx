"use client";

import Lenis from "lenis";
import { MotionConfig, cancelFrame, frame } from "motion/react";
import { useEffect, type ReactNode } from "react";

export function SmoothScroll({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      lerp: 0.085, // frame-rate independent smoothing; lower = silkier
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      anchors: { offset: -80 },
    });
    // Drive Lenis from Motion's frame loop so scrolling and animations update in the same frame.
    const update = ({ timestamp }: { timestamp: number }) => lenis.raf(timestamp);
    frame.update(update, true);
    return () => {
      cancelFrame(update);
      lenis.destroy();
    };
  }, []);

  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
