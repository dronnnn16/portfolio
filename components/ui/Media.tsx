"use client";

import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/asset";

/**
 * Lazy, muted, looping, inline video with poster.
 * The <video> only gets its src when it nears the viewport, and pauses when off-screen.
 * If the file is missing a labelled placeholder is shown so you know what to add.
 */
export function Media({
  src,
  poster,
  alt,
  className = "",
  rootMargin = "200px",
}: {
  src: string;
  poster?: string;
  alt: string;
  className?: string;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setNear(true);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !near) return;
    if (visible && !reduce) el.play().catch(() => {});
    else el.pause();
  }, [near, visible, reduce]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!ready && (
        <div className="placeholder-stripes absolute inset-0 flex items-end p-3" aria-hidden={!failed}>
          <span className="rounded-md bg-black/40 px-2 py-1 font-ui text-[11px] leading-tight text-white/45">
            Add {src}
          </span>
        </div>
      )}
      {!failed && (
        <video
          ref={ref}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
          src={near ? asset(src) : undefined}
          poster={near && poster ? asset(poster) : undefined}
          muted
          loop
          playsInline
          preload={reduce ? "metadata" : "none"}
          aria-label={alt}
          onLoadedData={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
