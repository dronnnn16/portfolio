import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AppIcon } from "../components/Icons";
import { MotionBlurWindow } from "../components/MotionBlur";
import { expoIn, lerp, pop, progress } from "../lib/motion";
import { COLORS } from "../theme";

const SIZE = 300;
const ZOOM_START = 72;

const IconLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const drop = pop(frame, fps, 4, { damping: 10, stiffness: 120 });
  const y = lerp(-760, 0, drop);
  const rot = lerp(20, 0, drop);
  const ringT = progress(frame, 30, 72, (t) => t);
  const zoom = progress(frame, ZOOM_START, 118, expoIn);
  const scale =
    lerp(1, 25, zoom) * (1 + 0.03 * progress(frame, 30, ZOOM_START, (t) => t));
  const glyph = 1 - progress(frame, ZOOM_START + 4, ZOOM_START + 28);

  return (
    <AbsoluteFill>
      {/* ground shadow */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            width: SIZE * 0.9,
            height: 40,
            marginTop: SIZE + 60,
            borderRadius: "50%",
            background: "rgba(7,94,84,0.22)",
            filter: "blur(22px)",
            opacity: drop * (1 - zoom),
            transform: `scale(${lerp(0.4, 1, drop)})`,
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        {ringT > 0 && ringT < 1 && (
          <div
            style={{
              position: "absolute",
              width: SIZE,
              height: SIZE,
              borderRadius: SIZE * 0.235,
              border: `${lerp(8, 2, ringT)}px solid ${COLORS.green}`,
              opacity: 0.45 * (1 - ringT),
              transform: `scale(${1 + ringT * 0.7})`,
              boxSizing: "border-box",
            }}
          />
        )}
        <div
          style={{
            transform: `translateY(${y}px) rotate(${rot}deg) scale(${scale})`,
            transformOrigin: "50% 88%",
            filter:
              zoom > 0.2
                ? undefined
                : `drop-shadow(0 30px 50px rgba(7,94,84,${0.28 * (1 - zoom * 5)}))`,
          }}
        >
          <AppIcon size={SIZE} glyphOpacity={glyph} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Scene6Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const flood = progress(frame, 104, 119, (t) => t);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 70% 70% at 50% 45%, #F6F6F6 0%, ${COLORS.logoBg} 70%)`,
      }}
    >
      <MotionBlurWindow from={84} to={120}>
        <IconLayer />
      </MotionBlurWindow>
      <AbsoluteFill style={{ background: COLORS.green, opacity: flood }} />
    </AbsoluteFill>
  );
};
