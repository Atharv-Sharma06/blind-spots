# Form field: Use of Super Intelligence (SI)

Prepared 2026-11-15 for the Space Apps 2026 submission of Blind Spots. The field is a multi-select ("Select options").
Space Apps says the answer to this field is used only for data collection and judges do not see it. Judges do see the SI
labels inside the project itself: watermarks, descriptive text and metadata. So the labels in section 4 matter more than
the boxes you tick.

---

## 1. Official guidance (fetched 2026-11-15 from spaceappschallenge.org)

**The list of options is not public.** It is not in the Project Submission Guide, the Participant FAQ or the copied form
text (`.work/redesign/form-fields.md`). The options appear only inside the logged-in form. The recommendations below go by
what each option means. Before ticking, read every option label in the form.

Project Submission Guide (https://www.spaceappschallenge.org/resources/project-submission-guide/), quoted exactly:

> "Did you utilize any Super Intelligence (SI) tools and software in preparing your solution? If yes, how did you use
> them?"
> "The use of SI tools, such as machine learning, chatbots, image generation, and large language models, is permitted for
> the NASA Space Apps Challenge and should be used as a tool to accelerate innovation and creativity for your challenge
> solution. SI should not be used to (come up with your idea of how to solve the challenge)."
> "Generated content may not use, contain, or modify any NASA branding or design elements (such as the NASA logos, flags,
> or mission identifiers)."
> "Images and videos: Must include a visible watermark to indicate SI generation. Audio: Must acknowledge SI generation in
> descriptive text and metadata. Code and data: Must acknowledge SI generation in descriptive text and metadata."
> "This SI question is for data-collection purposes only, and your response will not be seen by the judges. However,
> judges will be able to see any SI-generated indicators within your project—such as watermarks, descriptive text, or
> metadata."

Participant FAQ (https://www.spaceappschallenge.org/resources/participant-faqs/), quoted exactly:

> "Super Intelligence (SI) refers to computer systems that perform tasks typically associated with human reasoning,
> decision-making, content creation, and problem-solving. Examples include large language models, conversational
> assistants, image and video generation tools, foundation models, and code generation tools."
> "Each team's project submission must include a description of how SI tools were used during the development of their
> project."

The FAQ also says Space Apps uses "SI" in place of "AI". The project's public text should therefore say **SI**.

**Owner action (the idea rule):** the guide says SI "should not be used to (come up with your idea of how to solve the
challenge)". The paste-ready text below says only that we directed the work, made the decisions and checked the
outputs. If the core idea came from the team, you may add one true sentence saying so. Do not add it otherwise.

---

## 2. What to tick

Tick every option that matches one of these meanings, whatever its exact label:

| Tick | Meaning (match the option label to this) | Why |
|---|---|---|
| YES | Code generation / coding assistant / software development | Claude (via Claude Code) wrote most of the code: Next.js app, Python analysis service, FastAPI API, tests, scripts. |
| YES | Text / writing / documentation / chatbot or LLM for content | Documentation, site wording, methodology page and submission text were drafted with Claude. |
| YES | Data processing / data analysis / data extraction or transcription | Claude transcribed free-text NASA matrix cells and report tables into the curation tables and extracted the verbatim NASA quotes. All of this was checked by code (section 3). |
| YES | Research / summarising / ideation support / review or editing | Claude wrote research summaries and ran code and science reviews (audit rounds). |
| YES, if offered | Machine learning / models inside the solution | The guide lists "machine learning" as an SI tool. The app's core is a Gaussian-process classifier plus active learning, written by the team with Claude's help. It is not a generative model. |
| NO | Image generation | No generated images. The stills are screenshots of the real app. |
| NO | Video generation | The demo video is a scripted screen recording of the real app, not generated video. It carries the SI label anyway (section 4). |
| NO | Audio / voice / music generation | The video has no audio and no generated voice. |
| NO | "I did not use SI" | SI was used heavily. |

If the form has only coarse options, such as "Code", "Text", "Data", "Images", "Video", "Audio" and "Other", tick
**Code, Text, Data**. Tick **Other** too if it lets you add "research summaries and reviews". Leave Images, Video and Audio
unticked.

---

## 3. Paste-ready disclosure text

### 3a. Short version (Project Details, or a free-text box next to the multi-select)

> **Use of Super Intelligence (SI).** We used SI heavily to build Blind Spots, so here is exactly how. Claude, by
> Anthropic, used through Claude Code, wrote much of our code: the Next.js web app, the Python analysis service and its
> API, and the tests. It also drafted the documentation, the site text and this submission. Claude transcribed the
> free-text cells of NASA's BASS and BASS-II test matrices, and tables from NASA reports, into our curation tables. We
> directed the work, made the decisions (each one is logged in `docs/decisions.md`) and checked what came back.
> We did not want to take SI output on trust, so we wrote code to check it. Every transcribed value has to quote its NASA
> source cell exactly, and a row that fails is dropped. This build had 0 failures. Automated tests cover the pipeline and
> the app, and an independent review re-derived the model core and matched it against a brute-force calculation.
> The numbers in the app come from NASA data (PSI BASS / BASS-II, CC0) and cited NASA documents, computed by our code.
> Inside the app, a Gaussian-process model and active learning do the estimating, abstaining and ranking, and the findings
> and answers are written by code from computed numbers. An optional "Explain with SI" button sends only the numbers on
> screen to Claude Opus 5.5; the reply is labelled SI-generated and code removes any sentence whose numbers are not on the page. We used no SI-generated images, video or audio. The demo video and
> stills are screen recordings of the real app, labelled "SI-assisted project · built with Claude (Anthropic)". There are
> no NASA logos or other NASA branding in the project, and it is not endorsed by NASA.

### 3b. Full version (README section, project page)

> ## Use of Super Intelligence (SI)
>
> We built Blind Spots with a lot of help from one SI tool, Claude (Anthropic), which we used through Claude Code, a
> coding assistant that runs in the terminal. We used no other SI tools to build the project, and the app itself runs no
> generative SI.
>
> Most of the SI help went into code. Claude wrote much of the Python analysis service (ingestion, unit handling, the
> Gaussian-process model, active learning, evaluation), the FastAPI API, the Next.js web app, the test suites and the
> helper scripts. It also drafted the documentation, the site wording, the methodology page and the submission text.
> We used it for research summaries too, and for code and science review rounds.
>
> The data work needed the most care. The BASS (PSI-26) and BASS-II (PSI-25) matrices record flow schedules and outcomes
> as free text, so Claude transcribed those cells into the tables in `data/curation/`. Each chunk was transcribed twice,
> independently, and the two versions were adjudicated. Claude also transcribed tables from NASA reports (BASS-II Summary
> Report Appendix A, DARTFire, the Glenn drop-tower limits, Saffire-IV/V/VI, ground flammability thresholds), with a page
> and table reference on every row, and it extracted the verbatim NASA quotes behind the atmosphere profiles.
> `data/curation/README.md` records how each table was made.
>
> For the demo, Claude wrote the script that records the video and screenshots of the real app, headless. The video and
> stills are screen recordings, not generated images or video, and they carry a visible "SI-assisted project · built with
> Claude (Anthropic)" label.
>
> We directed the work. We made the design and scientific decisions, and each one is logged with its reasoning in
> `docs/decisions.md` and `docs/decisions.d/`. We reviewed the outputs and decided what went into the final project.
>
> We checked SI output with code rather than trusting it. Every quoted token in the curation tables must be an exact
> substring of the cited cell in the original NASA spreadsheet. `scripts/check_curation_provenance.py` checks this, and
> the dataset build checks it again and leaves out any row that fails. This build has 0 failures
> (`data/normalized/dataset_report.json`, `provenance_failures`). Report-table values were checked against the rendered
> PDF pages. There is a pytest suite (`services/analysis/tests/`) and a headless Playwright end-to-end suite with unit
> tests (`apps/web/tests/`), plus lint, format and type checks. The pytest suite checks the active-learning ranking
> against a brute-force calculation (`services/analysis/tests/acquisition/test_acquisition.py`). A separate review
> re-derived the Gaussian-process core and matched it against a dense brute-force calculation to about 1e-14
> (`docs/decisions.d/lead-review-fixes.md`). We also ran several review rounds of the code, science claims,
> accessibility and wording, and their fixes went through the same tests.
>
> Every number shown is computed by this code from NASA data (Physical Sciences Informatics BASS / BASS-II, CC0) and
> cited NASA documents. SI did not invent any measurement, source or quote, and missing values stay missing.
>
> No generated content uses or changes NASA logos, flags, insignia or mission patches. We name NASA datasets and
> experiments only to cite where the data comes from. The project is not endorsed by NASA, and we do not claim NASA
> approval.

### 3c. One-line label (footers, video descriptions, metadata fields)

> SI-assisted project: built with Claude (Anthropic). Claude helped write the code, curate the data and draft the text,
> and we checked its work with code against the NASA sources. See "Use of Super Intelligence (SI)" in the README.

---

## 4. SI labels in the repo and on the site (checked 15:53-16:05)

### Already in place (verified)
- **Site footer** (`apps/web/components/layout/site-footer.tsx`, `SI_NOTE` in `apps/web/lib/copy.ts`). At 15:56 the
  live site http://localhost:3709/ showed "Built with SI (super intelligence) assistance: Claude, by Anthropic." At
  15:53 it read "Built with SI assistance (Claude, by Anthropic)." on both / and /methodology.
- **/methodology** has a visible "How we used SI" section (`SiNote`) and section 8 "How this was built" (`BuiltSection`)
  in `apps/web/components/methodology/section-built.tsx`. Both appear in the served HTML.
- **README.md** (line 99) and `docs/_gen/templates/README.md` (line 87). At 15:56 both had `## Use of SI (super
  intelligence)`, renamed from "AI-assistance disclosure" at 15:53. The section separates the machine learning inside the
  app from the Claude assistance used to build it, says there are no SI-generated images, video or audio, and lists the
  uses.
- **Data metadata:** `data/curation/README.md` is headed "Curation tables: how they were made (AI-assistance metadata)"
  and names Claude (Anthropic) for each table.
- **Video watermark code:** `.work/video/record.mjs` lines 117-121, 166 and 257-258 inject the label "SI-assisted project ·
  built with Claude (Anthropic)" into the video and the stills.
- **No NASA logo files** were found in `apps/web/public` or `apps/web/app`.

### Gaps (exact fixes; this agent edited none of these files)

1. **BLOCKER: the video and stills you would submit have no watermark.** The current files were written at 15:09.
   The label was added to `record.mjs` later, between 15:53 and 15:54. `submission/stills/1-explore-default.png` was
   checked visually and has no label. Affected files:
   - `submission/blind-spots-demo-30s.webm`
   - `apps/web/public/video/blind-spots-demo-30s.webm`
   - `.work/video/final/blind-spots-demo-30s.webm`
   - `submission/stills/1..6-*.png`

   Fix: re-run `record.mjs` (with `NO_STILL_WATERMARK` unset), copy the new outputs over all of the above, then check that
   the label is readable in the first and last frames. Upload that version to the public host. In the hosting
   description (YouTube or Drive), add the one-line label from 3c.
2. **The README SI section is missing three things.** The heading is now in place, but the section does not say what the
   people did or that no NASA branding was used, and it still mixes in "AI". Make these changes in
   `docs/_gen/templates/README.md` (the source; regenerate README.md from it):
   - After the "Details of how SI was used to build it" list, add the 3b paragraphs "What the people did" and "No NASA
     branding".
   - Change "AI output was checked" to "SI output was checked".
   - Change "two independent AI transcriptions" to "two independent SI transcriptions".
   - Change "no AI-generated images, video or audio" to "no SI-generated images, video or audio".
   - Keep "The app itself uses no generative AI" as it is, or change "AI" to "SI".

   In the template, keep the placeholders `{{N_PROVENANCE_FAIL}}` and `{{N_PROFILES}}`; do not hard-code 0 or 12. The
   first 12 lines of the README do not mention SI, so add one line near the top:
   `> SI-assisted project: built with Claude (Anthropic). See [Use of SI](#use-of-si-super-intelligence).`
3. **Code metadata does not mention SI.**
   - `apps/web/package.json` has no `description`. Add:
     `"description": "Blind Spots web app. SI-assisted: built with Claude (Anthropic); see README, Use of Super Intelligence (SI)."`
   - `services/analysis/pyproject.toml` line 4: append to `description` the text
     ` SI-assisted: built with Claude (Anthropic); see README, Use of Super Intelligence (SI).`
4. **The root `NOTICE` does not mention SI.** Someone created `NOTICE` at 15:55. It covers copyright, the MIT licence,
   the NASA data (CC0) and "not endorsed by NASA", but says nothing about SI. Append this block:
   ```
   SI (Super Intelligence) notice
   This project was built with SI assistance: Claude (Anthropic), used through Claude Code.
   SI-assisted: source code (apps/web, services/analysis, scripts), tests, documentation, site and submission text,
   and the curation tables in data/curation/ (transcriptions of NASA source cells and report tables).
   Checked by code: every curated token is matched exactly against its cited NASA source cell
   (scripts/check_curation_provenance.py); automated tests cover the pipeline and the app.
   Not SI-generated: the NASA source data in data/raw/ (NASA PSI, CC0) and every number, which the code computes from it.
   No SI-generated images, video or audio. Demo media are labelled screen recordings of the app.
   Details: README.md, section "Use of Super Intelligence (SI)".
   ```
5. **The data metadata says "AI", and the generated data files carry no SI field.**
   - In `data/curation/README.md` line 1, change "(AI-assistance metadata)" to "(SI-assistance metadata)".
   - Optional, needs the ingestion or export owner: add a field to `data/normalized/dataset_report.json` through the
     export step:
     `"si_assistance": "Curation tables transcribed with SI assistance (Claude, Anthropic); every token provenance-checked against the NASA source cell."`
6. **The site has no machine-readable SI metadata (optional).** In `apps/web/app/layout.tsx`, add this to the Next
   `metadata` object:
   `other: { "si-disclosure": "SI-assisted project: built with Claude (Anthropic). See /methodology#si." }`
   The served `<meta>` tags currently have no SI mention.
7. **The /methodology "How we used SI" paragraph does not say what people did or how SI output was checked (optional).**
   Append to `SiNote` in `section-built.tsx`: "The project owner directed the work and reviewed it. Code checks the SI
   output: every transcribed value must match its NASA source cell exactly, and automated tests cover the pipeline and the
   app."
8. **Mixed AI/SI wording in `submission/project-page.md`** (and its template `docs/_gen/templates/submission/project-page.md`).
   Rename the heading "How AI was used to build this" (line 137) to "How SI was used to build this". Update the two
   cross-references on lines 159 and 259 (190 in the template) to match. Optionally replace the body with 3b.

### NASA branding check
No NASA logo, flag, insignia or patch was found in the app's assets, and the still checked shows none. The UI and media
use NASA names ("NASA Exploration Atmosphere", experiment names such as SoFIE-GEL, SSCE, BASS-II) only as text that cites
where the data comes from. The footer says "Not endorsed by NASA." This is low risk. Keep it that way: no NASA logos in
thumbnails, slides or the video cover image.
