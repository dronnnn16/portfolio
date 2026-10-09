import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Avatar } from "../components/Avatar";
import { AppIcon } from "../components/Icons";
import { drift, fade, lerp, pop, progress, wordReveal } from "../lib/motion";
import { COLORS, FONT, HEADLINE } from "../theme";

const R = 560;
const CX = 960;
const CY = 1150;
const N = 1500;
const TILT = 0.38;

type Vec = [number, number, number];

// Fibonacci sphere, computed once.
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const POINTS: Vec[] = new Array(N).fill(0).map((_, i) => {
  const y = 1 - (2 * (i + 0.5)) / N;
  const r = Math.sqrt(1 - y * y);
  const phi = i * GOLDEN;
  return [Math.cos(phi) * r, y, Math.sin(phi) * r];
});

const yawAt = (frame: number) =>
  0.4 + 0.7 * Math.sin((Math.min(frame, 180) / 180) * (Math.PI / 2));

/** Model → view: yaw about Y, then tilt about X. z > 0 faces the viewer. */
const toView = ([x, y, z]: Vec, yaw: number): Vec => {
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const y2 = y * Math.cos(TILT) - z1 * Math.sin(TILT);
  const z2 = y * Math.sin(TILT) + z1 * Math.cos(TILT);
  return [x1, y2, z2];
};

/** Inverse of toView. */
const toModel = ([x, y, z]: Vec, yaw: number): Vec => {
  const y1 = y * Math.cos(TILT) + z * Math.sin(TILT);
  const z1 = -y * Math.sin(TILT) + z * Math.cos(TILT);
  return [
    x * Math.cos(yaw) - z1 * Math.sin(yaw),
    y1,
    x * Math.sin(yaw) + z1 * Math.cos(yaw),
  ];
};

const fromScreenDir = (vx: number, vy: number): Vec => [
  vx,
  vy,
  Math.sqrt(Math.max(0, 1 - vx * vx - vy * vy)),
];

const REF_YAW = yawAt(110);
const PINS = [
  {
    text: "Hola",
    initials: "MG",
    from: "#3BE07A",
    to: COLORS.teal,
    v: [-0.58, 0.42],
  },
  {
    text: "Hi!",
    initials: "JS",
    from: COLORS.teal,
    to: COLORS.dark,
    v: [-0.3, 0.68],
  },
  {
    text: "Namaste",
    initials: "PS",
    from: COLORS.green,
    to: "#0E9F6E",
    v: [0.04, 0.46],
  },
  {
    text: "Bonjour",
    initials: "LD",
    from: "#2FC98A",
    to: COLORS.dark,
    v: [0.35, 0.7],
  },
  {
    text: "Ciao",
    initials: "GR",
    from: COLORS.green,
    to: COLORS.teal,
    v: [0.62, 0.4],
  },
].map((p) => ({
  ...p,
  model: toModel(fromScreenDir(p.v[0], p.v[1]), REF_YAW),
}));

const PIN_START = 44;
const PIN_STEP = 12;

export const Scene7Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const yaw = yawAt(frame);
  const rise = progress(frame, 2, 62);
  const cy = lerp(CY + 760, CY, rise);
  const settle = progress(frame, 140, 176);

  const anchors = PINS.map((p) => {
    const [x, y, z] = toView(p.model, yaw);
    return { x: CX + R * x, y: cy - R * y, z };
  });

  // Counter
  const count = 3 * progress(frame, 10, 86);
  const done = count >= 2.999;
  const numText = done ? "3" : count.toFixed(1);
  const donePop = done ? 1 + 0.06 * (1 - pop(frame, fps, 86)) : 1;

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 80% 90% at 50% 40%, ${COLORS.green} 0%, #1DB26A 30%, ${COLORS.teal} 62%, ${COLORS.dark} 100%)`,
        }}
      />
      {/* continue the flat green from the logo zoom, then reveal the radial gradient */}
      <AbsoluteFill
        style={{
          background: COLORS.green,
          opacity: 1 - progress(frame, 0, 34, (t) => t),
        }}
      />

      {/* globe */}
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="96%" stopColor="#ffffff" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </radialGradient>
          <radialGradient id="globeShade" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#04241D" stopOpacity={0.18} />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={cy} r={R * 1.04} fill="url(#globeGlow)" />
        <circle cx={CX} cy={cy} r={R} fill="url(#globeShade)" />
        {POINTS.map((p, i) => {
          const [x, y, z] = toView(p, yaw);
          if (z <= 0.02) return null;
          const sx = CX + R * x;
          const sy = cy - R * y;
          if (sy > 1090 || sy < -10) return null;
          return (
            <circle
              key={i}
              cx={sx}
              cy={sy}
              r={3.2 * (0.55 + 0.45 * z)}
              fill="#fff"
              opacity={0.4 * (0.3 + 0.7 * z)}
            />
          );
        })}

        {/* dashed arcs between consecutive pins */}
        {anchors.slice(1).map((b, i) => {
          const a = anchors[i];
          const t0 = PIN_START + (i + 1) * PIN_STEP - 4;
          const draw = progress(frame, t0, t0 + 20);
          if (draw <= 0) return null;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const nx = mx - CX;
          const ny = my - cy;
          const nl = Math.hypot(nx, ny) || 1;
          const lift = Math.hypot(b.x - a.x, b.y - a.y) * 0.32;
          const c = [mx + (nx / nl) * lift, my + (ny / nl) * lift];
          const d = `M ${a.x} ${a.y} Q ${c[0]} ${c[1]} ${b.x} ${b.y}`;
          return (
            <g key={i}>
              <mask
                id={`arc-${i}`}
                maskUnits="userSpaceOnUse"
                x={0}
                y={0}
                width={1920}
                height={1080}
              >
                <path
                  d={d}
                  pathLength={1}
                  stroke="#fff"
                  strokeWidth={10}
                  fill="none"
                  strokeDasharray={`${draw} 1`}
                />
              </mask>
              <path
                d={d}
                fill="none"
                stroke="#fff"
                strokeOpacity={0.7}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="2 12"
                strokeDashoffset={-frame * 0.9}
                mask={`url(#arc-${i})`}
              />
            </g>
          );
        })}
      </svg>

      {/* pins */}
      {PINS.map((p, i) => {
        const a = anchors[i];
        const s = pop(frame, fps, PIN_START + i * PIN_STEP);
        if (s <= 0.001 || a.z <= 0) return null;
        return (
          <div
            key={p.text}
            style={{ position: "absolute", left: a.x, top: a.y }}
          >
            {/* anchor dot */}
            <div
              style={{
                position: "absolute",
                left: -8,
                top: -8,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: COLORS.white,
                boxShadow: "0 0 0 6px rgba(255,255,255,0.22)",
                transform: `scale(${s})`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: 22,
                transform: `translateX(-50%) scale(${s * drift(frame - PIN_START - i * PIN_STEP, 120)})`,
                transformOrigin: "50% 100%",
                opacity: Math.min(1, s * 1.5),
              }}
            >
              <div
                style={{
                  height: 68,
                  borderRadius: 999,
                  background: COLORS.white,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "0 26px 0 10px",
                  boxShadow:
                    "0 16px 40px rgba(4,36,29,0.25), inset 0 0 0 1px rgba(255,255,255,0.6)",
                  fontFamily: FONT,
                  fontSize: 28,
                  fontWeight: 600,
                  color: COLORS.dark,
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.01em",
                }}
              >
                <Avatar
                  initials={p.initials}
                  size={48}
                  from={p.from}
                  to={p.to}
                />
                {p.text}
              </div>
            </div>
          </div>
        );
      })}

      {/* counter */}
      <AbsoluteFill style={{ alignItems: "center", top: 170 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 40,
            color: COLORS.white,
            whiteSpace: "nowrap",
            transform: `scale(${drift(frame, 180)})`,
          }}
        >
          <div
            style={{
              ...HEADLINE,
              fontSize: 200,
              lineHeight: 1,
              ...wordReveal(frame, 8, 30),
            }}
          >
            <span
              style={{
                display: "inline-block",
                fontVariantNumeric: "tabular-nums",
                transform: `scale(${donePop})`,
                transformOrigin: "50% 80%",
              }}
            >
              {numText}
            </span>{" "}
            billion+
          </div>
          <div
            style={{
              ...HEADLINE,
              fontWeight: 400,
              fontSize: 120,
              lineHeight: 1,
              color: "rgba(255,255,255,0.62)",
              ...wordReveal(frame, 20, 30),
            }}
          >
            people
          </div>
        </div>
      </AbsoluteFill>

      {/* settle: darken the bottom so the tagline reads */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(4,36,29,0.72) 0%, rgba(4,36,29,0.3) 8%, rgba(4,36,29,0) 17%)",
          opacity: settle,
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 52,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            opacity: fade(frame, 140, 160),
            transform: `translateY(${(1 - progress(frame, 140, 168)) * 24}px)`,
            filter: `blur(${(1 - progress(frame, 140, 164)) * 8}px)`,
          }}
        >
          <AppIcon size={60} />
          <div
            style={{
              fontFamily: FONT,
              fontSize: 38,
              fontWeight: 500,
              color: COLORS.white,
              letterSpacing: "-0.01em",
            }}
          >
            Simple. Reliable. Private.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
