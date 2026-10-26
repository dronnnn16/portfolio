export type ProcessVisual = "moodboard" | "storyboard" | "animate" | "deliver";

export const processIntro = {
  label: "My Process",
  sub: "Four steps, the same every time, so you always know what's next and when you'll see it.",
};

export const processSteps: { visual: ProcessVisual; tool: string; title: string; body: string }[] = [
  {
    visual: "moodboard",
    tool: "Milanote",
    title: "References & moodboard",
    body: "We collect references, colours and motion styles in one board so the direction is agreed before anything moves.",
  },
  {
    visual: "storyboard",
    tool: "Figma",
    title: "Storyboard in Figma",
    body: "Key frames, copy and layouts are designed scene by scene. You approve the story, not a surprise.",
  },
  {
    visual: "animate",
    tool: "After Effects",
    title: "Animate in After Effects",
    body: "Frames become motion — custom easing, transitions and UI animation built from the approved boards.",
  },
  {
    visual: "deliver",
    tool: "Premiere Pro",
    title: "Edit, sound & delivery",
    body: "Final cut, captions, sound design and exports for every platform, delivered ready to post.",
  },
];

// Tags that animate onto the "after" frame in the delivery visual.
export const afterTags = ["Hook", "Captions", "Effects"];
