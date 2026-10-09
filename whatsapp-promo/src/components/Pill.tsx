import type { CSSProperties, ReactNode } from "react";
import { COLORS, SHADOW } from "../theme";

type PillProps = {
  width: number;
  height: number;
  background?: string;
  shadow?: string | false;
  border?: boolean;
  padding?: number;
  gap?: number;
  style?: CSSProperties;
  children?: ReactNode;
};

/**
 * Capsule container. Layout convention: circle icon/avatar on the left,
 * text in the middle (flex: 1), small pill button on the right.
 */
export const Pill: React.FC<PillProps> = ({
  width,
  height,
  background = COLORS.white,
  shadow = SHADOW.pill,
  border = true,
  padding,
  gap = 26,
  style,
  children,
}) => {
  const pad = padding ?? Math.min(24, height * 0.16);
  const shadows = [shadow, border ? SHADOW.innerBorder : null]
    .filter(Boolean)
    .join(", ");
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 999,
        background,
        boxShadow: shadows || "none",
        display: "flex",
        alignItems: "center",
        gap,
        padding: `0 ${pad}px`,
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Absolutely positions its child with its center at (x, y). */
export const At: React.FC<{
  x: number;
  y: number;
  style?: CSSProperties;
  children: ReactNode;
}> = ({ x, y, style, children }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: "translate(-50%, -50%)",
      ...style,
    }}
  >
    {children}
  </div>
);

type PillButtonProps = {
  label: string;
  height?: number;
  fontSize?: number;
  background?: string;
  color?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export const PillButton: React.FC<PillButtonProps> = ({
  label,
  height = 68,
  fontSize = 30,
  background = COLORS.green,
  color = COLORS.white,
  style,
  children,
}) => (
  <div
    style={{
      height,
      padding: `0 ${height * 0.5}px`,
      borderRadius: 999,
      background,
      color,
      fontSize,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      position: "relative",
      overflow: "hidden",
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.25), 0 8px 20px rgba(37,211,102,0.28)`,
      ...style,
    }}
  >
    <span style={{ position: "relative", zIndex: 1 }}>{label}</span>
    {children}
  </div>
);
