import { featureBanner, services, servicesIntro } from "@/data/services";
import { Button } from "../ui/Button";
import { BlurText, Reveal, Stagger, StaggerItem } from "../ui/Reveal";
import { Section } from "../ui/Section";
import { SectionHeader } from "../ui/SectionHeader";
import { ServiceIcon } from "../visuals/ServiceIcon";

const rowIcons = [
  // fast turnaround — bolt
  <path key="a" d="M11 2 4 11h5l-1 7 7-9h-5l1-7Z" />,
  // retention — chart up
  <path key="b" d="M3 15l5-5 3 3 6-6M12 7h5v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  // detail — sparkle
  <path key="c" d="M10 1c.4 4.3 3.7 7.6 8 8-4.3.4-7.6 3.7-8 8-.4-4.3-3.7-7.6-8-8 4.3-.4 7.6-3.7 8-8Z" />,
];

export function Services() {
  return (
    <Section id="services" seed={31} labelledBy="services-title">
      <div className="container-x">
        <SectionHeader id="services-title" label={servicesIntro.label} title={servicesIntro.title} sub={servicesIntro.sub} />

        <Stagger as="ul" className="mt-14 grid gap-4 md:mt-20 md:grid-cols-3 lg:gap-5">
          {services.map((s) => (
            <StaggerItem as="li" key={s.title} className="glass card-hover group rounded-[20px] p-6 pt-7">
              <ServiceIcon kind={s.icon} />
              <h3 className="h3 mt-8">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-white/60">{s.body}</p>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal blur={false} className="glass relative mt-5 overflow-hidden rounded-[20px] p-6 md:p-10">
          <div aria-hidden className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(250,97,20,0.35),transparent)]" />
          <div className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
            <div>
              <BlurText as="h3" text={featureBanner.title} className="text-[clamp(1.75rem,1.3rem+1.8vw,2.75rem)] font-medium leading-[1.12] tracking-[-0.03em] text-white" />
              <p className="mt-4 max-w-[440px] text-[16px] leading-relaxed text-white/60">{featureBanner.sub}</p>
              <div className="mt-8">
                <Button href="#contact">Start a Project</Button>
              </div>
            </div>
            <Stagger as="ul" className="flex flex-col gap-3" stagger={0.12}>
              {featureBanner.rows.map((r, i) => (
                <StaggerItem
                  as="li"
                  key={r.title}
                  className="flex items-start gap-4 rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-4"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-accent/15 text-accent">
                    <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden>
                      {rowIcons[i % rowIcons.length]}
                    </svg>
                  </span>
                  <span>
                    <span className="block font-ui text-[16px] font-medium text-white">{r.title}</span>
                    <span className="mt-0.5 block text-[14px] text-white/55">{r.body}</span>
                  </span>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
