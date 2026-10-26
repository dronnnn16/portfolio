import { seeded } from "@/lib/motion";

const LAYERS = 3;

/**
 * Tiny white dots plus a few 4-point sparkles, server-rendered.
 * Dots are split into a few layers and only the layer opacity animates,
 * so twinkling stays on the compositor instead of animating hundreds of elements.
 */
export function Starfield({
  seed = 1,
  count = 36,
  sparkles = 4,
  className = "",
}: {
  seed?: number;
  count?: number;
  sparkles?: number;
  className?: string;
}) {
  const r = seeded(seed);
  const dots = Array.from({ length: count }, () => ({
    x: r() * 100,
    y: r() * 100,
    s: r() < 0.85 ? 1 : 2,
    o: 0.3 + r() * 0.6,
  }));
  // Sparkles sit near the edges so they never land on headings or copy.
  const stars = Array.from({ length: sparkles }, (_, i) => ({
    x: i % 2 ? 88 + r() * 9 : 3 + r() * 9,
    y: 4 + r() * 92,
    s: 8 + r() * 8,
    d: 4 + r() * 4,
    delay: -r() * 6,
  }));
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {Array.from({ length: LAYERS }, (_, l) => (
        <div
          key={l}
          className="absolute inset-0 animate-twinkle-layer"
          style={{ "--tw-dur": `${4 + l * 1.7}s`, animationDelay: `${-l * 1.9}s` } as React.CSSProperties}
        >
          {dots
            .filter((_, i) => i % LAYERS === l)
            .map((d, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-white"
                style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, opacity: d.o }}
              />
            ))}
        </div>
      ))}
      {stars.map((s, i) => (
        <svg
          key={`s${i}`}
          viewBox="0 0 24 24"
          className="absolute animate-twinkle-layer text-white"
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.s,
              height: s.s,
              animationDelay: `${s.delay}s`,
              "--tw-dur": `${s.d}s`,
            } as React.CSSProperties
          }
        >
          <path fill="currentColor" d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0Z" />
        </svg>
      ))}
    </div>
  );
}
