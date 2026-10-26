import { Reveal } from "./Reveal";

/** Small dark chip with short orange dashes either side: "— My Process —" */
export function SectionLabel({
  children,
  as: Tag = "span",
  id,
}: {
  children: string;
  as?: "span" | "h2";
  id?: string;
}) {
  return (
    <Reveal blur={false} className="inline-flex">
      <Tag
        id={id}
        className="glass glass-blur inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 font-ui text-[13px] font-medium tracking-[-0.01em] text-white/80"
      >
        <span aria-hidden className="h-[1.5px] w-3.5 rounded-full bg-accent" />
        {children}
        <span aria-hidden className="h-[1.5px] w-3.5 rounded-full bg-accent" />
      </Tag>
    </Reveal>
  );
}
