# NASA Space Apps Challenge: official context for Blind Spots

Researched 2026-11-15 (task `research-space-apps`). Primary sources were fetched with curl from spaceappschallenge.org
on 2026-11-15; quotes are verbatim from those pages unless marked otherwise. Items marked UNVERIFIED could not be sourced.

## 1. The relevant challenge (2026)

- Title: "Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data"
- Year: 2026 NASA Space Apps Challenge ("The Next Frontier", hackathon November 14-15, 2026)
- URL: https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/
  (page title is server-rendered; the body text is embedded in the page's Next.js data payload and was read from there)
- Summary (verbatim): "For decades, NASA has studied how flames and fire behave in microgravity, gathering a trove of experimental data along the way. That knowledge matters more than ever as humans gear up to return to the Moon and press on to Mars, yet the volume of results makes them hard to find, compare, and understand. Your challenge is to create an interactive, super intelligence (SI) powered dashboard that summarizes, ranks, and interprets those findings to deliver fire safety insights for human space exploration."
- Objectives (verbatim): "Your challenge is to build an SI-powered, web-based dashboard that summarizes, ranks, and interprets combustion science investigations to deliver critical foundational insights for fire safety. You may consider enabling users to:"
  - "Identify investigations most relevant to the fire safety needs of habitable crew environments, including spacecraft, space stations, bases on the lunar and Martian surfaces, and pressurized rovers."
  - "Extract data that supports predictive modeling of flammability and fire scenarios in space exploration."
  - "Highlight research that informs the development of next-generation fire safety controls and equipment."
- Problem statement before the objectives: "Results from low-gravity combustion experiments, conducted for example on the International Space Station (ISS), are being made publicly available through NASA's Physical Science Informatics (PSI) database, but the amount of data can be overwhelming. It can be hard to find, harder to compare, and harder yet to interpret."
- Optional extra: "Your dashboard could also address potential applications of the PSI data to fire safety on Earth."
- Scope note (verbatim): "Fire safety involving rockets and propellants is generally beyond the scope of the research available in the PSI database."
- Background points relevant to the product (paraphrase/short quotes):
  - Flammability studies "focus on solid materials such as fabrics and plastics, as studied in the Burning and Suppression of Solids (BASS and BASS-II) and Spacecraft Fire Safety Demonstration (Saffire-I, -II, and -III) investigations."
  - Moon base atmosphere: "The intermediate oxygen concentration used on the Moon will likely be 30% or greater, with a corresponding pressure of 10.2 psi or less." (challenge-page statement; for our atmosphere profiles cite NASA design documents, not this page, as the primary source)
  - Partial gravity: "there is currently no partial-gravity combustion data available in PSI." (LUCI and FM2 are named as possible future sources.) Relevant to Blind Spots: the gap map is microgravity only.
- "Potential Considerations" (optional): audience of professors, students, researchers, engineers; summarize experimental objectives, fuels (shape and size), test conditions (oxygen concentration, airflow speed), variables, sensors/measurements, similarities and differences between investigations; hardware notes (BASS, BASS-II, SPICE, SLICE share the MSG fan-driven flow duct).
- Listed NASA data and resources (verbatim titles and URLs from the page):
  - PSI Data Repository: Combustion Science, https://psi.nasa.gov/physci/repo/search?q=combustion
  - NASA Combustion Science, https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/
  - A Researcher's Guide to International Space Station Combustion Science, https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/
  - NASA ScienceCasts: The Power of Studying Combustion on the ISS, https://www.youtube.com/watch?v=W1oXykoz9zg
  - Apollo 1 (https://sma.nasa.gov/sma-disciplines/accllp/apollo-1), Apollo 13 (https://sma.nasa.gov/sma-disciplines/accllp/apollo-13), 25 Years Ago: Fire Aboard Space Station Mir (https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/), and three NASA Spinoff pages on firefighter gear and fire detection.
- Page note: "More resources may be added before the hackathon begins." Our copy was read on the event weekend; a later re-read could show more.
- Other 2026 or earlier Space Apps challenges on fire safety: not checked exhaustively (the 2026 challenges list is rendered client-side and could not be read from static HTML). UNVERIFIED whether any prior-year challenge covers this topic.
- Public team repositories for this challenge exist on GitHub (found via web search, e.g. several "flame-in-freefall" repos). They are other teams' unofficial work, not NASA material; treat as competitive context only and do not copy.

## 2. Judging criteria and submission requirements (2026)

Sources: https://www.spaceappschallenge.org/resources/judging-awards-guide/ and https://www.spaceappschallenge.org/resources/project-submission-guide/

Judging (verbatim): "At every level of judging ... your project will be evaluated on a scale of 1-to-5, in each of the following criteria:" Impact, Creativity, Validity, Relevance, Presentation.

| Criterion | Official definition (condensed from the guide, near-verbatim) |
|---|---|
| Impact | "addressing either a minor or major problem ... The extent to which it inspires or helps others varies, ranging from a broad audience to a select few." |
| Creativity | "originality and innovation ... a novel concept ... or presents an improvement upon existing ideas in a meaningful way." |
| Validity | "a proposed solution that is grounded in scientific principles and demonstrates technical, functional, or logical feasibility ... the usability and user-friendliness of the project influence its practicality and accessibility." |
| Relevance | "fully and directly addresses the challenge ... meaningfully integrates NASA data, utilizing it as a core component of the proposed solution rather than a superficial addition." |
| Presentation | "clearly conveying the challenge, their proposed solution, and its significance ... Judges evaluate the demo and full project to compute this score." |

Guide advice: pay equal attention to Presentation; a strong demo can raise it.

Submission requirements (verbatim or near-verbatim):
- Demo: "either in the form of a slide presentation (7-slide limit including title and intro slides) or a video presentation (30-second limit)." "Projects that exceed these limits will not be eligible for Global Judging." Hosted externally with a public link needing no login. Video in another language must have English subtitles; slides must be English.
- Project page fields: Project Name; High-Level Project Summary; Link to Project Demo; Link to Final Project (public, no login); Detailed Project Description; Use of Super Intelligence (SI); NASA Data; Space Agency Partner Data and Other References. All required fields must be completed to submit.
- NASA data: "To be eligible for a Global Award, you must use at least one NASA data or resource."
- References: all code, text and images used, "even if they are open source or freely available", must be listed; originality checkbox required.
- Project page accepts image uploads (JPG, PNG, GIF up to 10MB) but not videos or documents.
- Team size: no more than six; all members registered for the same Local Event (or Universal Event, at least two people).
- No images, video, audio or likeness of persons under 18 in demo or project.
- Deadline: submission "opens on Saturday, November 14 at 9:00 AM and closes on Sunday, November 15 at 11:59 PM local time" of the team's Local Event (Universal Event: Team Owner's local time). Only the last saved submission is reviewed.
- "Video length" for a longer walkthrough is not governed by the page; only the 30-second demo limit is stated. Our own longer explainer video is optional and must be linked via the project page, not uploaded.

AI-use rules (field "Use of Super Intelligence (SI)"):
- "The use of SI tools, such as machine learning, chatbots, image generation, and large language models, is permitted ... and should be used as a tool to accelerate innovation and creativity for your challenge solution. SI should not be used to (come up with your idea of how to solve the challenge)."
- "Generated content may not use, contain, or modify any NASA branding or design elements (such as the NASA logos, flags, or mission identifiers)."
- "We require that you clearly indicate where and how SI tools were utilized": images and videos need a visible watermark; audio, code and data must be acknowledged in descriptive text and metadata. The SI question itself is for data collection and not seen by judges, but judges see SI indicators in the project.
- The challenge itself requires SI/AI use in the dashboard ("SI-powered").

Global awards (verbatim names): Best Use of Science, Best Use of Data, Best Use of Technology, Galactic Impact, Best Mission Concept, Most Inspirational, Best Storytelling Award, Global Connection Award, Art & Technology Award, Local Impact Award.

## 3. Key dates

| Date | Event | Source |
|---|---|---|
| 2026-11-14 9:00 AM local | Hackathon and project submission open | submission guide |
| 2026-11-15 11:59 PM local | Submission closes (today is 2026-11-15: the 2026 event is happening now, not finished) | submission guide, https://www.spaceappschallenge.org/2026/ |
| 2026-11-30 | Participant survey | https://www.spaceappschallenge.org/2026/ |
| 2026-12-03 | Global Nominees announced | judging guide |
| 2026-12-17 | Global Finalists and Honorable Mentions announced | judging guide |
| 2027-01-26 | Global Winners announced; virtual Winner's Celebration in early 2027 | judging guide |

2027 call: no 2027 Space Apps hackathon announcement was found on the pages read (home page, 2026 page, guides). UNVERIFIED and likely not yet announced.

## 4. Checklist: judging criteria mapped to planned Blind Spots features

Feature names refer to docs/CONTRACTS.md. "Status" is for the lead to fill as features land; none are asserted as built.

| Criterion / requirement | Planned product feature (CONTRACTS ref) | Evidence to show judges | Status |
|---|---|---|---|
| Relevance: addresses the challenge directly | Explore workspace `/` summarizing and ranking PSI combustion investigations (sec. 9, 8 `/api/investigations`, `/api/families`) | investigations table with role (integrated_model / context / catalogued) and counts | [ ] |
| Relevance: "Identify investigations most relevant to ... habitable crew environments" | Atmosphere profiles (moon base, ISS, etc.) and `POST /api/target/assess` coverage verdicts (sec. 3 AtmosphereProfile, 4) | per-profile coverage and support verdict | [ ] |
| Relevance: NASA data is core, not superficial | Dataset built only from PSI-25/PSI-26 (BASS-II/BASS) raw files plus integrated context; `/api/sources`, provenance columns `source_file/sheet/row` (sec. 2, 3) | every point links to source file and row; DOI/landing URL | [ ] |
| Relevance: "Extract data that supports predictive modeling" | Normalized exports `data/normalized/*` and `GET /api/export/experiments.csv`; model card (sec. 3, 8) | CSV download, dataset_version | [ ] |
| Relevance: "Highlight research that informs ... fire safety controls" | Coverage-gap map (`/api/coverage`) and ranked computational research candidates (`/api/candidates/rank`, sec. 6) | gap map plus ranked list with feasibility status, never a feasibility claim | [ ] |
| Validity: scientifically sound, honest uncertainty | GP Laplace classifier with epistemic/aleatoric split; grouped CV and calibration (sec. 5); verdict `supported/extrapolation/insufficient_evidence` with the exact text "Insufficient experimental evidence for a reliable estimate." | validation report (`/api/model/validation`), reliability diagram, leakage assertions | [ ] |
| Validity: usability | WCAG 2.2 AA, keyboard support, data-table fallback per chart (sec. 9) | headless Playwright e2e | [ ] |
| Validity: no overclaiming | Integrity rules (sec. 0): no NASA endorsement claim, "not represented in the integrated records" wording, no apparatus procedures | methodology page limitations section | [ ] |
| Creativity: novel contribution | Active-learning style expected-variance-reduction ranking and counterfactual outcome scenarios (sec. 6, `/api/candidates/counterfactual`) | compare/counterfactual views | [ ] |
| Impact: audience and use | Printable research brief `/brief` and `POST /api/brief`; Moon-base-like atmospheres as targets; Earth-side applications optional per challenge | brief output for a researcher | [ ] |
| Presentation: demo | Guided demo `/?demo=1` (sec. 9); 30-second video or 7-slide deck hosted publicly | demo link, English subtitles if not English | [ ] |
| Submission: SI-use disclosure | `/methodology` states where AI/LLM assistance was used (code, docs, data curation of free-text cells); watermark any AI-generated images/video; acknowledge in descriptive text/metadata | SI field filled on project page | [ ] |
| Submission: references list | `/api/sources` content copied into the "Space Agency Partner Data and Other References" field, including all open-source libraries | complete reference list | [ ] |
| Submission: NASA data field | PSI-25 and PSI-26 DOIs/landing pages (from `data/manifests/`) | NASA Data field | [ ] |
| Submission: public links | Deployed app URL and repository public, no login | tested in a private window | [ ] |
| Submission: no NASA branding | Do not use NASA logos/meatball/flags anywhere in UI or generated content | visual review | [ ] |
| Submission: no minors' likeness | No team photos or voices of under-18 participants in demo or project, if applicable to the team | demo review | [ ] |

## 5. Unverified / caveats

- The challenge list page is client-rendered; the challenge body was read from the detail page's embedded payload. A direct query to the site's GraphQL API was not attempted (blocked by the permission system), so structured fields such as difficulty and subject tags were not read.
- WebFetch failed with a certificate error for spaceappschallenge.org; curl worked.
- The challenge page and guides may be edited during the event; recheck before final submission.
- Not verified: whether Local Events add their own deadlines or judging rules (the guide says to check with the Local Lead).
- Not verified: the Participant Terms and Conditions text (https://www.spaceappschallenge.org/legal/) was not read in full; only the under-18 and China-restriction points as summarized in the judging and submission guides.
- The challenge page's Moon-base atmosphere statement is the challenge writer's expectation, not a NASA requirement document.
