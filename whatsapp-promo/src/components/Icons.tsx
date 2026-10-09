import type { CSSProperties } from "react";
import { Img, getStaticFiles, staticFile } from "remotion";
import { COLORS } from "../theme";

type IconProps = { size: number; color?: string; style?: CSSProperties };

// Rounded speech bubble (circle body + tail at bottom-left), viewBox 0 0 100 100.
export const BUBBLE_PATH =
  "M50 18 A30 30 0 1 1 35.4 74.2 L21 79 L26.2 65 A30 30 0 0 1 50 18 Z";

// Material Design icons (Apache 2.0), viewBox 0 0 24 24.
const PHONE_PATH =
  "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z";
const MIC_PATH =
  "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z";
const VIDEO_PATH =
  "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z";

export const MicIcon: React.FC<IconProps> = ({
  size,
  color = "#fff",
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <path d={MIC_PATH} fill={color} />
  </svg>
);

export const VideoIcon: React.FC<IconProps> = ({
  size,
  color = "#fff",
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <path d={VIDEO_PATH} fill={color} />
  </svg>
);

/** Speech bubble with three dots, used inside the notification icon. */
export const ChatBubbleIcon: React.FC<IconProps & { dotColor?: string }> = ({
  size,
  color = COLORS.green,
  dotColor = "#fff",
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <path d={BUBBLE_PATH} fill={color} />
    {[38, 50, 62].map((cx) => (
      <circle key={cx} cx={cx} cy={48} r={4.6} fill={dotColor} />
    ))}
  </svg>
);

/** White chat bubble with a phone handset: the app-icon glyph. */
export const AppGlyph: React.FC<IconProps & { phoneColor?: string }> = ({
  size,
  color = "#fff",
  phoneColor = COLORS.green,
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <path d={BUBBLE_PATH} fill={color} />
    <g transform="translate(34.5 32.5) scale(1.3)">
      <path d={PHONE_PATH} fill={phoneColor} />
    </g>
  </svg>
);

/** WhatsApp-style double tick. `draw` 0→1 strokes it on. */
export const DoubleTick: React.FC<{
  width: number;
  color: string;
  draw: number;
}> = ({ width, color, draw }) => {
  const first = Math.min(1, draw * 2);
  const second = Math.max(0, draw * 2 - 1);
  const len = 22;
  return (
    <svg width={width} height={width * (18 / 30)} viewBox="0 0 30 18">
      <path
        d="M2 9.5 L7 14.5 L18 3.5"
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - first)}
      />
      <path
        d="M11.5 13 L13 14.5 L24 3.5"
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - second)}
      />
    </svg>
  );
};

const LOGO_FILE = "whatsapp-logo.svg";

const hasLogoFile = () => {
  try {
    return getStaticFiles().some((f) => f.name === LOGO_FILE);
  } catch {
    return false;
  }
};

/**
 * App icon. Uses /public/whatsapp-logo.svg if it exists, otherwise draws a
 * placeholder: green rounded square with a white chat-bubble glyph.
 * `glyphOpacity` lets the zoom transition fade the glyph so green fills the frame.
 */
export const AppIcon: React.FC<{
  size: number;
  glyphOpacity?: number;
  style?: CSSProperties;
}> = ({ size, glyphOpacity = 1, style }) => {
  if (hasLogoFile()) {
    return (
      <Img
        src={staticFile(LOGO_FILE)}
        style={{ width: size, height: size, display: "block", ...style }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.235,
        background: `linear-gradient(180deg, #5BF07D 0%, ${COLORS.green} 55%, #1EBE5A 100%)`,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <AppGlyph
        size={size * 0.78}
        phoneColor={COLORS.green}
        style={{ opacity: glyphOpacity, marginTop: size * 0.02 }}
      />
    </div>
  );
};
