"use client";

import { useEffect } from "react";

/**
 * Liquid glass support:
 *  - an SVG displacement filter that `.liquid` uses to refract what's behind it
 *    (Chromium only: other engines ignore url() in backdrop-filter, so they keep the frosted fallback)
 *  - a pointer-following specular sheen on `.glass` and `.liquid` surfaces (fine pointers only)
 */
export function LiquidGlass() {
  useEffect(() => {
    const root = document.documentElement;
    const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
    // Refraction is the costly part, so switch it on only once the page has loaded and gone idle.
    let idle = 0;
    if (brands?.some((b) => /Chromium/i.test(b.brand))) {
      const enable = () => root.classList.add("liquid-refract");
      const later = () => {
        idle = window.requestIdleCallback ? window.requestIdleCallback(enable, { timeout: 4000 }) : window.setTimeout(enable, 1500);
      };
      if (document.readyState === "complete") later();
      else window.addEventListener("load", later, { once: true });
    }

    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return () => {
        if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
        root.classList.remove("liquid-refract");
      };
    let current: HTMLElement | null = null;
    let raf = 0;
    let last: PointerEvent | null = null;

    const apply = () => {
      raf = 0;
      const e = last;
      if (!e) return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(".glass, .liquid") ?? null;
      if (el !== current) {
        current?.style.setProperty("--sheen", "0");
        current = el;
        el?.style.setProperty("--sheen", "1");
      }
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    const move = (e: PointerEvent) => {
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const leave = () => {
      current?.style.setProperty("--sheen", "0");
      current = null;
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      root.classList.remove("liquid-refract");
    };
  }, []);

  return (
    <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
      <filter id="liquid-refract" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.011 0.017" numOctaves="1" seed="11" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2.5" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="42" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
