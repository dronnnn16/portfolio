import { approach, stats } from "@/data/stats";
import { Counter } from "../ui/Counter";
import { Section } from "../ui/Section";
import { SectionHeader } from "../ui/SectionHeader";
import { Stagger, StaggerItem } from "../ui/Reveal";

export function Approach() {
  return (
    <Section id="approach" tone="deep" labelledBy="approach-title">
      <div className="container-x">
        <SectionHeader id="approach-title" label={approach.label} title={approach.title} sub={approach.sub} />
        <Stagger as="ul" className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-20 lg:grid-cols-4 lg:gap-5">
          {stats.map((s) => (
            <StaggerItem
              as="li"
              key={s.label}
              className="glass card-hover relative overflow-hidden rounded-[20px] px-6 pb-6 pt-8"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-16 left-1/2 h-32 w-[80%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(250,97,20,0.28),transparent)]"
              />
              <p className="text-[clamp(2.75rem,2.2rem+2vw,3.75rem)] font-medium leading-none tracking-[-0.04em] text-white">
                {s.value === null ? (
                  <span className="rounded-lg border border-dashed border-accent/50 px-2 text-[0.55em] text-accent" title="Add a real number in data/stats.ts">
                    {"{{TODO}}"}
                  </span>
                ) : (
                  <Counter value={s.value} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals} />
                )}
              </p>
              <h3 className="mt-6 font-ui text-[16px] font-medium text-white">{s.label}</h3>
              <p className="mt-1 text-[14px] text-white/50">{s.note}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
