import { tools, toolsIntro } from "@/data/tools";
import { asset } from "@/lib/asset";
import { Section } from "../ui/Section";
import { SectionHeader } from "../ui/SectionHeader";

function ToolChip({ t }: { t: (typeof tools)[number] }) {
  return (
    <li className="glass flex shrink-0 items-center gap-3 rounded-[16px] py-3 pl-3 pr-6">
      {t.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset(t.logo)} alt="" className="size-10 rounded-[10px] object-contain" loading="lazy" />
      ) : (
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-[10px] border font-ui text-[15px] font-semibold"
          style={{ color: t.color, borderColor: `${t.color}55`, background: `${t.color}14` }}
          title="Placeholder — add the official logo in data/tools.ts"
        >
          {t.short}
        </span>
      )}
      <span className="font-ui text-[17px] font-medium whitespace-nowrap text-white">{t.name}</span>
    </li>
  );
}

export function Tools() {
  // Repeat the list so one half always fills wide screens; the track translates -50% for a seamless loop.
  const half = Array.from({ length: 3 }, () => tools).flat();
  return (
    <Section id="tools" seed={71} labelledBy="tools-title">
      <div className="container-x">
        <SectionHeader id="tools-title" label={toolsIntro.label} title={toolsIntro.title} />
      </div>
      <div className="fade-x group mt-14 overflow-hidden md:mt-20">
        <ul
          className="flex w-max animate-marquee gap-4 group-hover:[animation-play-state:paused] motion-reduce:animate-none"
          style={{ "--marquee-dur": "40s" } as React.CSSProperties}
          aria-label="Tools"
        >
          {half.map((t, i) => (
            <ToolChip key={`a${i}`} t={t} />
          ))}
          {half.map((t, i) => (
            <ToolChip key={`b${i}`} t={t} />
          ))}
        </ul>
      </div>
    </Section>
  );
}
