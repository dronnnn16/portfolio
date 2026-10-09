import { AbsoluteFill } from "remotion";
import { COLORS } from "../theme";

/** Off-white stage used by the UI scenes (2–4). */
export const StageBg: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 70% 60% at 50% 45%, #FFFFFF 0%, ${COLORS.offWhite} 70%, #EEEBE4 100%)`,
    }}
  />
);
