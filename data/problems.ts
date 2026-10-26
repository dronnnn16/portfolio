export type ProblemVisual = "retention" | "engagement" | "calendar";

export const problems = {
  label: "The Problem",
  title: "Great product, but the video doesn't sell it?",
  sub: "Most product and creator videos lose people long before the message lands. These are the patterns I fix first.",
  items: [
    {
      visual: "retention" as ProblemVisual,
      title: "Viewers drop in the first 3 seconds",
      body: "Without a hook that earns the next second, the algorithm never shows the rest of your video.",
    },
    {
      visual: "engagement" as ProblemVisual,
      title: "Generic templates look cheap",
      body: "Stock transitions and preset text make a good product feel like everyone else's.",
    },
    {
      visual: "calendar" as ProblemVisual,
      title: "No consistent visual identity",
      body: "Every post looks different, so nobody connects the content back to your brand.",
    },
  ],
};
