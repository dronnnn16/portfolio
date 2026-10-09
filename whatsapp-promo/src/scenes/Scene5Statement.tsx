import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { MotionBlurWindow } from "../components/MotionBlur";
import {
  blurOut,
  drift,
  expoIn,
  expoOut,
  lerp,
  pop,
  progress,
} from "../lib/motion";
import { COLORS, FONT } from "../theme";

const TEXT_STYLE = {
  fontFamily: FONT,
  fontWeight: 500,
  fontSize: 120,
  letterSpacing: "-0.035em",
  color: COLORS.white,
  lineHeight: 1.1,
  whiteSpace: "nowrap",
} as const;

const DOT = 24;

/** Animated 3% film grain. */
const Grain: React.FC<{ frame: number }> = ({ frame }) => (
  <svg
    width="100%"
    height="100%"
    style={{ position: "absolute", inset: 0, opacity: 0.03 }}
  >
    <filter id="grain">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.85"
        numOctaves={2}
        seed={Math.floor(frame) % 97}
        stitchTiles="stitch"
      />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)" />
  </svg>
);

export const DeepBg: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(160deg, ${COLORS.deep1} 0%, ${COLORS.deep2} 100%)`,
    }}
  >
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 60% 55% at ${12 + frame * 0.02}% 8%, rgba(37,211,102,0.16), rgba(37,211,102,0) 70%)`,
      }}
    />
    <Grain frame={frame} />
  </AbsoluteFill>
);

const AllInOne: React.FC = () => {
  const frame = useCurrentFrame();
  // Wiper pill streaks in from the left, revealing the text, then collapses into the period.
  const travel = progress(frame, 2, 36, expoOut);
  const shrink = progress(frame, 32, 52, expoOut);
  const pillW = lerp(320, DOT, shrink);
  const pillH = lerp(140, DOT, shrink);
  const startRight = -1400; // px left of the text block
  const edgePx = (1 - travel) * startRight - pillW;
  const pillLeft = `calc(${travel * 100}% ${edgePx >= 0 ? "+" : "-"} ${Math.abs(edgePx)}px)`;
  // Text is visible up to the pill's center (the span is the row minus the dot slot).
  const insetPx = -(1 - travel) * startRight + pillW / 2 - travel * (DOT + 14);
  const textReveal = `inset(-40% calc(${(1 - travel) * 100}% ${insetPx >= 0 ? "+" : "-"} ${Math.abs(insetPx)}px) -40% -10%)`;
  const exit = blurOut(frame, 72, 14);
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", ...exit }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "baseline",
          transform: `scale(${drift(frame, 90, 0.03)})`,
        }}
      >
        <span style={{ ...TEXT_STYLE, clipPath: textReveal }}>
          All in one app
        </span>
        <span style={{ display: "inline-block", width: DOT + 14 }} />
        <div
          style={{
            position: "absolute",
            left: pillLeft,
            bottom: lerp((132 - 140) / 2, 22, shrink),
            width: pillW,
            height: pillH,
            borderRadius: 999,
            background: COLORS.green,
            boxShadow: `0 0 ${lerp(60, 0, shrink)}px rgba(37,211,102,0.45)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const WORDS = ["Chat", "Call", "Share"];

const ChatCallShare: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const exit = blurOut(frame, 146, 14, -20, 20);
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", ...exit }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 40,
          transform: `scale(${drift(frame - 90, 70)})`,
        }}
      >
        {WORDS.map((word, i) => {
          const s = pop(frame, fps, 88 + i * 14);
          const d = pop(frame, fps, 95 + i * 14);
          return (
            <div
              key={word}
              style={{ display: "flex", alignItems: "center", gap: 40 }}
            >
              <span
                style={{
                  ...TEXT_STYLE,
                  display: "inline-block",
                  opacity: Math.min(1, s * 1.4),
                  transform: `translateY(${(1 - s) * 30}px) scale(${lerp(0.7, 1, s)})`,
                  filter: `blur(${Math.max(0, 1 - s) * 10}px)`,
                }}
              >
                {word}
              </span>
              {i < WORDS.length - 1 && (
                <span
                  style={{
                    width: DOT,
                    height: DOT,
                    borderRadius: "50%",
                    background: COLORS.green,
                    transform: `scale(${d})`,
                    boxShadow: "0 0 24px rgba(37,211,102,0.6)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Introducing: React.FC<{ frame: number }> = ({ frame }) => {
  const rise = progress(frame, 160, 186);
  const out = progress(frame, 192, 210, expoIn);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          ...TEXT_STYLE,
          fontSize: 96,
          color: "rgba(255,255,255,0.6)",
          opacity: rise * (1 - out),
          transform: `translateY(${(1 - rise) * 80}px) scale(${lerp(1, 0.92, out) * drift(frame - 160, 50, 0.02)})`,
          filter: `blur(${(1 - rise) * 20 + out * 6}px)`,
        }}
      >
        Introducing
      </div>
    </AbsoluteFill>
  );
};

export const Scene5Statement: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <DeepBg frame={frame} />
      {frame < 88 && (
        <MotionBlurWindow from={2} to={34}>
          <AllInOne />
        </MotionBlurWindow>
      )}
      {frame >= 84 && frame < 162 && <ChatCallShare frame={frame} fps={fps} />}
      {frame >= 158 && <Introducing frame={frame} />}
    </AbsoluteFill>
  );
};
