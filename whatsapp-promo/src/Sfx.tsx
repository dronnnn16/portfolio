import { Html5Audio, Sequence, getStaticFiles, staticFile } from "remotion";

type SfxName = "whoosh" | "click" | "pop" | "music";

const available = (name: SfxName) => {
  try {
    return getStaticFiles().some((f) => f.name === `sfx/${name}.mp3`);
  } catch {
    return false;
  }
};

// Global frames at which each effect fires.
const CUES: { name: SfxName; at: number; volume?: number }[] = [
  { name: "pop", at: 154 }, // scene 2 dot → pill
  { name: "click", at: 150 + 128 }, // Reply
  { name: "click", at: 318 + 112 }, // Send
  { name: "pop", at: 318 + 22, volume: 0.6 }, // mic appears
  { name: "pop", at: 468 + 62, volume: 0.7 }, // notification lands
  { name: "whoosh", at: 120 }, // scene 1 exit
  { name: "whoosh", at: 630 }, // scene 5 streak
  { name: "pop", at: 840 + 12 }, // logo drop
  { name: "whoosh", at: 840 + 74 }, // logo zoom
];

/** Optional audio: plays only the files present in public/sfx/. */
export const Sfx: React.FC = () => (
  <>
    {available("music") && (
      <Html5Audio src={staticFile("sfx/music.mp3")} volume={0.5} />
    )}
    {CUES.filter((c) => available(c.name)).map((c, i) => (
      <Sequence key={i} from={c.at} durationInFrames={90} layout="none">
        <Html5Audio
          src={staticFile(`sfx/${c.name}.mp3`)}
          volume={c.volume ?? 0.8}
        />
      </Sequence>
    ))}
  </>
);
