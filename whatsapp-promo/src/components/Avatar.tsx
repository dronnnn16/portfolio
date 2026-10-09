import type { CSSProperties } from "react";
import { COLORS, FONT } from "../theme";

type AvatarProps = {
  initials: string;
  size: number;
  from?: string;
  to?: string;
  /** rotateY in degrees for the turntable tilt */
  tiltY?: number;
  tiltX?: number;
  style?: CSSProperties;
};

/** Gradient circle with initials. No faces, ever. */
export const Avatar: React.FC<AvatarProps> = ({
  initials,
  size,
  from = COLORS.green,
  to = COLORS.teal,
  tiltY = 0,
  tiltX = 0,
  style,
}) => {
  // Light falloff follows the tilt so the turntable motion reads as 3D.
  const shine = 50 - tiltY * 1.6;
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        perspective: size * 4,
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: `radial-gradient(circle at ${shine}% 28%, rgba(255,255,255,0.45), rgba(255,255,255,0) 55%), linear-gradient(145deg, ${from}, ${to})`,
          transform: `rotateY(${tiltY}deg) rotateX(${tiltX}deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.white,
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: size * 0.36,
          letterSpacing: "-0.02em",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.35), 0 6px 16px rgba(7,94,84,0.18)",
        }}
      >
        {initials}
      </div>
    </div>
  );
};
