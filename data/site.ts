// Global site info. Anything marked {{TODO}} is waiting on you.
export const site = {
  name: "Dron",
  role: "Motion designer & video editor",
  location: "Jaipur, India",
  url: "https://example.com", // {{TODO}} your production domain (used for metadata)
  email: "dronverma38@gmail.com",
  availability: "Available for freelance projects",
  nav: [
    { label: "Services", href: "#services" },
    { label: "Work", href: "#work" },
    { label: "Process", href: "#process" },
    { label: "Contact", href: "#contact" },
  ],
  socials: [
    { label: "Instagram", handle: "@theycallmedronn", href: "https://instagram.com/theycallmedronn" },
    { label: "Email", handle: "dronverma38@gmail.com", href: "mailto:dronverma38@gmail.com" },
    // {{TODO}} replace href with your LinkedIn profile URL
    { label: "LinkedIn", handle: "{{TODO}}", href: "#" },
  ],
} as const;

export const hero = {
  chip: "Available for freelance projects",
  title: "Motion design & edits that make people stop scrolling",
  sub: "I'm Dron — a motion designer and video editor from Jaipur. I craft SaaS UI animations, Instagram Reels and long-form edits that look premium and hold attention.",
  primary: { label: "Start a Project", href: "#contact" },
  secondary: { label: "See My Work", href: "#work" },
  tags: ["SaaS Motion", "Reels Editing", "Long-form Edits"],
};

// Vertical 9:16 reels for the hero carousel. Drop files into /public/reels/.
export const heroReels = Array.from({ length: 8 }, (_, i) => ({
  src: `/reels/reel-${i + 1}.mp4`,
  poster: `/reels/reel-${i + 1}.jpg`,
  alt: `Showreel clip ${i + 1}`, // {{TODO}} describe each clip
}));
