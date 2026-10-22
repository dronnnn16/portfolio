import S from "../data/sync.json";

// Source seconds -> output frames. The edit keeps the take 1:1 and only drops the
// silent lead-in, so every cue is a fixed offset from the source.
export const FPS = 30;
export const OFFSET = 84; // source frame shown at output frame 0 (2.80 s)
export type Key = Exclude<keyof typeof S, "_note">;
export const F = (k: Key) => Math.round((S[k] as number) * FPS) - OFFSET;
export const END = F("end"); // first black frame
export const BLACK = 18;
export const TOTAL = END + BLACK;
