"use client";

import { motion } from "motion/react";
import { hero, heroReels } from "@/data/site";
import { EASE } from "@/lib/motion";
import { Button } from "../ui/Button";
import { Starfield } from "../ui/Starfield";
import { ReelCarousel } from "../visuals/ReelCarousel";

const tagPos = [
  "left-[4%] top-[14%] md:left-[9%]",
  "right-[4%] top-[6%] md:right-[10%]",
  "left-1/2 -bottom-5 -translate-x-1/2",
];

export function Hero() {
  const words = hero.title.split(" ");
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-section pb-20 pt-32 md:pb-28 md:pt-44">
      {/* glow orb top-left + vertical line texture + stars */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-[18%] -top-[22%] h-[620px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(250,97,20,0.55),rgba(232,80,26,0.18)_55%,transparent)] md:h-[820px] md:w-[820px]" />
        <div className="absolute right-[-10%] top-[30%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(206,127,93,0.14),transparent)]" />
        <div className="vlines absolute inset-0" />
        <Starfield seed={7} count={56} sparkles={5} />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-section" />
      </div>

      <div className="container-x flex flex-col items-center text-center">
        <p
          className="blur-in liquid inline-flex items-center gap-2 rounded-full py-1.5 pl-2 pr-4 font-ui text-[13px] font-medium text-white/85"
          style={{ "--d": "0.05s" } as React.CSSProperties}
        >
          <span className="relative grid size-5 place-items-center rounded-full bg-positive/20">
            <span className="absolute size-2 animate-ping rounded-full bg-positive/60" />
            <span className="size-2 rounded-full bg-positive" />
          </span>
          {hero.chip}
        </p>

        <h1 id="hero-title" className="h1 mt-6 max-w-[920px]">
          {words.map((w, i) => (
            <span key={i} className="blur-in inline-block" style={{ "--d": `${0.15 + i * 0.05}s` } as React.CSSProperties}>
              {w}
              {i < words.length - 1 ? "\u00A0" : ""}
            </span>
          ))}
        </h1>

        <p className="blur-in lead mt-6 max-w-[600px]" style={{ "--d": "0.45s" } as React.CSSProperties}>
          {hero.sub}
        </p>

        <div
          className="blur-in mt-9 flex flex-wrap items-center justify-center gap-3"
          style={{ "--d": "0.6s" } as React.CSSProperties}
        >
          <Button href={hero.primary.href}>{hero.primary.label}</Button>
          <Button href={hero.secondary.href} variant="secondary">
            {hero.secondary.label}
          </Button>
        </div>
      </div>

      <motion.div
        className="relative mt-16 md:mt-20"
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.4, ease: EASE, delay: 0.75 }}
      >
        <ReelCarousel reels={heroReels} />
        <ul aria-label="Specialities" className="pointer-events-none absolute inset-0 hidden sm:block">
          {hero.tags.map((t, i) => (
            <motion.li
              key={t}
              className={`absolute z-[2000] ${tagPos[i]}`}
              initial={{ opacity: 0, scale: 0.8, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.8, ease: EASE, delay: 1.3 + i * 0.15 }}
            >
              <span
                style={{ animationDuration: `${5 + i}s` }}
                className="animate-float liquid liquid-lite inline-flex items-center gap-2 rounded-full px-3.5 py-2 font-ui text-[13px] font-medium text-white"
              >
                <span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_2px_rgba(250,97,20,0.7)]" />
                {t}
              </span>
            </motion.li>
          ))}
        </ul>
      </motion.div>
      <ul aria-label="Specialities" className="container-x mt-8 flex flex-wrap justify-center gap-2 sm:hidden">
        {hero.tags.map((t) => (
          <li key={t} className="liquid inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-ui text-[12px] text-white/85">
            <span className="size-1.5 rounded-full bg-accent" />
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}
