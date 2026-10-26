"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { createElement, type ElementType, type ReactNode } from "react";
import { EASE, blurIn, fadeUp } from "@/lib/motion";

type TextTag = "h1" | "h2" | "h3" | "p" | "span";

/**
 * Blur-in text reveal, staggered word by word.
 * Words stay real text nodes, so screen readers and search engines read the sentence normally.
 */
export function BlurText({
  text,
  as = "p",
  className,
  delay = 0,
  stagger = 0.04,
  once = true,
  id,
}: {
  id?: string;
  text: string;
  as?: TextTag;
  className?: string;
  delay?: number;
  stagger?: number;
  once?: boolean;
}) {
  const words = text.split(" ");
  const MotionTag = motion[as] as ElementType;
  return (
    <MotionTag
      id={id}
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "0px 0px -6% 0px" }}
      transition={{ staggerChildren: stagger, delayChildren: delay }}
    >
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="inline-block will-change-[filter,transform]"
          variants={blurIn}
          transition={{ duration: 1, ease: EASE }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </MotionTag>
  );
}

/** Block-level blur-in for arbitrary content. */
export function Reveal({
  children,
  delay = 0,
  className,
  blur = true,
  ...rest
}: { children: ReactNode; delay?: number; blur?: boolean } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -6% 0px" }}
      variants={blur ? blurIn : fadeUp}
      transition={{ duration: 1, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Parent + child pair for staggered card grids. */
export function Stagger({
  children,
  className,
  stagger = 0.1,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  as?: "div" | "ul";
}) {
  const Tag = motion[as] as ElementType;
  return createElement(
    Tag,
    {
      className,
      initial: "hidden",
      whileInView: "show",
      viewport: { once: true, margin: "0px 0px -6% 0px" },
      transition: { staggerChildren: stagger, delayChildren: delay },
    },
    children,
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article";
}) {
  const Tag = motion[as] as ElementType;
  return createElement(
    Tag,
    { className, variants: fadeUp, transition: { duration: 1, ease: EASE } },
    children,
  );
}
