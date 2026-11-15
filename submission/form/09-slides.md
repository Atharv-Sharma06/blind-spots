# Backup demo: 7-slide deck (fallback for "Project Demonstration")

The video (`03-demo.md`) is the primary demo. This deck is the fallback if the video link fails or a slide link is
preferred. The form allows "a slide presentation (no more than 7 slides, including the title and introduction)".

- **File to share:** `submission/slides/blind-spots-slides.pdf` (16:9, 1920 x 1080 px per page, 7 pages = 7 slides
  including the title; checked: 7 pages, MediaBox 1440 x 810 pt = 1920 x 1080 px; 1.8 MB).
- Source: `submission/slides/blind-spots-slides.html` (one HTML page, no external requests). Screenshots in
  `submission/slides/img/`; build scripts in `submission/slides/build/`.

## Link to paste (after the lead pushes)

```
https://github.com/Atharv-Sharma06/blind-spots/blob/main/submission/slides/blind-spots-slides.pdf
```

- The repository is public, so GitHub shows the PDF in the browser with no login, password or registration.
- This link works only after the file is committed and pushed to `main`. Open it in a logged-out (private) window
  before pasting it into the form.
- Direct download alternative (same file):
  `https://raw.githubusercontent.com/Atharv-Sharma06/blind-spots/main/submission/slides/blind-spots-slides.pdf`

## The 7 slides

| # | Slide | Content | Where the numbers come from |
|---|---|---|---|
| 1 | Title | "Blind Spots" + one-line pitch, Space Apps 2026 "Flame in Freefall", team, data source | none |
| 2 | Problem | ISS flame tests ran in ISS air; Moon/Mars cabins plan thinner air with more oxygen. ISS today 21 % / 101 kPa, Artemis Moon habitat 26.5 % / 70.3 kPa, Exploration Atmosphere 34 % / 56.5 kPa; integrated ISS records 13.5–22.7 % O2, 98–102 kPa where pressure was recorded | `GET /api/headline` (profiles, envelope); cabin air sources NTRS 20140000417 and 20220000245 (as in `submission/slides-outline.md`) |
| 3 | The Cabins page | Screenshot of the Cabins page; "8 of 11 cabins: Not covered" | `GET /api/headline` (8 of 11 profiles have 0 comparable observations); screenshot |
| 4 | The blind spot | Screenshot of the answer card + chart; ISS today 241 nearby ISS test results, Exploration Atmosphere 0 in all 20 material setups | `GET /api/headline` (241; 0 of 20 groups); screenshot |
| 5 | Machine learning | GP model per material and flame setup (9 modelled), "insufficient evidence" instead of a probability; active-learning ranking; top pick cuts uncertainty by 19 %; screenshot of "What to test next" + "What would we learn?"; the mandatory candidate framing sentence | Snapshot site (rank and counterfactual responses), `GET /api/groups` |
| 6 | How we know it works | 749 flow-step results from 276 experiments (565 used for training); GP beats majority class in 6 of 9 groups (3 too close to call, 0 worse); ranking beats random in 11 of 18 retrospective scenarios (5 too close to call, 2 worse); limits: ~1 atm only, 12 to 25 experiments per group, no partial gravity, not a certified fire-safety assessment | `docs/evidence-report.md` line 9; `docs/validation.md` "Read this first" and "Target-aware acquisition" summary |
| 7 | Links + credits | Live app and GitHub URLs (both returned HTTP 200 on 2026-11-15), NASA PSI data (BASS PSI-26, BASS-II PSI-25, CC0; Saffire I–III context), NTRS cabin documents, AI-assistance statement | `submission/project-page.md` |

Dataset `4fe55f76142a`, model `gp-laplace-v1+4fe55f76.adfbbd` (from `GET /api/health`).

## Rules checked

- Every slide carries the footer "SI-assisted project · built with Claude (Anthropic) · Not endorsed by NASA" (the SI
  indicator the form asks for on images and videos).
- No NASA logos, flags or mission insignia; no AI-generated images. The only images are headless screenshots of the app.
- Wording: "ISS flame tests"; candidates are "computational research candidates requiring qualified scientific review,
  established safety procedures and formal feasibility assessment"; "Not a certified fire-safety assessment";
  "not represented in the integrated records" (never "NASA has not studied").

## Screenshots

Taken headless (Chromium via Playwright) from the snapshot-mode site `http://localhost:3709` (the precomputed data
judges get), viewport 1600 x 900, device scale 2, light theme, at 2026-11-15 16:05 EST (page text saved in `submission/slides/build/shots.json`). Each image is cropped to one section
of the Cabins page with the default cabin (Moon/Mars Exploration Atmosphere) and default material (thin acrylic film):

- `img/1-cabins.png`: hero + step 1 (cabin cards)
- `img/2-answer-chart.png`: step 2 verdict + chart
- `img/3-next-tests.png`: step 3 ranked research candidates + "What would we learn?"

The site header and the Next.js dev-mode indicator are hidden in the crops; nothing else is changed.

## Rebuild

```
cd apps/web
node ../../submission/slides/build/shoot.js     # screenshots -> submission/slides/img/
node ../../submission/slides/build/render.js    # PDF -> submission/slides/blind-spots-slides.pdf
```

If the Cabins page changes after the screenshots were taken, re-run both commands and re-check slides 3 to 5 (the
numbers on slides 3 and 5 are read off those sections).
