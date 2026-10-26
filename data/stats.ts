// Count-up stat cards in "My Approach".
// value: null renders a visible {{TODO}} placeholder. Set a number to enable the count-up.
// These are intentionally empty — add only real numbers.
export type Stat = {
  value: number | null;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
  note: string;
};

export const approach = {
  label: "My Approach",
  title: "Premium motion, built around hooks and clarity",
  sub: "Every edit starts with the first three seconds and the one idea the viewer should leave with. Everything else supports that.",
};

export const stats: Stat[] = [
  { value: null, suffix: "+", label: "Projects delivered", note: "{{TODO}} total shipped projects" },
  { value: null, suffix: "+", label: "Clients worked with", note: "{{TODO}} brands, founders & agencies" },
  { value: null, suffix: " days", label: "Typical turnaround", note: "{{TODO}} for a standard reel" },
  { value: null, suffix: "+", label: "Years editing", note: "{{TODO}} years of experience" },
];
