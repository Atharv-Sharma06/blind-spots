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

## Issues for the lead before submitting

1. **`/explore` returns 404 on the live site now.** `curl -sIL https://blindspots.earth/explore` gives 404,
   and the page shows "Page not found". `apps/web/app/explore/` is untracked locally (`?? apps/web/app/explore/`), so it is
   not in the current deployment. The published README already sends people there ("**Explorer** (`/explore`) is the full
   expert workspace"). This should clear with the 16:25 redeploy. Re-run `curl -sIL` on all five routes afterwards.
2. **The GitHub README describes the redesign, not the site that is live now.** README line 13 says "[live app](...)
   (press **30-second tour**)". The live home page HTML has no "30-second tour" text. That button comes from the
   uncommitted `components/home/hero.tsx` and `components/demo/home-tour.tsx`. The README also calls the home page the
   "Cabins page", and the live nav does not have that label yet. Both are fixed once the redeploy ships. If the redeploy
   slips, change the README or don't submit before it is live.
3. **GitHub does not recognise the licence as MIT.** The API returns `"license": {"key": "other", "spdx_id": "NOASSERTION"}`.
   The cause is the extra paragraph at the end of `LICENSE` ("The NASA data in data/raw are public-domain / CC0 records
   ... This project is not endorsed by NASA."), which stops GitHub's licence detector from matching the MIT text. To fix
   it, move that paragraph into the README "Licence and attribution" section (or a `NOTICE` file) and leave `LICENSE` as
   the plain MIT text. This is minor because the file is public and clearly says MIT, but a judge's sidebar will not show
   "MIT license".
4. The README screenshot (`1-explore-default.png`, captioned "Explorer, the expert view") shows the old expert screen.
   It is accurate for `/explore` after the redeploy, so no change is needed. Only re-capture it if you want the first image
   to match the new first-glance home page.
5. After the redeploy, re-check that `/video/blind-spots-demo-30s.webm` still returns 200. It is tracked in git
   (`apps/web/public/video/blind-spots-demo-30s.webm`), so it should.

None of these stops us using the live-site URL. In the 15:53 check the root page, `/experiments`, `/methodology` and
`/brief` all worked anonymously.
