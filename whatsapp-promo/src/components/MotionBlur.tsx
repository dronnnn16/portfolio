import { CameraMotionBlur } from "@remotion/motion-blur";
import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

/**
 * Applies camera motion blur only inside [from, to) (frames relative to the
 * enclosing Sequence). Children must paint an opaque background so the
 * additive sample blending averages correctly.
 */
export const MotionBlurWindow: React.FC<{
  from: number;
  to: number;
  samples?: number;
  shutterAngle?: number;
  children: ReactNode;
}> = ({ from, to, samples = 8, shutterAngle = 180, children }) => {
  const frame = useCurrentFrame();
  if (frame >= from && frame < to) {
    return (
      <CameraMotionBlur samples={samples} shutterAngle={shutterAngle}>
        {children}
      </CameraMotionBlur>
    );
  }
  return <AbsoluteFill>{children}</AbsoluteFill>;
};
