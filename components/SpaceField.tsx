"use client";

import { useEffect, useRef } from "react";

type Star = { x: number; y: number; z: number; size: number; tw: number; phase: number; warm: boolean; sparkle: boolean };

const COUNT = 1500;
const YAW_RANGE = 1.05; // ±60° of look-around from the cursor
const PITCH_RANGE = 0.45; // ±26°
const SCROLL_YAW = 0.00035; // radians per scrolled pixel
const EASE = 3.2; // higher = view catches up to the cursor faster

function makeStars(): Star[] {
  // Deterministic PRNG so the sky is the same on every visit.
  let s = 1337;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: COUNT }, () => {
    // Uniform direction on a sphere.
    const u = rnd() * 2 - 1;
    const t = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const bright = rnd();
    return {
      x: r * Math.cos(t),
      y: u,
      z: r * Math.sin(t),
      size: bright > 0.97 ? 1.9 : bright > 0.82 ? 1.3 : 0.85,
      tw: 0.6 + rnd() * 1.8,
      phase: rnd() * Math.PI * 2,
      warm: rnd() < 0.12,
      sparkle: bright > 0.978,
    };
  });
}

/**
 * A 360° sphere of stars behind the whole page. The camera sits at the centre:
 * moving the cursor turns the view (yaw/pitch) and scrolling slowly rotates the sphere,
 * so it feels like looking around inside space rather than at a flat backdrop.
 */
export function SpaceField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const stars = makeStars();
    let w = 0;
    let h = 0;
    let dpr = 1;
    const target = { yaw: 0, pitch: 0 };
    const view = { yaw: 0, pitch: 0 };
    let raf = 0;
    let lastT = 0;
    let lastDraw = 0;
    let started = false;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (started) draw(performance.now());
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      const yaw = view.yaw + (reduce ? 0 : window.scrollY * SCROLL_YAW);
      const pitch = view.pitch;
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const f = Math.max(w, h) * 0.62; // focal length ≈ 78° horizontal field of view
      const halfW = w / 2, halfH = h / 2;
      const time = now / 1000;

      for (let i = 0; i < stars.length; i++) {
        const st = stars[i];
        // Rotate around Y (yaw), then X (pitch).
        const x1 = st.x * cy - st.z * sy;
        const z1 = st.x * sy + st.z * cy;
        const y2 = st.y * cp - z1 * sp;
        const z2 = st.y * sp + z1 * cp;
        if (z2 < 0.12) continue; // behind the camera or at the extreme edge
        const px = halfW + (x1 / z2) * f;
        const py = halfH + (y2 / z2) * f;
        if (px < -8 || px > w + 8 || py < -8 || py > h + 8) continue;

        const twinkle = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(time * st.tw + st.phase);
        const alpha = Math.min(1, twinkle * (0.5 + z2 * 0.6));
        ctx.fillStyle = st.warm ? `rgba(255,214,186,${alpha})` : `rgba(255,255,255,${alpha})`;
        const r = st.size;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();

        if (st.sparkle) {
          // Four-point sparkle.
          const len = 5 + 4 * twinkle;
          ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(px - len, py);
          ctx.lineTo(px + len, py);
          ctx.moveTo(px, py - len);
          ctx.lineTo(px, py + len);
          ctx.stroke();
        }
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const dt = Math.min(0.064, (now - (lastT || now)) / 1000);
      lastT = now;
      const k = 1 - Math.exp(-dt * EASE);
      view.yaw += (target.yaw - view.yaw) * k;
      view.pitch += (target.pitch - view.pitch) * k;
      const moving = Math.abs(target.yaw - view.yaw) > 0.0005 || Math.abs(target.pitch - view.pitch) > 0.0005;
      // Full frame rate while the view is turning; ~20fps when settled (just enough for twinkling).
      if (moving || now - lastDraw > 50) {
        lastDraw = now;
        draw(now);
      }
    };

    const onMove = (e: PointerEvent) => {
      target.yaw = ((e.clientX / w) * 2 - 1) * YAW_RANGE;
      target.pitch = ((e.clientY / h) * 2 - 1) * PITCH_RANGE;
    };
    const onScroll = () => {
      if (reduce) return;
      lastDraw = 0; // redraw on the next frame so scrolling rotates the sphere smoothly
    };

    const start = () => {
      started = true;
      resize();
      draw(performance.now());
      canvas.style.opacity = "1";
      if (reduce) return;
      raf = requestAnimationFrame(loop);
      if (fine) window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
    };

    window.addEventListener("resize", resize);
    // Start after the page has loaded so the canvas never competes with first paint.
    let idle = 0;
    const later = () => {
      idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 2500 }) : window.setTimeout(start, 600);
    };
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });

    return () => {
      cancelAnimationFrame(raf);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-0 transition-opacity duration-[1500ms]"
    />
  );
}
