"use client";

import { useAnimationFrame, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { Media } from "../ui/Media";

type Reel = { src: string; poster: string; alt: string };

/**
 * Curved 3D carousel: 9:16 cards sit on the outside of a cylinder.
 * Centre cards face the viewer; outer cards rotate in Y and recede.
 * It scrolls infinitely and eases to a stop on hover.
 */
export function ReelCarousel({ reels }: { reels: Reel[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const offset = useRef(0);
  const speed = useRef(1);
  const target = useRef(1);
  const geo = useRef({ w: 220, gap: 20, r: 1100 });
  const reduce = useReducedMotion();
  const inView = useInView(stage, { margin: "100px" });
  const last = useRef<{ z: number; hidden: boolean }[]>([]);
  const primed = useRef(false);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    // Card width comes from CSS (clamp) so layout is stable before JS runs.
    const measure = () => {
      const vw = el.clientWidth;
      const w = cards.current[0]?.offsetWidth || 220;
      geo.current = { w, gap: Math.round(w * 0.09), r: Math.max(520, vw * 0.6) };
      primed.current = false;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useAnimationFrame((_, delta) => {
    if (primed.current && (!inView || document.hidden)) return;
    primed.current = true;
    const dt = Math.min(delta, 64) / 1000;
    speed.current += (target.current - speed.current) * Math.min(1, dt * 4);
    if (!reduce) offset.current += speed.current * dt * 38;

    const { w, gap, r } = geo.current;
    const step = w + gap;
    const n = reels.length;
    const loop = step * n;
    for (let i = 0; i < n; i++) {
      const el = cards.current[i];
      if (!el) continue;
      let pos = (((i * step - offset.current) % loop) + loop) % loop;
      pos -= loop / 2 - step / 2;
      const theta = pos / r;
      const x = Math.sin(theta) * r;
      const z = (Math.cos(theta) - 1) * r;
      const a = Math.abs(theta);
      const opacity = Math.max(0, Math.min(1, 1 - (a - 0.75) / 0.3));
      el.style.transform = `translate3d(${x.toFixed(1)}px,0,${z.toFixed(1)}px) rotateY(${((theta * 180) / Math.PI).toFixed(2)}deg)`;
      el.style.opacity = opacity.toFixed(3);
      const zi = 1000 - Math.round(a * 20);
      const hidden = opacity <= 0.01;
      const prev = last.current[i];
      if (!prev || prev.z !== zi) el.style.zIndex = String(zi);
      if (!prev || prev.hidden !== hidden) el.style.visibility = hidden ? "hidden" : "visible";
      last.current[i] = { z: zi, hidden };
    }
  });

  return (
    <div
      ref={stage}
      className="relative h-[calc(var(--card-w)*16/9+40px)] w-full [--card-w:clamp(138px,16.5vw,236px)] [perspective:1800px]"
      onPointerEnter={() => (target.current = 0)}
      onPointerLeave={() => (target.current = 1)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Showreel clips"
    >
      <div className="absolute inset-0 [transform-style:preserve-3d]">
        {reels.map((reel, i) => (
          <div
            key={reel.src}
            ref={(el) => {
              cards.current[i] = el;
            }}
            className="absolute left-1/2 top-5 -ml-[calc(var(--card-w)/2)] w-[var(--card-w)] will-change-transform [backface-visibility:hidden]"
            style={{ opacity: 0 }}
          >
            <div className="glass aspect-[9/16] overflow-hidden rounded-[18px] p-1.5 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]">
              <Media src={reel.src} poster={reel.poster} alt={reel.alt} className="size-full rounded-[13px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
