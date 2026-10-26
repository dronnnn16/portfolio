"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { testimonials, testimonialsIntro } from "@/data/testimonials";
import { asset } from "@/lib/asset";
import { EASE } from "@/lib/motion";
import { ArrowUpRight } from "../ui/Arrow";
import { Section } from "../ui/Section";
import { SectionHeader } from "../ui/SectionHeader";
import { Reveal } from "../ui/Reveal";

/** Renders only real entries from data/testimonials.ts — hidden entirely when empty. */
export function Testimonials() {
  const [i, setI] = useState(0);
  if (testimonials.length === 0) return null;
  const t = testimonials[i];
  const many = testimonials.length > 1;
  const go = (d: number) => setI((v) => (v + d + testimonials.length) % testimonials.length);

  return (
    <Section id="testimonials" tone="deep" labelledBy="testimonials-title">
      <div className="container-x">
        <SectionHeader id="testimonials-title" label={testimonialsIntro.label} title={testimonialsIntro.title} />
        <Reveal blur={false} className="glass mt-14 grid gap-2 rounded-[20px] p-2 md:mt-20 md:grid-cols-[minmax(0,420px)_1fr]">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[14px] bg-white/[0.04] md:aspect-auto md:min-h-[460px]">
            <AnimatePresence mode="popLayout" initial={false}>
              {t.photo ? (
                <motion.img
                  key={t.photo}
                  src={asset(t.photo)}
                  alt={`Portrait of ${t.name}`}
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: EASE }}
                />
              ) : (
                <div className="placeholder-stripes absolute inset-0 grid place-items-center text-[64px] font-medium text-white/20">
                  {t.name.charAt(0)}
                </div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex flex-col justify-between p-6 md:p-10">
            <svg viewBox="0 0 32 24" className="h-6 w-8 text-accent" aria-hidden>
              <path fill="currentColor" d="M0 24V13.7C0 5.9 4.4 1.2 12.2 0l1.3 3.4C9 4.7 7 7.5 6.8 11H13v13H0Zm18.5 0V13.7C18.5 5.9 22.9 1.2 30.7 0L32 3.4c-4.5 1.3-6.5 4.1-6.7 7.6h6.2v13h-13Z" />
            </svg>
            <AnimatePresence mode="wait">
              <motion.figure
                key={i}
                initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
                transition={{ duration: 0.6, ease: EASE }}
                className="my-8"
              >
                <blockquote className="text-[clamp(1.25rem,1rem+1.1vw,1.875rem)] font-normal leading-[1.35] tracking-[-0.02em] text-white">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-8">
                  <span className="block font-ui text-[16px] font-medium text-white">{t.name}</span>
                  <span className="block text-[14px] text-white/55">{t.role}</span>
                </figcaption>
              </motion.figure>
            </AnimatePresence>
            {many && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => go(-1)} aria-label="Previous testimonial" className="glass grid size-11 place-items-center rounded-full">
                  <ArrowUpRight className="size-4 -rotate-[135deg]" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next testimonial" className="glass grid size-11 place-items-center rounded-full">
                  <ArrowUpRight className="size-4 rotate-45" />
                </button>
                <span className="ml-3 font-ui text-[13px] text-white/45" aria-live="polite">
                  {i + 1} / {testimonials.length}
                </span>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
