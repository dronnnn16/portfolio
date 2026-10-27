"use client";

import { motion } from "motion/react";
import { EASE } from "@/lib/motion";

/**
 * Liquid-glass tags that float over a carousel (desktop/tablet),
 * with a plain wrapped row underneath on phones.
 * `positions` holds one Tailwind placement string per tag.
 */
export function FloatingTags({
  tags,
  positions,
  delay = 0,
  onView = false,
}: {
  tags: string[];
  positions: string[];
  delay?: number;
  onView?: boolean;
}) {
  const reveal = onView
    ? { initial: "hidden", whileInView: "show", viewport: { once: true, margin: "0px 0px -10% 0px" } }
    : { initial: "hidden", animate: "show" };
  return (
    <>
      <motion.ul
        aria-label="Specialities"
        className="pointer-events-none absolute inset-0 hidden sm:block"
        transition={{ staggerChildren: 0.15, delayChildren: delay }}
        {...reveal}
      >
        {tags.map((t, i) => (
          <motion.li
            key={t}
            className={`absolute z-[2000] ${positions[i % positions.length]}`}
            variants={{
              hidden: { opacity: 0, scale: 0.8, filter: "blur(6px)" },
              show: { opacity: 1, scale: 1, filter: "blur(0px)" },
            }}
            transition={{ duration: 0.8, ease: EASE }}
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
      </motion.ul>
      <TagRow tags={tags} />
    </>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <ul aria-label="Specialities" className="container-x mt-8 flex flex-wrap justify-center gap-2 sm:hidden">
      {tags.map((t) => (
        <li key={t} className="liquid inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-ui text-[12px] text-white/85">
          <span className="size-1.5 rounded-full bg-accent" />
          {t}
        </li>
      ))}
    </ul>
  );
}
