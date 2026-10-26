// Toolkit marquee. Replace `logo` with a path in /public/tools/ (e.g. "/tools/after-effects.svg")
// once you have the official logos; until then a lettermark placeholder is shown.
export const toolsIntro = {
  label: "Toolkit",
  title: "Tools I work in every day",
};

export const tools: { name: string; short: string; color: string; logo?: string }[] = [
  { name: "After Effects", short: "Ae", color: "#9999FF" },
  { name: "Premiere Pro", short: "Pr", color: "#9999FF" },
  { name: "Figma", short: "Fg", color: "#F24E1E" },
  { name: "Milanote", short: "Mn", color: "#F8F5F2" },
  { name: "DaVinci Resolve", short: "Dr", color: "#FA6114" },
];
