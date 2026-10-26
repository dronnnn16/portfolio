"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useRef, type ReactNode } from "react";
import { ArrowUpRight } from "./Arrow";

type Variant = "primary" | "secondary" | "white";

const styles: Record<Variant, string> = {
  primary: "btn-primary-bg text-white",
  secondary: "liquid text-white",
  white: "bg-white text-[#100b08] shadow-[0_6px_24px_-8px_rgba(255,255,255,0.4)]",
};

const arrowWrap: Record<Variant, string> = {
  primary: "bg-white/20",
  secondary: "bg-white/10",
  white: "bg-[#100b08] text-white",
};

/** Magnetic pull towards the pointer (fine pointers only). */
export function Magnetic({ children, strength = 0.25 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 20, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 180, damping: 20, mass: 0.5 });

  return (
    <motion.span
      ref={ref}
      className="inline-flex"
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

/**
 * Pill button. On hover the label rolls up (duplicated label slides in from below)
 * and the arrow exits top-right while a copy enters from bottom-left.
 */
export function Button({
  href,
  children,
  variant = "primary",
  size = "md",
  arrow = true,
  className = "",
  external,
}: {
  href: string;
  children: string;
  variant?: Variant;
  size?: "sm" | "md";
  arrow?: boolean;
  className?: string;
  external?: boolean;
}) {
  const pad = size === "sm" ? "h-10 pl-4 pr-1.5 text-[14px]" : "h-12 pl-6 pr-2 text-[15px]";
  const dot = size === "sm" ? "size-7" : "size-8";
  return (
    <Magnetic>
      <a
        href={href}
        data-cursor="link"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={`group relative inline-flex items-center gap-3 rounded-full font-ui font-medium tracking-[-0.01em] transition-[border-color,filter] duration-300 hover:brightness-110 ${pad} ${arrow ? "" : "pr-6"} ${styles[variant]} ${className}`}
      >
        <span className="relative block overflow-hidden leading-[1.25]">
          <span className="block transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-full">
            {children}
          </span>
          <span
            aria-hidden
            className="absolute inset-0 block translate-y-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0"
          >
            {children}
          </span>
        </span>
        {arrow && (
          <span className={`relative grid ${dot} place-items-center overflow-hidden rounded-full ${arrowWrap[variant]}`}>
            <ArrowUpRight className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-5 group-hover:-translate-y-5" />
            <ArrowUpRight className="absolute size-4 -translate-x-5 translate-y-5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0 group-hover:translate-y-0" />
          </span>
        )}
      </a>
    </Magnetic>
  );
}
