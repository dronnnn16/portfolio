"use client";

import { motion } from "motion/react";
import { EASE } from "@/lib/motion";
import type { ProblemVisual } from "@/data/problems";

const view = { once: true, margin: "0px 0px -15% 0px" } as const;

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="relative h-[210px] overflow-hidden rounded-[14px] border border-white/[0.06] bg-deep/80 p-4">
      <div className="mb-3 flex items-center justify-between font-ui text-[11px] text-white/45">
        <span>{title}</span>
        <span className="flex gap-1">
          <span className="size-1.5 rounded-full bg-white/15" />
          <span className="size-1.5 rounded-full bg-white/15" />
          <span className="size-1.5 rounded-full bg-white/15" />
        </span>
      </div>
      {children}
    </div>
  );
}

function Retention() {
  const line = "M0 14 C 18 16, 26 70, 48 86 S 90 100, 130 104 S 210 110, 260 112";
  return (
    <Panel title="Audience retention">
      <svg viewBox="0 0 260 130" className="h-[150px] w-full overflow-visible" aria-hidden>
        {[30, 65, 100].map((y) => (
          <line key={y} x1="0" x2="260" y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 4" />
        ))}
        <defs>
          <linearGradient id="ret-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FF6A00" stopOpacity="0.35" />
            <stop offset="1" stopColor="#FF6A00" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d={`${line} L260 130 L0 130 Z`}
          fill="url(#ret-fill)"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={view}
          transition={{ duration: 1, delay: 0.9 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke="#FF6A00"
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={view}
          transition={{ duration: 1.6, ease: EASE, delay: 0.2 }}
        />
        <line x1="48" x2="48" y1="0" y2="130" stroke="rgba(255,255,255,0.18)" strokeDasharray="2 3" />
        <motion.circle
          cx="48"
          cy="86"
          r="4.5"
          fill="#FF6A00"
          stroke="#090401"
          strokeWidth="2"
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={view}
          transition={{ duration: 0.5, delay: 1.1, ease: EASE }}
        />
      </svg>
      <motion.span
        className="absolute left-[calc(16px+18%)] top-[58px] rounded-md bg-negative/15 px-1.5 py-0.5 font-ui text-[11px] font-medium text-negative"
        initial={{ opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={view}
        transition={{ duration: 0.6, delay: 1.3, ease: EASE }}
      >
        0:03 drop-off
      </motion.span>
      <div className="mt-1 flex justify-between font-ui text-[10px] text-white/30">
        <span>0s</span>
        <span>15s</span>
        <span>30s</span>
      </div>
    </Panel>
  );
}

function Engagement() {
  const bars = [34, 30, 36, 31, 33, 29, 32];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <Panel title="Weekly engagement">
      <div className="relative flex h-[140px] items-end justify-between gap-2 px-1">
        <motion.div
          className="absolute inset-x-0 bottom-[33%] border-t border-dashed border-white/25"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={view}
          transition={{ duration: 1, delay: 1, ease: EASE }}
          style={{ originX: 0 }}
        />
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-[118px] w-full items-end">
              <motion.div
                className="w-full rounded-t-[6px] bg-gradient-to-t from-white/10 to-white/30"
                initial={{ height: 0 }}
                whileInView={{ height: `${h}%` }}
                viewport={view}
                transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.07 }}
              />
            </div>
            <span className="font-ui text-[10px] text-white/30">{days[i]}</span>
          </div>
        ))}
        <motion.span
          className="absolute right-0 top-2 rounded-md bg-white/10 px-1.5 py-0.5 font-ui text-[11px] text-white/60"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={view}
          transition={{ delay: 1.2 }}
        >
          Flat
        </motion.span>
      </div>
    </Panel>
  );
}

function Calendar() {
  const posted = new Set([2, 3, 9, 17, 18, 19, 26]);
  return (
    <Panel title="Posting calendar">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 28 }, (_, i) => (
          <motion.div
            key={i}
            className={`aspect-square rounded-[5px] ${posted.has(i) ? "bg-accent/80 shadow-[0_0_12px_-2px_rgba(250,97,20,0.6)]" : "bg-white/[0.05]"}`}
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={view}
            transition={{ duration: 0.45, ease: EASE, delay: 0.15 + (posted.has(i) ? 0.6 + i * 0.02 : i * 0.012) }}
          />
        ))}
      </div>
    </Panel>
  );
}

export function ProblemVisual({ type }: { type: ProblemVisual }) {
  if (type === "retention") return <Retention />;
  if (type === "engagement") return <Engagement />;
  return <Calendar />;
}
