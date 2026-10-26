import { processIntro, processSteps } from "@/data/process";
import { Section } from "../ui/Section";
import { SectionHeader } from "../ui/SectionHeader";
import { Stagger, StaggerItem } from "../ui/Reveal";
import { ProcessVisual } from "../visuals/ProcessVisuals";

export function Process() {
  return (
    <Section id="process" seed={53} labelledBy="process-title">
      <div className="container-x">
        <SectionHeader id="process-title" label={processIntro.label} title={processIntro.title} sub={processIntro.sub} />
        <Stagger as="ul" className="mt-14 grid gap-4 md:mt-20 md:grid-cols-2 md:gap-5">
          {processSteps.map((s, i) => (
            <StaggerItem as="li" key={s.title} className="glass card-hover rounded-[20px] p-2">
              <ProcessVisual type={s.visual} />
              <div className="px-4 pb-5 pt-6">
                <div className="flex items-center gap-3 font-ui text-[13px]">
                  <span className="text-accent">Step {i + 1}</span>
                  <span className="h-px w-6 bg-white/15" aria-hidden />
                  <span className="text-white/50">{s.tool}</span>
                </div>
                <h3 className="h3 mt-3">{s.title}</h3>
                <p className="mt-2 max-w-[460px] text-[15px] leading-relaxed text-white/60">{s.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
