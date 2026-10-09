import { AbsoluteFill, Sequence } from "remotion";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Chat } from "./scenes/Scene2Chat";
import { Scene3Voice } from "./scenes/Scene3Voice";
import { Scene4Notify } from "./scenes/Scene4Notify";
import { Scene5Statement } from "./scenes/Scene5Statement";
import { Scene6Logo } from "./scenes/Scene6Logo";
import { Scene7Outro } from "./scenes/Scene7Outro";
import { Sfx } from "./Sfx";
import { COLORS } from "./theme";

export const DURATION = 1140;

// Scenes 2→3 and 3→4 overlap by 12 frames: the next scene takes over the pill
// mid-morph. Scenes 4→5 and 5→6 are hard cuts.
export const TIMELINE = [
  { from: 0, duration: 150, Scene: Scene1Hook, name: "1 Hook" },
  { from: 150, duration: 180, Scene: Scene2Chat, name: "2 Chat pill" },
  { from: 318, duration: 162, Scene: Scene3Voice, name: "3 Voice note" },
  { from: 468, duration: 162, Scene: Scene4Notify, name: "4 Notification" },
  { from: 630, duration: 210, Scene: Scene5Statement, name: "5 Statement" },
  { from: 840, duration: 120, Scene: Scene6Logo, name: "6 Logo" },
  { from: 960, duration: 180, Scene: Scene7Outro, name: "7 Scale + Outro" },
] as const;

export const WhatsAppPromo: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.offWhite }}>
    {TIMELINE.map(({ from, duration, Scene, name }) => (
      <Sequence key={name} from={from} durationInFrames={duration} name={name}>
        <Scene />
      </Sequence>
    ))}
    <Sfx />
  </AbsoluteFill>
);
