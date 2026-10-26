"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { afterTags, type ProcessVisual } from "@/data/process";
import { EASE } from "@/lib/motion";

function useTicker(ms: number, steps: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!inView || reduce || paused) return;
    const t = setInterval(() => setI((v) => (v + 1) % steps), ms);
    return () => clearInterval(t);
  }, [inView, reduce, paused, ms, steps]);
  return { ref, i, setI, setPaused, inView, reduce };
}

const frame = "relative h-[230px] overflow-hidden rounded-[14px] border border-white/[0.06] bg-deep/80";

function Moodboard() {
  const tiles = [
    "bg-[linear-gradient(140deg,#fa6114,#7a2a06)] row-span-2",
    "bg-[linear-gradient(140deg,#2a1d16,#4a3328)]",
    "bg-[linear-gradient(140deg,#ce7f5d,#6b3b25)]",
    "bg-[linear-gradient(140deg,#f8f5f2,#bfb3a8)] row-span-2",
    "bg-[linear-gradient(140deg,#1c1410,#3b2a20)]",
    "bg-[linear-gradient(140deg,#e25720,#ff9a5e)]",
  ];
  const { ref, i } = useTicker(2200, tiles.length);
  const order = tiles.map((_, k) => tiles[(k + i) % tiles.length]);
  return (
    <div ref={ref} className={`${frame} p-3`}>
      <div className="grid h-full grid-flow-row-dense grid-cols-3 grid-rows-3 gap-2">
        {order.map((t) => (
          <motion.div key={t} layout transition={{ duration: 0.9, ease: EASE }} className={`rounded-[8px] ${t}`} />
        ))}
      </div>
      <div className="absolute bottom-4 right-4 rotate-[3deg] rounded-[8px] bg-chip px-3 py-2 font-ui text-[11px] font-medium text-[#100b08] shadow-lg">
        Warm, cinematic, fast cuts
      </div>
    </div>
  );
}

function Storyboard() {
  const { ref, i } = useTicker(1300, 3);
  return (
    <div ref={ref} className={`${frame} flex items-center gap-3 p-4`}>
      {[0, 1, 2].map((k) => (
        <div key={k} className="flex flex-1 flex-col gap-2">
          <div
            className={`relative h-[160px] rounded-[8px] border transition-colors duration-500 ${
              i === k ? "border-accent/80 bg-accent/10 shadow-[0_0_24px_-6px_rgba(250,97,20,0.6)]" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="absolute inset-x-2 top-2 h-1.5 rounded-full bg-white/20" />
            <div className="absolute inset-x-2 top-5 h-1.5 w-1/2 rounded-full bg-white/10" />
            <div className="absolute bottom-2 left-2 right-2 top-9 rounded-[5px] border border-dashed border-white/15" />
          </div>
          <span className={`font-ui text-[10px] ${i === k ? "text-accent" : "text-white/35"}`}>Frame {k + 1}</span>
        </div>
      ))}
    </div>
  );
}

function Animate() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduce = useReducedMotion();
  const layers = [
    { name: "Logo", keys: [8, 34, 62], color: "bg-accent" },
    { name: "UI Card", keys: [18, 46, 80], color: "bg-tan" },
    { name: "Text", keys: [28, 70], color: "bg-white/70" },
  ];
  const play = inView && !reduce;
  return (
    <div ref={ref} className={`${frame} flex flex-col p-4`}>
      <div className="relative mb-3 h-[86px] overflow-hidden rounded-[8px] bg-white/[0.03]">
        <motion.div
          className="absolute top-1/2 size-9 -translate-y-1/2 rounded-[10px] btn-primary-bg"
          animate={play ? { left: ["8%", "78%", "8%"], rotate: [0, 90, 0], borderRadius: ["10px", "50%", "10px"] } : {}}
          transition={{ duration: 4, repeat: Infinity, ease: [0.65, 0, 0.35, 1] }}
        />
      </div>
      <div className="relative flex flex-1 flex-col justify-between">
        {layers.map((l) => (
          <div key={l.name} className="flex items-center gap-3">
            <span className="w-14 shrink-0 font-ui text-[10px] text-white/40">{l.name}</span>
            <div className="relative h-5 flex-1 rounded-[4px] bg-white/[0.04]">
              {l.keys.map((k) => (
                <span key={k} className={`absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 ${l.color}`} style={{ left: `${k}%` }} />
              ))}
            </div>
          </div>
        ))}
        <div aria-hidden className="pointer-events-none absolute -bottom-1 -top-1 left-[68px] right-0">
          <motion.span
            className="absolute inset-y-0 w-px bg-accent shadow-[0_0_8px_rgba(250,97,20,0.9)]"
            initial={{ left: "0%" }}
            animate={play ? { left: ["0%", "100%", "0%"] } : { left: "0%" }}
            transition={{ duration: 4, repeat: Infinity, ease: [0.65, 0, 0.35, 1] }}
          />
        </div>
      </div>
    </div>
  );
}

function BeforeAfter() {
  const { ref, i, setI, setPaused } = useTicker(2800, 2);
  const after = i === 1;
  return (
    <div ref={ref} className={`${frame} p-3`}>
      <div className="relative mx-auto h-[calc(100%-40px)] w-[46%] max-w-[130px] overflow-hidden rounded-[10px] border border-white/10">
        <AnimatePresence initial={false}>
          <motion.div
            key={after ? "a" : "b"}
            className={`absolute inset-0 ${
              after
                ? "bg-[radial-gradient(120%_70%_at_50%_0%,rgba(250,97,20,0.55),transparent_60%),linear-gradient(180deg,#2a140a,#0d0603)]"
                : "bg-[linear-gradient(180deg,#2b2826,#1b1918)] grayscale"
            }`}
            initial={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className={`absolute inset-x-3 bottom-8 h-2 rounded-full ${after ? "bg-white" : "bg-white/20"}`} />
            <div className={`absolute bottom-4 left-3 h-2 w-1/2 rounded-full ${after ? "bg-accent" : "bg-white/10"}`} />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-x-2 top-2 flex flex-col items-start gap-1.5">
          <AnimatePresence>
            {after &&
              afterTags.map((t, k) => (
                <motion.span
                  key={t}
                  className="rounded-full bg-chip px-2 py-0.5 font-ui text-[10px] font-semibold text-[#100b08] shadow"
                  initial={{ opacity: 0, x: -10, scale: 0.8 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -6, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.5, ease: EASE, delay: 0.25 + k * 0.12 }}
                >
                  {t}
                </motion.span>
              ))}
          </AnimatePresence>
        </div>
      </div>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 rounded-full border border-white/10 bg-black/50 p-0.5 font-ui text-[11px] backdrop-blur" role="group" aria-label="Compare edit">
        {["Before", "After"].map((label, k) => (
          <button
            key={label}
            type="button"
            aria-pressed={i === k}
            onClick={() => {
              setPaused(true);
              setI(k);
            }}
            className={`relative rounded-full px-3 py-1 transition-colors ${i === k ? "text-[#100b08]" : "text-white/60"}`}
          >
            {i === k && <motion.span layoutId="ba-pill" className="absolute inset-0 rounded-full bg-white" transition={{ duration: 0.4, ease: EASE }} />}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProcessVisual({ type }: { type: ProcessVisual }) {
  if (type === "moodboard") return <Moodboard />;
  if (type === "storyboard") return <Storyboard />;
  if (type === "animate") return <Animate />;
  return <BeforeAfter />;
}
