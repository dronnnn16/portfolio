import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { C, CONTRAST, EMOTION, LOGIC, SMALL, TEXTURE } from "./theme";
import { OFFSET } from "./sync";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const out = Easing.out(Easing.cubic);

/** Renders children only inside [from, to) of the global timeline (no frame reset). */
export const On: React.FC<{ from: number; to: number; children: React.ReactNode }> = ({ from, to, children }) => {
  const f = useCurrentFrame();
  return f >= from && f < to ? <AbsoluteFill>{children}</AbsoluteFill> : null;
};

/** Absolutely placed box, anchored on its centre (or left/right edge). */
export const At: React.FC<{
  x: number;
  y: number;
  align?: "center" | "left" | "right";
  children: React.ReactNode;
  z?: number;
}> = ({ x, y, align = "center", children, z }) => {
  const tx = align === "center" ? "-50%" : align === "right" ? "-100%" : "0";
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(${tx}, -50%)`,
        whiteSpace: "nowrap",
        textAlign: align,
        zIndex: z,
      }}
    >
      {children}
    </div>
  );
};

export const textured: React.CSSProperties = {
  backgroundImage: `url(${TEXTURE})`,
  backgroundSize: "cover",
  backgroundPosition: "center 40%",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
};

// ---------- the three voices ----------

/** Logic voice, small build-up word: fast fade/scale-in on the syllable. */
export const Small: React.FC<{ at: number; children: React.ReactNode; color?: string; size?: number }> = ({
  at,
  children,
  color = C.white,
  size = SMALL,
}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [at - 1, at + 1], [0, 1], clamp);
  const s = interpolate(f, [at - 1, at + 4], [0.92, 1], { ...clamp, easing: out });
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: LOGIC,
        fontWeight: 700,
        fontSize: size,
        color,
        opacity: o,
        transform: `scale(${s})`,
        marginRight: size * 0.28,
        letterSpacing: -0.5,
        textShadow: color === C.white ? "0 2px 10px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.5)" : undefined,
      }}
    >
      {children}
    </span>
  );
};

const land = (f: number, at: number, until: number) => {
  const o = interpolate(f, [at - 1, at + 1], [0, 1], clamp);
  const s1 = interpolate(f, [at - 1, at + 5], [1.15, 1], { ...clamp, easing: out });
  const drift = interpolate(f, [at + 5, Math.max(at + 6, until)], [1, 0.94], clamp);
  const blur = interpolate(f, [at - 1, at + 5], [8, 0], clamp);
  return { opacity: o, transform: `scale(${s1 * drift})`, filter: blur > 0.05 ? `blur(${blur}px)` : undefined };
};

/** Emotion voice: elegant script hero word. */
export const Hero: React.FC<{
  at: number;
  until: number;
  children: React.ReactNode;
  size: number;
  color?: string;
  fill?: boolean;
  shadow?: boolean;
}> = ({ at, until, children, size, color = C.white, fill, shadow }) => {
  const f = useCurrentFrame();
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: EMOTION,
        fontSize: size,
        lineHeight: 1.25,
        padding: "0 0.18em",
        color,
        textShadow: shadow ? "0 4px 18px rgba(0,0,0,0.45), 0 10px 60px rgba(0,0,0,0.35)" : undefined,
        ...(fill ? textured : {}),
        ...land(f, at, until),
      }}
    >
      {children}
    </span>
  );
};

/** Logic voice at its heaviest weight (image-filled word cards, "8 SAAL", final "sikhao"). */
export const Heavy: React.FC<{
  at: number;
  until: number;
  children: React.ReactNode;
  size: number;
  color?: string;
  fill?: boolean;
}> = ({ at, until, children, size, color = C.white, fill }) => {
  const f = useCurrentFrame();
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: LOGIC,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: -size * 0.04,
        marginRight: size * 0.28,
        color,
        ...(fill ? textured : {}),
        ...land(f, at, until),
      }}
    >
      {children}
    </span>
  );
};

/** Contrast voice: condensed caps slam, only for the negations. */
export const Slam: React.FC<{ at: number; until: number; children: React.ReactNode; size: number }> = ({
  at,
  until,
  children,
  size,
}) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [at, at + 4], [1.12, 1], { ...clamp, easing: out });
  const drift = interpolate(f, [at + 4, until], [1, 0.97], clamp);
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: CONTRAST,
        fontSize: size,
        lineHeight: 1,
        color: C.white,
        textTransform: "uppercase",
        marginRight: size * 0.2,
        opacity: f >= at ? 1 : 0,
        transform: `scale(${s * drift})`,
      }}
    >
      {children}
    </span>
  );
};

// ---------- surfaces ----------

export type CardKind = "white" | "leak" | "blue" | "black";

export const Card: React.FC<{ kind: CardKind }> = ({ kind }) => {
  const bg: Record<CardKind, string> = {
    white: `radial-gradient(ellipse 75% 75% at 50% 50%, #FFFFFF 55%, #E4E6EA 85%, #CFD2D8 100%)`,
    leak: [
      "radial-gradient(circle at 0% 0%, rgba(91,139,217,0.55) 0%, rgba(91,139,217,0) 38%)",
      "radial-gradient(circle at 100% 100%, rgba(47,111,224,0.45) 0%, rgba(47,111,224,0) 42%)",
      "radial-gradient(circle at 100% 0%, rgba(140,180,240,0.30) 0%, rgba(140,180,240,0) 30%)",
      "radial-gradient(ellipse 80% 80% at 50% 50%, #FFFFFF 60%, #EEF1F6 100%)",
    ].join(","),
    blue: `linear-gradient(135deg, ${C.royalA} 0%, ${C.royalB} 100%)`,
    black: "#000",
  };
  return <AbsoluteFill style={{ background: bg[kind] }} />;
};

export const Letterbox: React.FC = () => (
  <>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 130, background: "#000", zIndex: 50 }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 130, background: "#000", zIndex: 50 }} />
  </>
);

// ---------- A-roll ----------

export type Grade = "neutral" | "moody" | "bw";
const FILTER: Record<Grade, string> = {
  neutral: "contrast(1.06) saturate(0.92) brightness(1.01)",
  moody: "saturate(0.62) contrast(1.22) brightness(0.78)",
  bw: "grayscale(1) contrast(1.55) brightness(0.86)",
};

export type Framing = { s: number; cx: number; cy: number; tx: number; ty: number };
export const WIDE: Framing = { s: 1, cx: 960, cy: 540, tx: 960, ty: 540 };
export const PUNCH: Framing = { s: 1.15, cx: 960, cy: 420, tx: 960, ty: 420 };

const transformOf = (fr: Framing, push = 1) => {
  const s = fr.s * push;
  return `translate(${fr.tx - fr.cx * s}px, ${fr.ty - fr.cy * s}px) scale(${s})`;
};

const GradeOverlay: React.FC<{ grade: Grade }> = ({ grade }) =>
  grade === "bw" ? (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)" }} />
  ) : grade === "moody" ? (
    <>
      <AbsoluteFill style={{ background: "rgba(20,45,110,0.22)", mixBlendMode: "soft-light" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 62% 45%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.7) 100%)" }} />
    </>
  ) : (
    <AbsoluteFill style={{ background: "rgba(40,80,170,0.07)", mixBlendMode: "soft-light" }} />
  );

/** The take, in sync with the global timeline (source frame = OFFSET + output frame). */
export const ARoll: React.FC<{
  framing?: Framing;
  grade?: Grade;
  push?: [number, number, number, number]; // from, to, s0, s1
}> = ({ framing = WIDE, grade = "neutral", push }) => {
  const f = useCurrentFrame();
  const p = push ? interpolate(f, [push[0], push[1]], [push[2], push[3]], clamp) : 1;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <AbsoluteFill style={{ transform: transformOf(framing, p), transformOrigin: "0 0", filter: FILTER[grade] }}>
        <OffthreadVideo src={staticFile("take.mp4")} startFrom={OFFSET} muted />
      </AbsoluteFill>
      <GradeOverlay grade={grade} />
    </AbsoluteFill>
  );
};

/** Person cutout for text-behind-subject, same framing/grade as the A-roll under it. */
export const Cutout: React.FC<{ framing: Framing; grade: Grade; push?: [number, number, number, number] }> = ({
  framing,
  grade,
  push,
}) => {
  const f = useCurrentFrame();
  const p = push ? interpolate(f, [push[0], push[1]], [push[2], push[3]], clamp) : 1;
  const src = String(OFFSET + f).padStart(4, "0");
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: transformOf(framing, p), transformOrigin: "0 0", filter: FILTER[grade] }}>
        <Img src={staticFile(`turn/${src}.png`)} style={{ width: 1920, height: 1080 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** B&W montage shot: a crop of the take starting at its own source frame. */
export const Shot: React.FC<{ from: number; to: number; src: number; x: number; y: number; w: number }> = ({
  from,
  to,
  src,
  x,
  y,
  w,
}) => (
  <Sequence from={from} durationInFrames={to - from} layout="none">
    <ShotInner dur={to - from} src={src} x={x} y={y} w={w} />
  </Sequence>
);

const ShotInner: React.FC<{ dur: number; src: number; x: number; y: number; w: number }> = ({ dur, src, x, y, w }) => {
  const f = useCurrentFrame();
  const push = interpolate(f, [0, dur], [1, 1.04], clamp);
  const s = (1920 / w) * push;
  const cx = x + w / 2;
  const cy = y + (w * 9) / 16 / 2;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <AbsoluteFill
        style={{ transform: `translate(${960 - cx * s}px, ${540 - cy * s}px) scale(${s})`, transformOrigin: "0 0", filter: FILTER.bw }}
      >
        <OffthreadVideo src={staticFile("take.mp4")} startFrom={src} muted />
      </AbsoluteFill>
      <GradeOverlay grade="bw" />
    </AbsoluteFill>
  );
};

/** Slow scale-down for objects (award), 1.08 -> 1.0 over the hold. */
export const Settle: React.FC<{ from: number; to: number; children: React.ReactNode; s0?: number; s1?: number }> = ({
  from,
  to,
  children,
  s0 = 1.08,
  s1 = 1,
}) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [from, to], [s0, s1], { ...clamp, easing: Easing.out(Easing.quad) });
  return <div style={{ transform: `scale(${s})` }}>{children}</div>;
};
