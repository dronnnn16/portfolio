// Selected work. Put media in /public/work/ using the file names below.
//  - vertical: 9:16 cut for the draggable row
//  - cover:    16:10 / landscape video for the case-study grid (poster = still frame)
export type Project = {
  slug: string;
  title: string;
  type: string;
  description: string;
  vertical: { src: string; poster: string };
  cover: { src: string; poster: string };
  href?: string; // {{TODO}} optional link to a full case study / Behance / Instagram post
};

const media = (slug: string) => ({
  vertical: { src: `/work/${slug}-vertical.mp4`, poster: `/work/${slug}-vertical.jpg` },
  cover: { src: `/work/${slug}.mp4`, poster: `/work/${slug}.jpg` },
});

export const workIntro = {
  label: "Selected Work",
  title: "Recent motion & edit projects",
  sub: "Drag through the vertical cuts, then dig into the case studies below.",
};

export const projects: Project[] = [
  {
    slug: "fintech-globe",
    title: "Fintech travel globe",
    type: "SaaS Motion",
    description:
      "A rotating 3D globe animation that maps cross-border payments and travel routes for a fintech product.",
    ...media("fintech-globe"),
  },
  {
    slug: "spotify-ui",
    title: "Music app UI mockup",
    type: "UI Animation",
    description:
      "A Spotify-style player mockup brought to life with fluid transitions, playlists and micro-interactions.",
    ...media("spotify-ui"),
  },
  {
    slug: "ecommerce-cards",
    title: "E-commerce card animations",
    type: "UI Animation",
    description:
      "Product cards, cart flows and checkout moments animated to make shopping feel quick and satisfying.",
    ...media("ecommerce-cards"),
  },
  {
    slug: "iphone-configurator",
    title: "iPhone configurator",
    type: "Product Motion",
    description:
      "An Apple-style configurator where colours, storage and finishes swap with clean, considered motion.",
    ...media("iphone-configurator"),
  },
  {
    slug: "ai-audio",
    title: "AI audio product reel",
    type: "SaaS Motion",
    description:
      "A dark, glowing SaaS reel for an AI audio tool — waveforms, prompts and UI built for launch day.",
    ...media("ai-audio"),
  },
  {
    slug: "saas-flash",
    title: "SaaS Flash",
    type: "Agency client",
    description:
      "A fast-paced SaaS promo delivered for an agency client, from storyboard through final sound design.",
    ...media("saas-flash"),
  },
];
