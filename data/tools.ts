// Toolkit marquee.
// - logo:  path in /public/tools/ (shown as an image)
// - short: two-letter placeholder mark, used only when there's no logo
// - neither: name only
export const toolsIntro = {
  label: "Toolkit",
  title: "Tools I work in every day",
};

export type Tool = { name: string; logo?: string; short?: string; color?: string };

export const tools: Tool[] = [
  { name: "After Effects", short: "Ae", color: "#9999FF" }, // {{TODO}} add official logo
  { name: "Premiere Pro", short: "Pr", color: "#9999FF" }, // {{TODO}} add official logo
  { name: "Figma", logo: "/tools/figma.svg" },
  { name: "DaVinci Resolve", logo: "/tools/davinci-resolve.svg" },
];
