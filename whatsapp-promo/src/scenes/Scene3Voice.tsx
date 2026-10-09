import {
  AbsoluteFill,
  interpolateColors,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Cursor, Ripple } from "../components/Cursor";
import { DoubleTick, MicIcon } from "../components/Icons";
import { At, Pill, PillButton } from "../components/Pill";
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
import { CHAT_DRIFT_END, CHAT_PILL } from "./Scene2Chat";
import { StageBg } from "./StageBg";

export const S3_HANDOFF = 150; // Scene 4 takes over the pill from here
export const VOICE_PILL = { w: 1000, h: 124 };

const BARS = 24;
const SLOT = 150; // right slot holding the Send button / ticks
const PAD = 18;
const BUTTON = { w: 134, h: 64 };
const SLOT_CENTER: [number, number] = [
  960 + VOICE_PILL.w / 2 - PAD - SLOT / 2,
  540,
];
const CLICK = 112;
const CLICK_POINT: [number, number] = [SLOT_CENTER[0] + 6, SLOT_CENTER[1] + 10];

export const Scene3Voice: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame >= S3_HANDOFF) {
    return <StageBg />;
  }

  // Pill morph: wider + shorter.
  const morph = progress(frame, 0, 32);
  const w = lerp(CHAT_PILL.w, VOICE_PILL.w, morph);
  const h = lerp(CHAT_PILL.h, VOICE_PILL.h, morph);
  const scale =
    lerp(CHAT_DRIFT_END, 1, morph) * drift(frame - 32, S3_HANDOFF - 32);

  const contentIn = progress(frame, 24, 40);
  const contentOut = 1 - progress(frame, S3_HANDOFF - 8, S3_HANDOFF - 2);
  const content = contentIn * contentOut;

  const micPop = pop(frame, fps, 22);
  const recording = frame < CLICK + 2;
  const recT = Math.min(frame, CLICK + 2);
  const seconds = Math.floor(
    lerp(
      0,
      7,
      progress(recT, 32, 104, (t) => t),
    ),
  );
  const sent = progress(frame, CLICK + 2, CLICK + 14);

  // Cursor
  const glide = progress(frame, 56, 102, expoOut);
  const [cx, cy] = quad([2060, 1240], [1780, 640], CLICK_POINT, glide);
  const hover = progress(frame, 92, 104);
  const press = clamp01(
    progress(frame, CLICK, CLICK + 4) - progress(frame, CLICK + 6, CLICK + 18),
  );
  const leave = progress(frame, 124, 142);
  const sendPop = pop(frame, fps, 36);
  const sendOut = progress(frame, CLICK + 6, CLICK + 16);
  const btnScale =
    lerp(lerp(1, 1.05, hover), 0.94, press) * sendPop * (1 - sendOut);

  const tickDraw = progress(frame, CLICK + 10, CLICK + 26);
  const tickColor = interpolateColors(
    progress(frame, CLICK + 28, CLICK + 34),
    [0, 1],
    [COLORS.tickGrey, COLORS.read],
  );

  // Recording pulse ring around the mic
  const ringT = ((frame - 30) % 36) / 36;

  return (
    <AbsoluteFill>
      <StageBg />
      <At
        x={960}
        y={540}
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <Pill
          width={w}
          height={h}
          padding={PAD}
          gap={28}
          style={{ overflow: "visible" }}
        >
          {/* mic */}
          <div
            style={{
              position: "relative",
              width: 88,
              height: 88,
              flexShrink: 0,
              opacity: content,
            }}
          >
            {recording && frame > 30 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: COLORS.green,
                  opacity: 0.25 * (1 - ringT),
                  transform: `scale(${1 + ringT * 0.45})`,
                }}
              />
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: `linear-gradient(145deg, #3BE07A, ${COLORS.green} 50%, ${COLORS.teal})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${micPop})`,
                boxShadow:
                  "inset 0 0 0 1px rgba(255,255,255,0.35), 0 8px 20px rgba(37,211,102,0.3)",
              }}
            >
              <MicIcon size={46} />
            </div>
          </div>

          {/* waveform */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 80,
              padding: "0 6px",
              opacity: content,
            }}
          >
            {new Array(BARS).fill(0).map((_, i) => {
              const appear = progress(frame, 26 + i * 1.2, 40 + i * 1.2);
              const live =
                0.5 +
                0.32 * Math.sin(recT * 0.21 + i * 0.62) +
                0.18 * Math.sin(recT * 0.37 - i * 1.13);
              const resting =
                0.3 +
                0.55 *
                  Math.abs(Math.sin(i * 1.7 + 0.4)) *
                  (1 - Math.abs(i - 11.5) / 16);
              const amp = lerp(live, resting, sent);
              const played = sent > 0 && i / BARS < sent;
              return (
                <div
                  key={i}
                  style={{
                    width: 8,
                    height: Math.max(8, 72 * clamp01(amp) * appear),
                    borderRadius: 4,
                    background:
                      played || !recording ? COLORS.teal : COLORS.green,
                    opacity: lerp(0.95, 0.75, (i % 2) * 0.5),
                  }}
                />
              );
            })}
          </div>

          {/* timer */}
          <div
            style={{
              fontFamily: FONT,
              fontSize: 36,
              fontWeight: 500,
              color: COLORS.dark,
              fontVariantNumeric: "tabular-nums",
              width: 80,
              flexShrink: 0,
              opacity: contentOut,
              ...wordReveal(frame, 30, 20, 16, 8),
            }}
          >
            0:0{seconds}
          </div>

          {/* right slot: Send → read ticks */}
          <div
            style={{
              width: SLOT,
              height: BUTTON.h,
              flexShrink: 0,
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: contentOut,
            }}
          >
            <PillButton
              label="Send"
              height={BUTTON.h}
              style={{
                position: "absolute",
                width: BUTTON.w,
                padding: 0,
                fontFamily: FONT,
                transform: `scale(${btnScale})`,
                filter: `brightness(${1 + hover * 0.1 - press * 0.06})`,
                opacity: Math.min(1, sendPop * 1.4) * (1 - sendOut),
              }}
            >
              <Ripple
                x={BUTTON.w / 2 + 6}
                y={BUTTON.h / 2 + 10}
                t={(frame - CLICK) / 22}
                radius={100}
              />
            </PillButton>
            {tickDraw > 0 && (
              <DoubleTick width={64} color={tickColor} draw={tickDraw} />
            )}
          </div>
        </Pill>
      </At>
      {glide > 0 && (
        <AbsoluteFill
          style={{ transform: `translate(${leave * 40}px, ${leave * 30}px)` }}
        >
          <Cursor
            x={cx}
            y={cy}
            press={press}
            opacity={fade(frame, 56, 62) * (1 - leave)}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
