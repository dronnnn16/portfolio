import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Avatar } from "../components/Avatar";
import { ChatBubbleIcon, VideoIcon } from "../components/Icons";
import { MotionBlurWindow } from "../components/MotionBlur";
import { At, Pill } from "../components/Pill";
import { drift, expoInOut, lerp, pop, progress } from "../lib/motion";
import { COLORS, FONT } from "../theme";
import { StageBg } from "./StageBg";
import { VOICE_PILL } from "./Scene3Voice";

const NOTE = { w: 880, h: 150 };
const DARK_SHADOW = "0 24px 60px rgba(7,94,84,0.28)";

const NotificationPill: React.FC<{
  icon: ReactNode;
  title: string;
  body: string;
  time: string;
  children?: ReactNode;
}> = ({ icon, title, body, time, children }) => (
  <Pill
    width={NOTE.w}
    height={NOTE.h}
    background={`linear-gradient(180deg, #0A6B5F 0%, ${COLORS.dark} 100%)`}
    shadow={DARK_SHADOW}
    padding={24}
    gap={28}
    style={{
      boxShadow: `${DARK_SHADOW}, inset 0 0 0 1px rgba(255,255,255,0.14)`,
      overflow: "visible",
    }}
  >
    <div
      style={{ position: "relative", width: 102, height: 102, flexShrink: 0 }}
    >
      {children}
      {icon}
    </div>
    <div
      style={{ flex: 1, fontFamily: FONT, whiteSpace: "nowrap", minWidth: 0 }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: "rgba(255,255,255,0.7)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 600,
          color: COLORS.white,
          letterSpacing: "-0.02em",
          marginTop: 2,
        }}
      >
        {body}
      </div>
    </div>
    <div
      style={{
        height: 50,
        padding: "0 22px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.14)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
        color: "rgba(255,255,255,0.85)",
        fontFamily: FONT,
        fontSize: 24,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {time}
    </div>
  </Pill>
);

const MessageIcon: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: 30,
      background: COLORS.white,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
    }}
  >
    <ChatBubbleIcon size={78} />
  </div>
);

const CallIcon: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.14)",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <VideoIcon size={50} />
  </div>
);

const NotifyLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 3D tilt, then a card flip that lands on the back face.
  const tilt = progress(frame, 4, 26);
  const flip = progress(frame, 24, 62, expoInOut);
  const rotX = lerp(0, 50, tilt) + flip * 130;
  const rotZ = lerp(0, -18, tilt) * (1 - progress(frame, 24, 64));
  const lift = 1 + 0.06 * tilt * (1 - flip);
  const showBack = rotX > 90;
  const faceRotX = showBack ? rotX - 180 : rotX;

  // Stack: front pill moves up while two more slide out from behind it.
  const stackIn = progress(frame, 80, 120);
  const frontY = lerp(540, 380, stackIn);
  const rise = lerp(
    0,
    -28,
    progress(frame, 64, 162, (t) => t),
  );
  const s2 = pop(frame, fps, 86);
  const s3 = pop(frame, fps, 100);
  const slot2 = frontY + NOTE.h / 2 + 16 + (NOTE.h * 0.94) / 2;
  const slot3 = slot2 + (NOTE.h * 0.94) / 2 + 16 + (NOTE.h * 0.88) / 2;

  const ringT = progress(frame, 60, 104, (t) => t);
  const lifeScale = drift(frame - 62, 100);

  return (
    <AbsoluteFill style={{ transform: `translateY(${rise}px)` }}>
      {/* stacked behind */}
      {[
        { s: s3, y: slot3, scale: 0.88, opacity: 0.6, key: "call" },
        { s: s2, y: slot2, scale: 0.94, opacity: 0.82, key: "group" },
      ].map(({ s, y, scale, opacity, key }) =>
        s > 0.001 ? (
          <At
            key={key}
            x={960}
            y={lerp(frontY, y, s)}
            style={{
              transform: `translate(-50%, -50%) scale(${lerp(0.8, scale, s)})`,
              opacity: Math.min(1, s * 1.3) * opacity,
            }}
          >
            {key === "group" ? (
              <NotificationPill
                icon={
                  <Avatar
                    initials="FG"
                    size={102}
                    from="#3BE07A"
                    to={COLORS.teal}
                  />
                }
                title="Family Group"
                body="12 new messages"
                time="2m"
              />
            ) : (
              <NotificationPill
                icon={<CallIcon />}
                title="Missed video call"
                body="Riya"
                time="5m"
              />
            )}
          </At>
        ) : null,
      )}

      {/* front card */}
      <At
        x={960}
        y={frontY}
        style={{
          transform: `translate(-50%, -50%) perspective(1800px) rotateZ(${rotZ}deg) rotateX(${faceRotX}deg) scale(${lift * (showBack ? lifeScale : 1)})`,
        }}
      >
        {showBack ? (
          <NotificationPill
            icon={<MessageIcon />}
            title="New message"
            body="Aarav: See you at 7?"
            time="now"
          >
            {ringT > 0 && ringT < 1 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 30 + ringT * 40,
                  background: "rgba(37,211,102,0.25)",
                  border: `${lerp(6, 2, ringT)}px solid rgba(37,211,102,0.25)`,
                  opacity: (1 - ringT) * Math.min(1, ringT * 6),
                  transform: `scale(${1 + ringT * 1.2})`,
                  boxSizing: "border-box",
                }}
              />
            )}
          </NotificationPill>
        ) : (
          <Pill width={VOICE_PILL.w} height={VOICE_PILL.h} />
        )}
      </At>
    </AbsoluteFill>
  );
};

export const Scene4Notify: React.FC = () => (
  <AbsoluteFill>
    <StageBg />
    <MotionBlurWindow from={30} to={58}>
      <NotifyLayer />
    </MotionBlurWindow>
  </AbsoluteFill>
);
