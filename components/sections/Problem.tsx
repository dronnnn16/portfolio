import { problems } from "@/data/problems";
import { Section } from "../ui/Section";
import { SectionHeader } from "../ui/SectionHeader";
import { Stagger, StaggerItem } from "../ui/Reveal";
import { ProblemVisual } from "../visuals/ProblemVisuals";

export function Problem() {
  return (
    <Section id="problem" labelledBy="problem-title">
      <div className="container-x">
        <SectionHeader id="problem-title" label={problems.label} title={problems.title} sub={problems.sub} />
        <Stagger as="ul" className="mt-14 grid gap-4 md:mt-20 md:grid-cols-3 md:gap-5">
          {problems.items.map((p) => (
            <StaggerItem as="li" key={p.title} className="glass card-hover rounded-[20px] p-2">
              <ProblemVisual type={p.visual} />
              <div className="px-3 pb-4 pt-5">
                <h3 className="h3">{p.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/60">{p.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
