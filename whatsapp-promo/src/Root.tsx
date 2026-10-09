import { Composition } from "remotion";
import { DURATION, WhatsAppPromo } from "./WhatsAppPromo";
import { FPS, H, W } from "./theme";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="WhatsAppPromo"
    component={WhatsAppPromo}
    durationInFrames={DURATION}
    fps={FPS}
    width={W}
    height={H}
  />
);
