"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { site } from "@/data/site";
import { Button } from "./ui/Button";
import { EASE } from "@/lib/motion";

export function Logo() {
  return (
    <a href="#top" className="group inline-flex items-center gap-2" aria-label={`${site.name} — back to top`} data-cursor="link">
      <span className="relative grid size-8 place-items-center rounded-[10px] btn-primary-bg">
        <svg viewBox="0 0 16 16" className="size-3.5 text-white" aria-hidden>
          <path d="M5 3.2v9.6L12.6 8 5 3.2Z" fill="currentColor" />
        </svg>
      </span>
      <span className="text-[20px] font-semibold tracking-[-0.04em] text-white">{site.name}</span>
    </a>
  );
}

export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
      className="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:pt-4"
    >
      <nav
        aria-label="Main"
        className={`mx-auto flex h-16 max-w-[1200px] items-center justify-between rounded-full px-3 pl-5 transition-[background-color,box-shadow] duration-500 ${
          scrolled || open ? "liquid" : "bg-transparent"
        }`}
      >
        <Logo />
        <ul className="hidden items-center gap-1 md:flex">
          {site.nav.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded-full px-4 py-2 font-ui text-[15px] text-white/70 transition-colors hover:text-white"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="hidden md:block">
          <Button href="#contact" variant="white" size="sm">
            Let&apos;s Talk
          </Button>
        </div>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="relative block h-3 w-5">
            <span className={`absolute left-0 h-px w-5 bg-white transition-transform duration-300 ${open ? "top-1.5 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 h-px w-5 bg-white transition-transform duration-300 ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
          </span>
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
            transition={{ duration: 0.4, ease: EASE }}
            className="liquid mx-auto mt-2 max-w-[1200px] rounded-[20px] p-3 md:hidden"
          >
            <ul className="flex flex-col">
              {site.nav.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-4 py-3 text-[18px] text-white/85 hover:bg-white/5"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="p-2 pt-3" onClick={() => setOpen(false)}>
              <Button href="#contact" variant="white">
                Let&apos;s Talk
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
