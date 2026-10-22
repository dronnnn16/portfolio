import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Exactly three voices: Logic (Inter), Emotion (Pinyon Script), Contrast (Anton).
export const LOGIC = "Inter";
export const EMOTION = "Pinyon Script";
export const CONTRAST = "Anton";

loadFont({ family: LOGIC, url: staticFile("fonts/Inter-700.woff2"), weight: "700" });
loadFont({ family: LOGIC, url: staticFile("fonts/Inter-900.woff2"), weight: "900" });
loadFont({ family: EMOTION, url: staticFile("fonts/PinyonScript.woff2"), weight: "400" });
loadFont({ family: CONTRAST, url: staticFile("fonts/Anton.woff2"), weight: "400" });

export const C = {
  white: "#FFFFFF",
  blue: "#5B8BD9",
  royalA: "#0A4FC0",
  royalB: "#2F6FE0",
  grey: "#8E949C",
  black: "#000000",
};

export const SMALL = 40; // ~3.7% of frame height
export const TEXTURE = staticFile("assets/candles.jpg");
