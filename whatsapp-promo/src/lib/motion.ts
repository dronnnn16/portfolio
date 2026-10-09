import type { CSSProperties } from "react";
import { Easing, interpolate, spring } from "remotion";

export const expoOut = Easing.bezier(0.16, 1, 0.3, 1);
export const expoIn = Easing.bezier(0.7, 0, 0.84, 0);
export const expoInOut = Easing.bezier(0.87, 0, 0.13, 1);

export const POP = { damping: 14, stiffness: 120 } as const;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Eased 0→1 progress between two frames (expo-out by default). */
export const progress = (
  frame: number,
  start: number,
  end: number,
  easing: (t: number) => number = expoOut,
) =>
  interpolate(frame, [start, end], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Springy pop, 0→1 (with slight overshoot). */
export const pop = (
  frame: number,
  fps: number,
  delay = 0,
  config: Partial<{ damping: number; stiffness: number; mass: number }> = POP,
) => spring({ frame: frame - delay, fps, config: { ...POP, ...config } });

/** Per-word reveal: translateY 40→0, opacity 0→1, blur 12→0. */
export const wordReveal = (
  frame: number,
  start: number,
  duration = 26,
  distance = 40,
  blur = 12,
): CSSProperties => {
  const p = progress(frame, start, start + duration);
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * distance}px)`,
    filter: `blur(${(1 - p) * blur}px)`,
  };
};

/** Inverse of wordReveal, for exits. */
export const blurOut = (
  frame: number,
  start: number,
  duration = 16,
  distance = -30,
  blur = 16,
): CSSProperties => {
  const p = progress(frame, start, start + duration, expoIn);
  return {
    opacity: 1 - p,
    transform: `translateY(${p * distance}px)`,
    filter: `blur(${p * blur}px)`,
  };
};

/** Nothing is ever fully static: scale 1→1.03 across an element's life. */
export const drift = (frame: number, life: number, amount = 0.03) =>
  1 + amount * clamp01(frame / life);

/** Fade in/out helper. */
export const fade = (
  frame: number,
  inStart: number,
  inEnd: number,
  outStart = Infinity,
  outEnd = Infinity,
) =>
  Math.min(
    progress(frame, inStart, inEnd, Easing.linear),
    Number.isFinite(outStart)
      ? 1 - progress(frame, outStart, outEnd, Easing.linear)
      : 1,
  );

/** Point on a quadratic bezier. */
export const quad = (
  p0: [number, number],
  c: [number, number],
  p1: [number, number],
  t: number,
): [number, number] => {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
    u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
  ];
};
