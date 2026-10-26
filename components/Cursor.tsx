"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";

/** Small dot + trailing ring that grows over links/buttons. Fine pointers only. */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [hover, setHover] = useState(false);
  const [hidden, setHidden] = useState(true);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 350, damping: 32, mass: 0.6 });
  const ry = useSpring(y, { stiffness: 350, damping: 32, mass: 0.6 });

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduce.matches) return;
    setEnabled(true);
    document.documentElement.classList.add("has-custom-cursor");

    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      setHidden(false);
      const t = e.target as Element | null;
      setHover(!!t?.closest?.('a, button, [role="button"], [data-cursor="link"], summary, label'));
    };
    const leave = () => setHidden(true);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      document.documentElement.classList.remove("has-custom-cursor");
    };
  }, [x, y]);

  if (!enabled) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]" style={{ opacity: hidden ? 0 : 1 }}>
      <motion.div
        className="absolute left-0 top-0 rounded-full border border-white/50 mix-blend-difference"
        style={{ x: rx, y: ry, translateX: "-50%", translateY: "-50%" }}
        animate={{
          width: hover ? 56 : 32,
          height: hover ? 56 : 32,
          backgroundColor: hover ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0)",
          borderColor: hover ? "rgba(250,97,20,0.8)" : "rgba(255,255,255,0.5)",
        }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="absolute left-0 top-0 size-1.5 rounded-full bg-accent"
        style={{ x, y, translateX: "-50%", translateY: "-50%" }}
      />
    </div>
  );
}
