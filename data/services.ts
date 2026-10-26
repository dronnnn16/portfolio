export type ServiceIcon = "ui" | "reels" | "youtube";

export const servicesIntro = {
  label: "What I Do",
  title: "Motion and edits for products, creators and brands",
  sub: "Three ways I can help, from a single launch animation to a monthly content pipeline.",
};

export const services: { icon: ServiceIcon; title: string; body: string }[] = [
  {
    icon: "ui",
    title: "SaaS UI Motion Design",
    body: "Product walkthroughs, feature launches and UI animations that make software feel fast and tactile.",
  },
  {
    icon: "reels",
    title: "Instagram Reels Editing",
    body: "Hook-first vertical edits with clean captions, sound design and pacing built for the feed.",
  },
  {
    icon: "youtube",
    title: "Long-form YouTube Editing",
    body: "Story structure, b-roll, graphics and retention-aware pacing for videos people finish.",
  },
];

export const featureBanner = {
  title: "Clean edits. Premium motion. Fast delivery.",
  sub: "One person from brief to export, so nothing gets lost between a designer, an editor and a sound guy.",
  rows: [
    { title: "Fast turnaround", body: "Clear timelines agreed up front, with progress you can see." },
    { title: "Built for retention", body: "Hooks, pacing and captions planned around how people watch." },
    { title: "Detail-obsessed", body: "Easing curves, sound hits and frame-perfect cuts on every export." },
  ],
};
