import { site } from "@/data/site";
import { Logo } from "../Navbar";
import { ArrowUpRight } from "../ui/Arrow";

export function Footer() {
  return (
    <footer className="relative overflow-hidden pt-16">
      <div className="container-x">
        <div className="grid gap-12 border-t border-white/[0.08] pt-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-[320px] text-[15px] leading-relaxed text-white/55">
              {site.role} based in {site.location}. Working with clients worldwide.
            </p>
          </div>
          <nav aria-label="Footer">
            <h2 className="font-ui text-[14px] font-medium text-white/60">Quick links</h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {site.nav.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-[16px] text-white/75 transition-colors hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="font-ui text-[14px] font-medium text-white/60">Socials</h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {site.socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    {...(s.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="group inline-flex items-center gap-2 text-[16px] text-white/75 transition-colors hover:text-white"
                  >
                    <span className="w-20 text-white/55">{s.label}</span>
                    <span className="break-all">{s.handle}</span>
                    <ArrowUpRight className="size-3.5 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-14 flex flex-col justify-between gap-2 font-ui text-[13px] text-white/55 sm:flex-row">
          <span>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </span>
          <a href="#top" className="hover:text-white/70">
            Back to top
          </a>
        </div>
      </div>
      <p
        aria-hidden
        className="pointer-events-none mt-6 -mb-[0.12em] select-none text-center text-[clamp(7rem,32vw,28rem)] font-semibold leading-[0.9] tracking-[-0.06em]"
        style={{
          backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 80%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {site.name}
      </p>
    </footer>
  );
}
