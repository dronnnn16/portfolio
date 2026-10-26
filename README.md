# Dron — portfolio

Personal portfolio for Dron, a motion designer and video editor. Built with Next.js (App Router), TypeScript, Tailwind CSS v4, Motion (Framer Motion) and Lenis.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck
npm run build:html # one self-contained file: dron-portfolio.html (opens from disk)
```

## Edit content

All copy lives in `/data`. Search the repo for `{{TODO}}` to find everything waiting on you.

| File | What's in it |
| --- | --- |
| `data/site.ts` | name, nav, socials (LinkedIn `{{TODO}}`), hero copy, hero reel paths |
| `data/problems.ts` | "The Problem" cards |
| `data/stats.ts` | stat cards. `value: null` shows `{{TODO}}`; set a real number to enable the count-up |
| `data/services.ts` | services + feature banner |
| `data/projects.ts` | selected work (row + case studies) |
| `data/process.ts` | process steps + before/after tags |
| `data/testimonials.ts` | **section hidden while empty** — add real quotes only |
| `data/tools.ts` | toolkit marquee (add `logo` paths for official logos) |
| `data/faq.ts` | FAQ (turnaround/revision specifics are `{{TODO}}`) |
| `data/cta.ts` | final call to action |

## Media

Drop files into `public/reels/`, `public/work/` and `public/testimonials/` (each folder has a README with exact file names).
Until a file exists, a labelled placeholder ("Add /work/…mp4") is shown in its place. Videos load only near the viewport, are muted, loop, play inline and pause off-screen.

## Single HTML file

`npm run build:html` exports the site and inlines all CSS, fonts and JS into `dron-portfolio.html`.
Videos are not embedded; for media to show, keep `reels/`, `work/` and `testimonials/` next to the file
on a web server (the absolute `/reels/...` paths don't resolve from `file://`).

## Deploy

- **Vercel:** import the repo; no config needed.
- **GitHub Pages:** `.github/workflows` builds a static export (`STATIC_EXPORT=true`, base path = repo name) and publishes `out/`.
