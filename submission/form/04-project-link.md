# Project (link field)

Paste this into **Project \***:

```
https://blindspots.earth
```

Put the code link in **Project Details** (first line, for example "Source code (MIT): https://github.com/Atharv-Sharma06/blind-spots").
The README links back to the live site and the site header links to the repo, so judges can get from either one to the
other.

## Why the live site

The form asks for "a website you created to showcase your project" or a code repository. We chose the site because
judges can use it straight away, with no install and no Python or Node setup. The root URL is now a landing page that
asks the question in plain words, and the Cabins tool at /cabins shows real data on first load (both returned HTTP 200
between 18:12 and 18:13 on 2026-11-15). The site opens anonymously too, with no Vercel deployment protection and no login wall
(checked below).

The site header has a "GitHub" link to `https://github.com/Atharv-Sharma06/blind-spots`, so a judge who wants the code
is one click away. We treat the repo as the fallback, not a replacement. If the site is ever down, the README, docs and
screenshot still explain the project and how to run it.

## Verification (run 2026-11-15, 15:53 to 15:56 EST; logged-out, no cookies; Playwright Chromium headless, 1440x900)

Live site, before the planned redeploy (around 16:25). Page served from the Vercel cache (`x-vercel-cache: HIT`, `age: 2595`).

| URL | curl -sIL | Final URL | Headless load | Console errors |
|---|---|---|---|---|
| https://blindspots.earth/ | 200, 0 redirects | same (the page then adds `?group=pmma_thin_film__opposed&target=exploration_atmosphere_8p2_34&plane=o2_pressure` in the browser) | H1 "Blind Spots: where NASA's microgravity fire evidence ends, and what to learn next."; 30 SVG + 1 canvas; 9,045 chars of text | 0 |
| /explore | **404** | same | "Page not found" page | 1 (the 404 itself) |
| /experiments | 200, 0 redirects | same | H1 "Experiments"; 29,965 chars (test table) | 0 |
| /methodology | 200, 0 redirects | same | H1 "Methodology"; 69,107 chars | 0 |
| /brief | 200, 0 redirects | same | H1 "Thin PMMA films · opposed flow under NASA Exploration Atmosphere (8.2 psia / 34 % O2)" | 0 |
| /video/blind-spots-demo-30s.webm | 200, `video/webm`, 1,594,579 bytes | same | not loaded in browser | n/a |

No 4xx/5xx sub-requests on the four 200 pages. No login or password text on any page.

Code repository:

| Check | Result |
|---|---|
| https://github.com/Atharv-Sharma06/blind-spots (curl -sIL) | 200, 0 redirects |
| GitHub API | `"private": false`, `"visibility": "public"`, default branch `main`, last push `2026-11-15T20:10:24Z` |
| Headless load, logged out | renders, title "GitHub - Atharv-Sharma06/blind-spots: Blind Spots: where NASA's microgravity fire evidence ends ...", 0 console errors |
| README renders | yes, 20 headings from "Blind Spots" to "Licence and attribution" |
| README image | `submission/stills/1-explore-default.png` loads (naturalWidth > 0; raw URL 200 `image/png`) |
| README links (18 unique, each checked with curl -sL) | all 200: 12 docs (`docs/API.md`, `architecture.md`, `CONTRACTS.md`, `data-sources.md`, `decisions.md`, `demo-script.md`, `evidence-report.md`, `future-work.md`, `limitations.md`, `scientific-methodology.md`, `validation.md`, `data/curation/README.md`), `LICENSE`, the still image, the live site, the video, the repo, `https://docs.astral.sh/uv/` |
| Licence | `LICENSE` file present (raw 200), starts "MIT License / Copyright (c) 2026 Atharv Sharma"; the sidebar links to it. But GitHub detects it as **"Other"** (see issue 3) |
| GitHub README equals local README | yes (`diff` of raw README against the working copy: no difference) |

## Status (re-checked 2026-11-15, 22:25 EST)

All earlier issues are resolved on the live site:
- `/explore` returns 200 on https://blindspots.earth (as do `/`, `/cabins`, `/findings`, `/experiments`, `/methodology`, `/brief`).
- The README describes the site that is live (landing page at `/`, Cabins tool at `/cabins`).
- GitHub detects the licence as MIT (the NASA data note moved to `NOTICE`).
- The demo video link returns 200 and serves the current recording (`/video/blind-spots-demo-30s.webm`, 3,018,832 bytes, same file as in the repo).

Nothing left to fix before submitting.
