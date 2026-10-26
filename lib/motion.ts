export const EASE = [0.22, 1, 0.36, 1] as const;

export const blurIn = {
  hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)" },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};
