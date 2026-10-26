import { longForm } from "@/data/site";
import { Reveal } from "../ui/Reveal";
import { SectionHeader } from "../ui/SectionHeader";
import { ReelCarousel } from "../visuals/ReelCarousel";

/** Horizontal 16:9 counterpart to the hero's vertical reel carousel. */
export function LongForm() {
  return (
    <section id="long-form" aria-labelledby="long-form-title" className="relative isolate overflow-hidden pb-24 pt-16 md:pb-32 md:pt-24">
      <div className="container-x">
        <SectionHeader id="long-form-title" label={longForm.label} title={longForm.title} sub={longForm.sub} />
      </div>
      <Reveal blur={false} className="mt-14 md:mt-20">
        <ReelCarousel
          reels={longForm.items}
          orientation="horizontal"
          direction={-1}
          label="Long-form and SaaS project clips"
        />
      </Reveal>
    </section>
  );
}
