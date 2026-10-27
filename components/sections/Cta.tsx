import { cta } from "@/data/cta";
import { Button } from "../ui/Button";
import { BlurText, Reveal } from "../ui/Reveal";

export function Cta() {
  return (
    <section id="contact" aria-labelledby="cta-title" className="relative scroll-mt-24 pb-4 pt-20 md:pt-28">
      <div className="container-x">
        <Reveal blur={false} className="relative isolate overflow-hidden rounded-[24px] border border-white/10 px-6 py-20 text-center md:py-28">
          <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_50%_100%,rgba(250,97,20,0.55),rgba(226,87,32,0.18)_45%,transparent_75%),linear-gradient(180deg,rgba(20,12,7,0.55),rgba(10,5,2,0.75))]" />
          <div aria-hidden className="absolute -bottom-40 left-1/2 -z-10 h-80 w-[70%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(250,97,20,0.5),transparent)]" />
          <BlurText as="h2" id="cta-title" text={cta.title} className="h2 mx-auto max-w-[820px]" />
          <Reveal delay={0.2} className="mt-10 flex justify-center">
            <Button href={cta.button.href} variant="white">
              {cta.button.label}
            </Button>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-6 font-ui text-[14px] text-white/60">{cta.line}</p>
          </Reveal>
        </Reveal>
      </div>
    </section>
  );
}
