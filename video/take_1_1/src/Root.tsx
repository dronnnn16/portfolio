import { Composition } from "remotion";
import { Main } from "./Main";
import { FPS, TOTAL } from "./sync";

export const Root = () => (
  <Composition id="Main" component={Main} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
);
