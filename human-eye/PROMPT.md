# Build prompt: Human Eye revision page (RBSE Class 10 Science, Chapter 10)

## Role
You are a frontend designer-developer and a Class 10 science teacher. Build one self-contained, interactive revision web page for students preparing for the RBSE (Rajasthan Board) Class 10 Science exam.

## Subject
Chapter 10, "The Human Eye and the Colourful World" (NCERT textbook, followed by RBSE). The audience is a 15–16 year old student, often studying in Hindi or English medium, revising on a phone shortly before a test.

## Page's single job
Help the student revise every exam-relevant point of the chapter, practise the question types RBSE asks (MCQ, give reasons, short answer, long answer, numericals), and track what they have finished.

## Content to cover (follow NCERT section numbers)
- **10.1 The human eye**: cornea, iris, pupil, eye lens, ciliary muscles, retina (rods and cones), optic nerve, blind spot, aqueous and vitreous humour. Power of accommodation, near point (25 cm), far point (infinity), why we have two eyes, eye donation facts.
- **10.2 Defects of vision**: myopia, hypermetropia, presbyopia, cataract. Cause, where the image forms, correcting lens, bifocal lenses. Numericals using P = 1/f and the lens formula.
- **10.3 Refraction through a glass prism**: angle of prism, angle of deviation, i + e = A + δ.
- **10.4 Dispersion**: VIBGYOR, red deviates least and violet most, Newton's two-prism experiment, rainbow formation (refraction, dispersion, internal reflection; always opposite the Sun).
- **10.5 Atmospheric refraction**: twinkling stars, planets do not twinkle, advance sunrise and delayed sunset by about 2 minutes, flickering air above a fire.
- **10.6 Scattering of light**: Tyndall effect, blue sky, red sunrise and sunset, red danger signals, dark sky for astronauts, white clouds.

## Required working features
1. Clickable labelled eye diagram: selecting a part shows its English and Hindi name, function and an exam tip.
2. Defect simulator: choose eye (normal, myopia, hypermetropia, presbyopia), object (far or near) and toggle a corrective lens. Ray diagram redraws, shows where the image forms, and previews how blurry the person sees.
3. Lens power calculator for myopia (from far point) and hypermetropia (from near point), with step-by-step working, unit switch, NCERT example presets and input validation.
4. Prism diagram with a toggle for Newton's inverted second prism (recombination to white light). Rainbow droplet diagram.
5. Twinkling star vs steady planet demo with an "atmosphere on/off" toggle.
6. Sun elevation slider showing how sky and Sun colour change, with the relative air path length.
7. "Give reasons" flip cards with shuffle and show-all.
8. MCQ quiz: instant feedback with explanations, score, review of wrong answers, retake with shuffled order, best score remembered.
9. Important questions with expandable model answers and a show-all toggle.
10. Formula sheet and an English–Hindi glossary with a live search filter.
11. "Mark as revised" on every section, progress bar, sidebar contents with scroll highlighting; progress stored in localStorage with safe fallbacks.
12. Light and dark theme toggle that also respects the system setting.

## Design direction
- Draw from the optometrist's world: the hero is a Snellen eye-test chart whose shrinking lines spell the chapter title, with real acuity notation (6/60 down to 6/6).
- Body text in Atkinson Hyperlegible (designed for low-vision readers), display in wide Archivo, Mukta for Devanagari, a mono face for formulas.
- Cool lightbox neutrals, an iris-blue accent and an amber "macula" highlight reserved for exam-important points. The spectrum colours appear only in optics diagrams, drawn on a dark-room panel.
- No templated SaaS card grids, gradient heroes or emoji section markers.

## Quality bar
- Single HTML file, no build step, only Google Fonts as an external resource.
- Works at 360 px phone width with no horizontal page scroll; diagrams scale.
- Keyboard accessible (focus states, buttons not divs), respects reduced motion.
- All content accurate to the NCERT text; no invented marks weightage.
