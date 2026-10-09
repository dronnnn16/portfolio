import {
  AbsoluteFill,
  interpolateColors,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { MotionBlurWindow } from "../components/MotionBlur";
import { expoIn, lerp, pop, progress, wordReveal } from "../lib/motion";
import { COLORS, HEADLINE, W } from "../theme";

const FONT_SIZE = 186;
const SPACE_EM = 0.26;
const WORDS = ["are", "you", "looking", "to", "?"];
const STARTS = [6, 26, 46, 70, 92];

// Approximate Inter SemiBold advance widths (em) — only used to aim the camera.
const ADV: Record<string, number> = {
  a: 0.555,
  e: 0.565,
  g: 0.595,
  i: 0.255,
  k: 0.54,
  l: 0.255,
  n: 0.59,
  o: 0.59,
  r: 0.385,
  t: 0.36,
  u: 0.59,
  y: 0.53,
  "?": 0.5,
};
// Calibrated against a rendered frame (the table alone runs ~4% narrow).
const wordWidth = (w: string) =>
  [...w].reduce((s, ch) => s + (ADV[ch] ?? 0.55) - 0.04, 0) * FONT_SIZE * 1.045;

const widths = WORDS.map(wordWidth);
const space = SPACE_EM * FONT_SIZE;
const lineWidth =
  widths.reduce((a, b) => a + b, 0) + space * (WORDS.length - 1);
const centers = widths.map(
  (w, i) => widths.slice(0, i).reduce((a, b) => a + b + space, 0) + w / 2,
);
const finalOffset = (W - lineWidth) / 2;
// Keep the newest word near the center, but never pan past the framing that
// shows the whole question.
const offsets = centers.map((c) => Math.max(W / 2 - c, finalOffset));

const GREEN_60 = "rgba(37,211,102,0.6)";

const HookText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Camera tracking: eased steps toward each new word + a constant slow drift.
  let pan = offsets[0];
  for (let i = 1; i < WORDS.length; i++) {
    pan +=
      (offsets[i] - offsets[i - 1]) *
      progress(frame, STARTS[i] - 4, STARTS[i] + 40);
  }
  pan -= frame * 0.12;
  const camScale = lerp(1.05, 1.0, progress(frame, 0, 120));
  // Exit: the line pushes up and out.
  const exitText = progress(frame, 122, 146, expoIn);

  return (
    <AbsoluteFill
      style={{
        transform: `translateY(${-exitText * 900}px) scale(${camScale})`,
        filter: `blur(${exitText * 24}px)`,
        opacity: 1 - progress(frame, 136, 148),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: pan,
          top: "50%",
          transform: "translateY(-55%)",
          display: "flex",
          alignItems: "baseline",
          whiteSpace: "nowrap",
          fontSize: FONT_SIZE,
          lineHeight: 1.1,
          ...HEADLINE,
        }}
      >
        {WORDS.map((word, i) => {
          const settleAt = STARTS[i + 1] ?? 112;
          const color = interpolateColors(
            progress(frame, settleAt, settleAt + 22),
            [0, 1],
            [GREEN_60, COLORS.dark],
          );
          const isQ = word === "?";
          const s = isQ ? pop(frame, fps, STARTS[i]) : 1;
          return (
            <span
              key={word}
              style={{
                display: "inline-block",
                marginRight: i < WORDS.length - 1 ? `${SPACE_EM}em` : 0,
                color,
                ...(isQ
                  ? {
                      opacity: Math.min(1, s * 1.5),
                      transform: `scale(${s})`,
                      transformOrigin: "50% 80%",
                    }
                  : wordReveal(frame, STARTS[i])),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  // The mint sheet slides away, revealing the off-white stage.
  const exitSheet = progress(frame, 126, 150, expoIn);
  const sweep = lerp(-0.6, 1.6, frame / 150);

  return (
    <AbsoluteFill style={{ background: COLORS.offWhite }}>
      <AbsoluteFill
        style={{
          transform: `translateY(${-exitSheet * 1080}px)`,
          background: `linear-gradient(160deg, #FFFFFF 0%, ${COLORS.mint1} 48%, ${COLORS.mint2} 100%)`,
          overflow: "hidden",
        }}
      >
        {/* slow diagonal light sweep */}
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(115deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.65) 50%, rgba(255,255,255,0) 65%)",
            transform: `translateX(${sweep * 100 - 50}%) scaleX(1.6)`,
          }}
        />
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse at 80% 110%, rgba(37,211,102,0.16), rgba(37,211,102,0) 60%)",
          }}
        />
      </AbsoluteFill>
      <MotionBlurWindow from={122} to={150}>
        <HookText />
      </MotionBlurWindow>
    </AbsoluteFill>
  );
};
