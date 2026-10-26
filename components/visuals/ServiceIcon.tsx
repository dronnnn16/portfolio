import type { ServiceIcon as Kind } from "@/data/services";

const glyphs: Record<Kind, React.ReactNode> = {
  ui: (
    <>
      <rect x="4" y="6" width="24" height="18" rx="4" fill="currentColor" opacity=".35" />
      <rect x="4" y="6" width="24" height="5" rx="2.5" fill="currentColor" opacity=".9" />
      <rect x="8" y="14" width="9" height="2.6" rx="1.3" fill="currentColor" />
      <rect x="8" y="18.5" width="6" height="2.6" rx="1.3" fill="currentColor" opacity=".7" />
      <path d="M20 15.5 27 18l-3 1.2 2.2 3-1.6 1.1-2.2-3-1.7 2.6Z" fill="currentColor" />
    </>
  ),
  reels: (
    <>
      <rect x="9" y="3" width="14" height="26" rx="4" fill="currentColor" opacity=".35" />
      <rect x="9" y="3" width="14" height="26" rx="4" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M14 12.5v7l6-3.5-6-3.5Z" fill="currentColor" />
    </>
  ),
  youtube: (
    <>
      <rect x="3" y="7" width="26" height="18" rx="6" fill="currentColor" opacity=".35" />
      <rect x="3" y="7" width="26" height="18" rx="6" stroke="currentColor" strokeWidth="1.8" fill="none" />
      <path d="M13.5 11.5v9l7.5-4.5-7.5-4.5Z" fill="currentColor" />
    </>
  ),
};

/** Glossy, layered "3D" icon tile built from gradients + highlights. */
export function ServiceIcon({ kind }: { kind: Kind }) {
  return (
    <span className="relative inline-grid size-16 place-items-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 group-hover:rotate-[-6deg]">
      <span aria-hidden className="absolute inset-x-2 -bottom-2 h-4 rounded-full bg-accent/50 blur-md" />
      <span
        aria-hidden
        className="absolute inset-0 rounded-[18px] bg-[linear-gradient(160deg,#ff9a5e_0%,#fa6114_45%,#b93a06_100%)] shadow-[inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-4px_8px_rgba(80,20,0,0.45),0_10px_24px_-8px_rgba(250,97,20,0.7)]"
      />
      <span aria-hidden className="absolute inset-x-2 top-1 h-6 rounded-t-[14px] rounded-b-[40%] bg-gradient-to-b from-white/35 to-transparent" />
      <svg viewBox="0 0 32 32" className="relative size-8 text-white drop-shadow-[0_2px_3px_rgba(90,25,0,0.5)]" aria-hidden>
        {glyphs[kind]}
      </svg>
    </span>
  );
}
