import { projects, workIntro } from "@/data/projects";
import { Media } from "../ui/Media";
import { BlurText, Stagger, StaggerItem } from "../ui/Reveal";
import { Section } from "../ui/Section";
import { SectionHeader } from "../ui/SectionHeader";
import { DragRow } from "../visuals/DragRow";

function TypeTag({ children }: { children: string }) {
  return (
    <span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-chip px-2.5 py-1 font-ui text-[12px] font-medium leading-none text-[#100b08]">
      {children}
    </span>
  );
}

export function Work() {
  return (
    <Section id="work" tone="deep" seed={41} labelledBy="work-title">
      <div className="container-x">
        <SectionHeader id="work-title" label={workIntro.label} title={workIntro.title} sub={workIntro.sub} />
      </div>

      <div className="mt-14 md:mt-20">
        <DragRow label="Vertical project cuts">
          {projects.map((p) => (
            <article
              key={p.slug}
              data-card
              className="glass card-hover group w-[72vw] max-w-[280px] shrink-0 snap-start rounded-[20px] p-2 select-none"
            >
              <div className="relative">
                <Media
                  src={p.vertical.src}
                  poster={p.vertical.poster}
                  alt={`${p.title} — vertical cut`}
                  className="aspect-[9/16] rounded-[14px]"
                />
                <div className="absolute left-3 top-3">
                  <TypeTag>{p.type}</TypeTag>
                </div>
              </div>
              <div className="px-2 pb-3 pt-4">
                <h3 className="font-ui text-[17px] font-medium text-white">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-white/55">{p.description}</p>
              </div>
            </article>
          ))}
        </DragRow>
      </div>

      <div className="container-x mt-24 md:mt-32">
        <BlurText as="h3" text="Case studies" className="text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)] font-medium tracking-[-0.03em] text-white" />
        <Stagger as="ul" className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {projects.map((p) => {
            const body = (
              <>
                <Media src={p.cover.src} poster={p.cover.poster} alt={`${p.title} — preview`} className="aspect-[16/10] rounded-[14px]" />
                <div className="px-3 pb-4 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="h3 text-[20px]">{p.title}</h4>
                    <TypeTag>{p.type}</TypeTag>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-white/60">{p.description}</p>
                </div>
              </>
            );
            return (
              <StaggerItem as="li" key={p.slug} className="glass card-hover rounded-[20px] p-2">
                {p.href ? (
                  <a href={p.href} target="_blank" rel="noopener noreferrer" className="block rounded-[18px]">
                    {body}
                  </a>
                ) : (
                  body
                )}
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </Section>
  );
}
