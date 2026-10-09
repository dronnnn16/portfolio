import {
  AbsoluteFill,
  interpolateColors,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Avatar } from "../components/Avatar";
import { Cursor, Ripple } from "../components/Cursor";
import { PillButton, Pill, At } from "../components/Pill";
import {
  clamp01,
  drift,
  expoOut,
  fade,
  lerp,
  pop,
  progress,
  quad,
  wordReveal,
} from "../lib/motion";
import { COLORS, FONT } from "../theme";
import { StageBg } from "./StageBg";

export const S2_HANDOFF = 168; // Scene 3 takes over the pill from here
export const CHAT_PILL = { w: 720, h: 150 };
export const CHAT_DRIFT_END = 1.03;

const CLICK = 128;
const BUTTON = { w: 146, h: 68 };
const BUTTON_CENTER: [number, number] = [
  960 + CHAT_PILL.w / 2 - 22 - BUTTON.w / 2,
  540,
];
const CLICK_POINT: [number, number] = [
  BUTTON_CENTER[0] + 8,
  BUTTON_CENTER[1] + 10,
];

export const TypingDots: React.FC<{ frame: number; color: string }> = ({
  frame,
  color,
}) => (
  <span
    style={{
      display: "inline-flex",
      gap: 6,
      marginLeft: 10,
      transform: "translateY(-4px)",
    }}
  >
    {[0, 1, 2].map((i) => {
      const t = (frame / 22 - i * 0.28) * Math.PI;
      const up = Math.max(0, Math.sin(t));
      return (
        <span
          key={i}
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: color,
            opacity: 0.45 + 0.55 * up,
            transform: `translateY(${-up * 7}px)`,
          }}
        />
      );
    })}
  </span>
);

export const Scene2Chat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame >= S2_HANDOFF) {
    return <StageBg />;
  }

  // Dot → pill
  const dot = pop(frame, fps, 4);
  const open = pop(frame, fps, 16);
  const w = lerp(28, CHAT_PILL.w, open);
  const h = lerp(28, CHAT_PILL.h, open);
  const bg = interpolateColors(
    clamp01(open * 1.8),
    [0, 1],
    [COLORS.green, COLORS.white],
  );
  const scale =
    (frame < 16 ? dot : 1) * drift(frame, S2_HANDOFF, CHAT_DRIFT_END - 1);

  const contentOut = 1 - progress(frame, S2_HANDOFF - 8, S2_HANDOFF - 2);
  const avatarPop = pop(frame, fps, 32);
  const buttonPop = pop(frame, fps, 50);
  const tilt = 12 * Math.sin((frame / 120) * Math.PI * 2);

  // Cursor: glides in from bottom-right on an eased curve.
  const glide = progress(frame, 64, 116, expoOut);
  const [cx, cy] = quad([2060, 1220], [1760, 600], CLICK_POINT, glide);
  const hover = progress(frame, 104, 116);
  const press =
    progress(frame, CLICK, CLICK + 4) - progress(frame, CLICK + 6, CLICK + 18);
  const leave = progress(frame, 146, 166);
  const btnScale = lerp(lerp(1, 1.05, hover), 0.94, clamp01(press)) * buttonPop;

  return (
    <AbsoluteFill>
      <StageBg />
      <At
        x={960}
        y={540}
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <Pill width={w} height={h} background={bg} padding={22} gap={26}>
          {open > 0.55 && (
            <>
              <Avatar
                initials="AK"
                size={106}
                tiltY={tilt}
                style={{
                  transform: `scale(${avatarPop})`,
                  opacity: contentOut,
                }}
              />
              <div
                style={{
                  flex: 1,
                  fontFamily: FONT,
                  opacity: contentOut,
                  whiteSpace: "nowrap",
                }}
              >
                <div
                  style={{
                    fontSize: 40,
                    fontWeight: 700,
                    color: COLORS.ink,
                    letterSpacing: "-0.02em",
                    ...wordReveal(frame, 38, 22, 20, 8),
                  }}
                >
                  Aarav
                </div>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 500,
                    color: COLORS.teal,
                    marginTop: 2,
                    display: "flex",
                    alignItems: "center",
                    ...wordReveal(frame, 44, 22, 20, 8),
                  }}
                >
                  typing
                  <TypingDots frame={frame} color={COLORS.teal} />
                </div>
              </div>
              <PillButton
                label="Reply"
                height={BUTTON.h}
                style={{
                  width: BUTTON.w,
                  padding: 0,
                  fontFamily: FONT,
                  transform: `scale(${btnScale})`,
                  filter: `brightness(${1 + hover * 0.1 - clamp01(press) * 0.06})`,
                  opacity: contentOut * Math.min(1, buttonPop * 1.4),
                }}
              >
                <Ripple
                  x={BUTTON.w / 2 + 8}
                  y={BUTTON.h / 2 + 10}
                  t={(frame - CLICK) / 26}
                  radius={110}
                />
              </PillButton>
            </>
          )}
        </Pill>
      </At>
      {glide > 0 && (
        <AbsoluteFill
          style={{ transform: `translate(${leave * 40}px, ${leave * 30}px)` }}
        >
          <Cursor
            x={cx}
            y={cy}
            press={clamp01(press)}
            opacity={fade(frame, 64, 70) * (1 - leave)}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
