"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export function Counter({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 2,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) return setN(value);
    const c = animate(0, value, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: setN });
    return () => c.stop();
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {n.toFixed(decimals)}
      {suffix}
    </span>
  );
}
