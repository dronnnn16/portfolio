import { Navbar } from "@/components/Navbar";
import { Approach } from "@/components/sections/Approach";
import { Cta } from "@/components/sections/Cta";
import { Faq } from "@/components/sections/Faq";
import { Footer } from "@/components/sections/Footer";
import { Hero } from "@/components/sections/Hero";
import { LongForm } from "@/components/sections/LongForm";
import { Problem } from "@/components/sections/Problem";
import { Process } from "@/components/sections/Process";
import { Services } from "@/components/sections/Services";
import { Testimonials } from "@/components/sections/Testimonials";
import { Tools } from "@/components/sections/Tools";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main">
        <Hero />
        <LongForm />
        <Problem />
        <Approach />
        <Services />
        <Process />
        <Testimonials />
        <Tools />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
