import { BlurText, Reveal } from "./Reveal";
import { SectionLabel } from "./SectionLabel";

export function SectionHeader({
  label,
  title,
  sub,
  id,
}: {
  label: string;
  title: string;
  sub?: string;
  id?: string;
}) {
  return (
    <header className="relative mx-auto flex max-w-[860px] flex-col items-center text-center">
      {/* soft radial orange glow behind each section header */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-[320px] w-[min(760px,120vw)] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(250,97,20,0.22),rgba(250,97,20,0.06)_55%,transparent)]"
      />
      <SectionLabel>{label}</SectionLabel>
      <BlurText as="h2" id={id} text={title} className="h2 relative mt-5" />
      {sub && (
        <Reveal delay={0.15} className="relative mt-5 max-w-[560px]">
          <p className="lead">
            {sub}
          </p>
        </Reveal>
      )}
    </header>
  );
}
