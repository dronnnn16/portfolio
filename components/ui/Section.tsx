import type { ReactNode } from "react";
import { Starfield } from "./Starfield";

/** Section shell: dark warm background, starfield and consistent vertical rhythm. */
export function Section({
  id,
  children,
  tone = "section",
  seed,
  className = "",
  labelledBy,
}: {
  id?: string;
  children: ReactNode;
  tone?: "section" | "deep";
  seed?: number;
  className?: string;
  labelledBy?: string;
}) {
  // Deep sections fade in/out of the base section colour so there are no hard seams.
  const bg =
    tone === "deep"
      ? "bg-[linear-gradient(180deg,#100b08,#090401_160px,#090401_calc(100%-160px),#100b08)]"
      : "bg-section";
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`relative isolate scroll-mt-24 overflow-hidden py-24 md:py-32 ${bg} ${className}`}
    >
      {seed !== undefined && <Starfield seed={seed} className="-z-10" />}
      {children}
    </section>
  );
}
