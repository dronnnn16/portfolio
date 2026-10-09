type CursorProps = {
  x: number;
  y: number;
  /** 0 = idle, 1 = fully pressed */
  press?: number;
  opacity?: number;
  size?: number;
};

/** macOS-style arrow pointer. (x, y) is the hotspot (arrow tip). */
export const Cursor: React.FC<CursorProps> = ({
  x,
  y,
  press = 0,
  opacity = 1,
  size = 54,
}) => {
  const scale = 1 - press * 0.12;
  return (
    <svg
      width={size}
      height={size * (32 / 24)}
      viewBox="0 0 24 32"
      style={{
        position: "absolute",
        left: x - (3 / 24) * size,
        top: y - (2 / 32) * size * (32 / 24),
        transform: `scale(${scale})`,
        transformOrigin: `${(3 / 24) * 100}% ${(2 / 32) * 100}%`,
        opacity,
        overflow: "visible",
        filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.22))",
      }}
    >
      <path
        d="M3 2 L3 25.5 L8.6 20 L12.6 29 L16.4 27.4 L12.5 18.6 L20 18.6 Z"
        fill="#111"
        stroke="#fff"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
};

/** Expanding click ripple. t: 0→1 */
export const Ripple: React.FC<{
  x: number;
  y: number;
  t: number;
  radius: number;
  color?: string;
}> = ({ x, y, t, radius, color = "rgba(255,255,255,0.55)" }) => {
  if (t <= 0 || t >= 1) return null;
  const r = radius * (0.15 + 0.85 * t);
  return (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        background: color,
        opacity: 1 - t,
        pointerEvents: "none",
      }}
    />
  );
};
