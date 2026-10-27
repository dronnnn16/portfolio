"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { faqIntro, faqs } from "@/data/faq";
import { EASE } from "@/lib/motion";
import { Section } from "../ui/Section";
import { SectionHeader } from "../ui/SectionHeader";
import { Stagger, StaggerItem } from "../ui/Reveal";

function Item({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <div className={`glass rounded-[16px] transition-colors duration-500 ${open ? "border-white/15 bg-white/[0.07]" : ""}`}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-btn`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-6 rounded-[16px] px-5 py-5 text-left md:px-6"
        >
          <span className="text-[17px] font-medium tracking-[-0.01em] text-white md:text-[19px]">{q}</span>
          <span
            aria-hidden
            className={`relative grid size-9 shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              open ? "rotate-[135deg] btn-primary-bg" : "bg-white/[0.08]"
            }`}
          >
            <span className="absolute h-[1.5px] w-3.5 rounded-full bg-white" />
            <span className="absolute h-3.5 w-[1.5px] rounded-full bg-white" />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-panel`}
            role="region"
            aria-labelledby={`${id}-btn`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="max-w-[640px] px-5 pb-6 text-[15px] leading-relaxed text-white/65 md:px-6 md:text-[16px]">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq" tone="deep" labelledBy="faq-title">
      <div className="container-x">
        <SectionHeader id="faq-title" label={faqIntro.label} />
        <Stagger className="mx-auto mt-14 flex max-w-[820px] flex-col gap-3 md:mt-20" stagger={0.07}>
          {faqs.map((f, i) => (
            <StaggerItem key={f.q}>
              <Item q={f.q} a={f.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
