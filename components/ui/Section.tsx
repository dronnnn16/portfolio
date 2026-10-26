import type { ReactNode } from "react";

/** Section shell: dark warm background, starfield and consistent vertical rhythm. */
export function Section({
  id,
  children,
  tone = "section",
  className = "",
  labelledBy,
}: {
  id?: string;
  children: ReactNode;
  tone?: "section" | "deep";
  className?: string;
  labelledBy?: string;
}) {
  // The 360° starfield sits behind the page, so sections stay see-through.
  // Deep sections add a translucent darker tint that fades in and out (no hard seams).
  const bg =
    tone === "deep"
      ? "bg-[linear-gradient(180deg,transparent,rgba(5,2,0,0.55)_160px,rgba(5,2,0,0.55)_calc(100%-160px),transparent)]"
      : "";
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`relative isolate scroll-mt-24 overflow-hidden py-24 md:py-32 ${bg} ${className}`}
    >
      {children}
    </section>
  );
}
