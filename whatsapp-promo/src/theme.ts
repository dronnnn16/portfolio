import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily: inter } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const COLORS = {
  green: "#25D366",
  teal: "#128C7E",
  dark: "#075E54",
  deep1: "#04241D",
  deep2: "#0A3A2E",
  bubble: "#D9FDD3",
  offWhite: "#F5F3EE",
  white: "#FFFFFF",
  logoBg: "#EDEDED",
  mint1: "#E7F8EE",
  mint2: "#BFE9D2",
  tickGrey: "#8696A0",
  read: "#53BDEB",
  ink: "#0B1F1A",
} as const;

// SF Pro Display is used when installed locally, Inter (Google Fonts) otherwise.
export const FONT = `"SF Pro Display", "${inter}", system-ui, sans-serif`;

export const SHADOW = {
  pill: "0 20px 60px rgba(7,94,84,0.12)",
  innerBorder: "inset 0 0 0 1px rgba(255,255,255,0.6)",
};

export const HEADLINE = {
  fontFamily: FONT,
  fontWeight: 600,
  letterSpacing: "-0.04em",
} as const;

export const UI_TEXT = {
  fontFamily: FONT,
  fontWeight: 500,
} as const;

export const W = 1920;
export const H = 1080;
export const FPS = 60;
