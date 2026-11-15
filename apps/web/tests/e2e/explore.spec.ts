import { expect, test } from "@playwright/test";
import {
  candidateMarks,
  chooseOption,
  contextEnvelopes,
  contextPoints,
  groupSelect,
  layerChip,
  mapGroup,
  obsMarks,
  openExplore,
  plottedCount,
  trackApi,
  waitForCandidates,
} from "./helpers";

type Group = { group_id: string; label: string; model_status: string; n_observations: number; is_default?: boolean; pressure_kpa_range: [number, number] | null };
type Profile = { profile_id: string; name: string; kind: string; status: string };

test.describe("Explore (live API)", () => {
  test("default view renders real observations for the data-driven default group", async ({ page, request }) => {
    const groups = (await (await request.get("/api/groups")).json()) as Group[];
    const def = groups.find((g) => g.is_default) ?? groups.find((g) => g.model_status === "modeled");
    expect(def, "API must expose a default group").toBeTruthy();

    await openExplore(page);
    await expect(page).toHaveURL(new RegExp(`group=${def!.group_id}`));
    await expect(page.getByTestId("group-facts")).toContainText(`${def!.n_observations} observations`);
    await expect(page.getByTestId("map-region").getByText(def!.label, { exact: true })).toBeVisible();

    const { plotted, total } = await plottedCount(page);
    expect(total).toBe(def!.n_observations);
    expect(plotted).toBeGreaterThan(0);
    expect(await obsMarks(page).count()).toBe(plotted);

    // data-driven defaults: observations, coverage and context layers on; the model layers are opt-in
    await expect(layerChip(page, "observations")).toHaveAttribute("aria-pressed", "true");
    await expect(layerChip(page, "context")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("data-source-badge")).toHaveAttribute("data-source", "live");
    await expect(page.getByTestId("version-chip")).toHaveAttribute("data-state", "ok");

    // both analysis panels carry content, a verdict and the framing text
    await expect(page.getByTestId("verdict-badge")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Next research candidate" })).toBeVisible();
    await waitForCandidates(page);
    await expect(page.getByTestId("candidate-panel")).toContainText("Computational research candidate");
    await expect(page.getByRole("contentinfo")).toContainText("Not a certified fire-safety assessment");
  });

  test("context layer is on by default and shows documented tests that are not integrated", async ({ page }) => {
    await openExplore(page);
    await expect(layerChip(page, "context")).toHaveAttribute("aria-pressed", "true");
    // envelopes (documented test conditions) and point markers both belong to the context layer
    await expect.poll(async () => (await contextEnvelopes(page).count()) + (await contextPoints(page).count())).toBeGreaterThan(0);
    await layerChip(page, "context").click();
    await expect(layerChip(page, "context")).toHaveAttribute("aria-pressed", "false");
    await expect(contextEnvelopes(page)).toHaveCount(0);
    await expect(contextPoints(page)).toHaveCount(0);
  });

  test("switching group updates facts, plotted observations and URL; coverage-only groups say so", async ({ page, request }) => {
    const groups = (await (await request.get("/api/groups")).json()) as Group[];
    await openExplore(page);
    const first = await plottedCount(page);
    const startUrl = page.url();

    const label = await chooseOption(page, groupSelect(page), (labels) => labels.findIndex((l) => l.includes("modelled") && !l.startsWith(groups.find((g) => g.is_default)?.label ?? "\0")));
    const other = groups.find((g) => label.startsWith(g.label));
    expect(other, `option ${label} should map to an API group`).toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`group=${other!.group_id}`));
    expect(page.url()).not.toBe(startUrl);
    await expect(page.getByTestId("group-facts")).toContainText(`${other!.n_observations} observations`);
    await expect.poll(async () => (await plottedCount(page)).total).toBe(other!.n_observations);
    expect((await plottedCount(page)).total).not.toBe(first.total);
    await expect(page.getByTestId("map-region").getByText(other!.label, { exact: true })).toBeVisible();

    // a coverage-only group: model layers disabled, explicit callout, no candidates
    const coverageOnly = groups.find((g) => g.model_status !== "modeled");
    test.skip(!coverageOnly, "every group is modelled");
    await chooseOption(page, groupSelect(page), (labels) => labels.findIndex((l) => l.startsWith(coverageOnly!.label) && l.includes("coverage only")));
    await expect(page).toHaveURL(new RegExp(`group=${coverageOnly!.group_id}`));
    await expect(page.getByText("Coverage only", { exact: true })).toBeVisible();
    await expect(layerChip(page, "prediction")).toBeDisabled();
    await expect(layerChip(page, "uncertainty")).toBeDisabled();
    await expect(page.getByText("No candidates for this group")).toBeVisible();
    await expect(page.getByTestId("target-analysis")).toContainText("too few training observations");
    // never a probability for a group with no model
    await expect(page.getByTestId("target-analysis")).not.toContainText("P(sustained)");
  });

  test("switching target updates the analysis panel, URL and slice", async ({ page, request }) => {
    const { profiles } = (await (await request.get("/api/targets")).json()) as { profiles: Profile[] };
    await openExplore(page);
    const startLabel = (await page.getByTestId("target-analysis").locator("p").first().innerText()).trim();
    const sliceBefore = await page.getByTestId("slice-value").innerText();

    await page.getByTestId("target-selector").click();
    const dialog = page.getByRole("dialog", { name: "Target atmosphere" });
    await expect(dialog).toBeVisible();
    // envelopes are context only, never selectable analysis targets
    const env = profiles.find((p) => p.kind === "envelope");
    if (env) await expect(dialog.getByRole("button", { name: env.name })).toHaveCount(0);
    const candidates = profiles.filter((p) => p.kind !== "envelope" && p.name !== startLabel);
    // choose the profile with the most different pressure by picking the last selectable one in the list
    const pick = candidates[candidates.length - 1]!;
    await dialog.getByRole("button", { name: new RegExp(pick.name.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`target=${pick.profile_id}`));
    await expect(page.getByTestId("target-analysis").locator("p").first()).toContainText(pick.name);
    await expect(page.getByTestId("target-selector")).toContainText(pick.name.slice(0, 20));
    await expect(page.getByTestId("verdict-badge")).toBeVisible();
    // the map slice follows the new target's pressure
    await expect.poll(async () => page.getByTestId("slice-value").innerText()).not.toBe(sliceBefore);
  });

  test("plane switch swaps the axes and slice variable", async ({ page }) => {
    const api = trackApi(page);
    await openExplore(page);
    await expect(page.getByTestId("slice-value")).toContainText("kPa");
    await expect(mapGroup(page)).toHaveAttribute("aria-label", /oxygen versus airflow/);

    await page.getByRole("radio", { name: /pressure/ }).click();
    await expect(page).toHaveURL(/plane=o2_pressure/);
    await expect(mapGroup(page)).toHaveAttribute("aria-label", /oxygen versus pressure/);
    await expect(page.getByTestId("slice-value")).toContainText("cm/s");
    await expect(page.getByText("Airflow slice", { exact: true })).toBeVisible();
    await expect.poll(() => api.urls().some((u) => u.includes("/api/coverage") && u.includes("plane=o2_pressure"))).toBe(true);
    await expect(page.getByTestId("obs-note")).toContainText("airflow slice");

    await page.getByRole("radio", { name: /airflow/ }).click();
    await expect(mapGroup(page)).toHaveAttribute("aria-label", /oxygen versus airflow/);
    await expect(page.getByTestId("slice-value")).toContainText("kPa");
  });

  test("moving the slice requests new coverage and changes the plotted subset", async ({ page }) => {
    const api = trackApi(page);
    await openExplore(page, "?plane=o2_pressure");
    await expect(page.getByTestId("slice-value")).toContainText("cm/s");
    const before = await page.getByTestId("slice-value").innerText();
    const noteBefore = await page.getByTestId("obs-note").innerText();
    api.clear();
    const thumb = page.getByRole("slider", { name: /airflow slice/i });
    await thumb.focus();
    await thumb.press("End"); // commits on key press; moves to the slice maximum
    await expect(page.getByTestId("slice-value")).not.toHaveText(before);
    await expect.poll(() => api.urls().some((u) => u.includes("/api/coverage") && u.includes("plane=o2_pressure"))).toBe(true);
    // the slice value shown matches the one sent to the API
    const shown = /([\d.]+)\s*cm\/s/.exec(await page.getByTestId("slice-value").innerText())![1];
    await expect.poll(() => api.urls().some((u) => u.includes(`slice=${Number(shown)}`))).toBe(true);
    await expect(page.getByTestId("obs-note")).not.toHaveText(noteBefore);
  });

  test("layer toggles show and hide their map marks", async ({ page }) => {
    await openExplore(page);
    // observations
    expect(await obsMarks(page).count()).toBeGreaterThan(0);
    await layerChip(page, "observations").click();
    await expect(layerChip(page, "observations")).toHaveAttribute("aria-pressed", "false");
    await expect(obsMarks(page)).toHaveCount(0);
    await layerChip(page, "observations").click();
    await expect(obsMarks(page).first()).toBeVisible();

    // prediction contours need the model surface: the chip turns on and the surface is requested
    const surf = page.waitForResponse((r) => r.url().includes("/api/surface") && r.ok());
    await layerChip(page, "prediction").click();
    await surf;
    await expect(layerChip(page, "prediction")).toHaveAttribute("aria-pressed", "true");
    await expect(mapGroup(page).locator('path[stroke-width="2"]').first()).toBeAttached();
    await layerChip(page, "prediction").click();
    await expect(mapGroup(page).locator('path[stroke-width="2"]')).toHaveCount(0);

    // coverage and uncertainty chips toggle their state
    for (const l of ["coverage", "uncertainty"]) {
      const chip = layerChip(page, l);
      const was = await chip.getAttribute("aria-pressed");
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", was === "true" ? "false" : "true");
    }
    // the accessible table view lists the same observations
    await page.getByRole("button", { name: "View as table" }).click();
    await expect(page.getByRole("region", { name: /table view/ }).locator("tbody tr").first()).toBeVisible();
  });

  test("a far-away target shows the insufficient-evidence callout and no probability estimate", async ({ page, request }) => {
    const groups = (await (await request.get("/api/groups")).json()) as Group[];
    const def = groups.find((g) => g.is_default) ?? groups.find((g) => g.model_status === "modeled")!;
    const { profiles } = (await (await request.get("/api/targets")).json()) as { profiles: Profile[] };
    let far: Profile | undefined;
    for (const p of profiles.filter((x) => x.kind !== "envelope")) {
      const r = await request.post("/api/target/assess", { data: { group_id: def.group_id, target: { profile_id: p.profile_id } } });
      if (r.ok() && ((await r.json()) as { verdict: string }).verdict === "insufficient_evidence") {
        far = p;
        break;
      }
    }
    test.skip(!far, "no documented profile is insufficient_evidence for the default group");

    await openExplore(page, `?group=${def.group_id}&target=${far!.profile_id}`);
    const panel = page.getByTestId("target-analysis");
    await expect(panel).toHaveAttribute("data-verdict", "insufficient_evidence");
    await expect(page.getByRole("status").filter({ hasText: "Insufficient experimental evidence for a reliable estimate." })).toBeVisible();
    await expect(page.getByTestId("verdict-badge")).toHaveText("Insufficient evidence");
    // no p(sustained) as an estimate for this target (it is base-rate reversion, not a pressure effect)
    await expect(panel.getByText(/P\(sustained\)( across target|, extrapolated)/)).toHaveCount(0);
    await expect(panel.getByText("Comparable observations")).toBeVisible();
    await panel.getByText("Why is this region uncertain?").click();
    await expect(page.getByTestId("why-uncertain").locator("li").first()).toBeVisible();
  });

  test("[bug check] candidate and counterfactual panels do not present P(sustained) for an insufficient-evidence target as an estimate", async ({ page, request }) => {
    const groups = (await (await request.get("/api/groups")).json()) as Group[];
    const def = groups.find((g) => g.is_default) ?? groups.find((g) => g.model_status === "modeled")!;
    const { profiles } = (await (await request.get("/api/targets")).json()) as { profiles: Profile[] };
    let far: Profile | undefined;
    for (const p of profiles.filter((x) => x.kind !== "envelope")) {
      const r = await request.post("/api/target/assess", { data: { group_id: def.group_id, target: { profile_id: p.profile_id } } });
      if (r.ok() && ((await r.json()) as { verdict: string }).verdict === "insufficient_evidence") {
        far = p;
        break;
      }
    }
    test.skip(!far, "no documented profile is insufficient_evidence for the default group");
    await openExplore(page, `?group=${def.group_id}&target=${far!.profile_id}`);
    await waitForCandidates(page);
    const top = page.getByTestId("top-candidate");
    // a bare "P(sustained) 0.xx" for a candidate at an unsupported target must carry the reversion caveat
    const text = await top.innerText();
    if (/P\(sustained\)\s*[01]?\.\d+/.test(text)) {
      expect(text, "P(sustained) shown without a base-rate/insufficient-evidence caveat").toMatch(/base rate|insufficient|not a (meaningful )?estimate|reversion/i);
    }
    await page.getByTestId("explore-candidate").click();
    const cf = page.getByTestId("counterfactual-panel");
    await expect(cf).toBeVisible();
    await expect(cf.getByTestId("scenario-sustained")).toBeVisible();
    const cfText = await cf.innerText();
    if (/P\(sustained\)\s*[01]?\.\d+/.test(cfText)) {
      expect(cfText, "counterfactual shows P(sustained) for an insufficient target without a caveat").toMatch(/base rate|insufficient|not a (meaningful )?estimate|reversion/i);
    }
  });

  test("candidate panel ranks candidates, Explore candidate highlights it and opens the counterfactual preview", async ({ page }) => {
    const api = trackApi(page);
    await openExplore(page);
    await waitForCandidates(page);

    // ranked list: top candidate + others, each with conditions and an expected-reduction percentage
    const top = page.getByTestId("top-candidate");
    await expect(top).toContainText("Candidate 1");
    await expect(page.getByTestId("evr-value")).toHaveText(/^\d+(\.\d+)?\s?%$/);
    await expect(top).toContainText("Expected reduction of target uncertainty");
    const others = page.getByRole("list", { name: "Other ranked candidates" }).getByRole("listitem");
    expect(await others.count()).toBeGreaterThan(0);
    await expect(page.getByRole("table", { name: /selection strategy/ })).toContainText("Random");
    await expect(page.getByRole("table", { name: /selection strategy/ })).toContainText("Uncertainty sampling");
    await expect(page.getByTestId("candidate-panel")).toContainText("requiring qualified scientific review");
    // the map shows one marker per ranked candidate
    const nCands = 1 + (await others.count());
    await expect(candidateMarks(page)).toHaveCount(nCands);

    // Explore: highlights the marker and opens the counterfactual preview with its mandatory label
    await expect(page.getByTestId("counterfactual-panel")).toHaveCount(0);
    await page.getByTestId("explore-candidate").click();
    const cf = page.getByTestId("counterfactual-panel");
    await expect(cf).toBeVisible();
    await expect(page.getByTestId("hypothetical-label")).toHaveText("Hypothetical outcome — not an experimental result");
    await expect(cf.getByTestId("scenario-sustained")).toBeVisible();
    await expect(cf.getByTestId("scenario-not_sustained")).toBeVisible();
    await expect(candidateMarks(page).first()).toHaveAttribute("aria-pressed", "true");
    expect(api.urls().some((u) => u.startsWith("POST /api/candidates/counterfactual") || u.includes("counterfactual"))).toBe(true);

    // hypothetical surface on the map is labelled
    await cf.getByRole("radio", { name: "If sustained" }).click();
    await expect(page.getByTestId("hypothetical-map-note")).toContainText("Hypothetical outcome — not an experimental result");
    await expect(layerChip(page, "prediction")).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Close counterfactual preview" }).click();
    await expect(cf).toHaveCount(0);
  });

  test("compare two candidates", async ({ page }) => {
    await openExplore(page);
    await waitForCandidates(page);
    const compare = page.getByTestId("open-compare");
    await expect(compare).toBeDisabled();
    const toggles = page.getByRole("button", { name: /^(Compare|In comparison)$/ });
    await toggles.nth(0).click();
    await expect(compare).toBeDisabled(); // one is not enough
    await toggles.nth(1).click();
    await expect(compare).toBeEnabled();
    await expect(page.getByRole("button", { name: "In comparison" })).toHaveCount(2);
    await compare.click();
    const sheet = page.getByRole("dialog", { name: "Compare candidates" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId("compare-sheet")).toBeVisible();
    await expect(sheet.getByTestId("compare-verdict")).toHaveText(/Candidate \d preferred|Indistinguishable/);
    await expect(sheet.getByRole("heading", { name: "Candidate 1" })).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Candidate 2" })).toBeVisible();
    await expect(sheet.getByText("Expected reduction").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("custom target dialog analyses user-selected conditions and rejects invalid input", async ({ page }) => {
    await openExplore(page);
    await page.getByTestId("target-selector").click();
    const dialog = page.getByRole("dialog", { name: "Target atmosphere" });
    const custom = dialog.getByRole("button", { name: "Custom target…" });
    await expect(custom).toBeEnabled();
    await expect(dialog).not.toContainText("require the live analysis service");
    await custom.click();
    const form = page.getByRole("dialog", { name: "Custom target" });
    await expect(form.getByText("User-selected hypothetical conditions").first()).toBeVisible();

    // validation first
    await form.getByLabel("Oxygen (% by volume)").fill("150");
    await form.getByRole("button", { name: "Analyse target" }).click();
    await expect(form.getByRole("alert")).toContainText("Oxygen must be between 1 and 100");
    await form.getByLabel("Oxygen (% by volume)").fill("23");
    await form.getByLabel("Total pressure").fill("2");
    await form.getByRole("button", { name: "Analyse target" }).click();
    await expect(form.getByRole("alert")).toContainText("Pressure must be between");

    // valid
    await form.getByLabel("Total pressure").fill("101.3");
    const assess = page.waitForResponse((r) => r.url().includes("/api/target/assess") && r.request().method() === "POST");
    await form.getByRole("button", { name: "Analyse target" }).click();
    const res = await assess;
    expect(res.ok()).toBe(true);
    await expect(form).toBeHidden();
    await expect(page.getByTestId("target-selector")).toContainText("User-selected hypothetical conditions");
    await expect(page).toHaveURL(/target=custom/);
    await expect(page.getByTestId("target-analysis").locator("p").first()).toHaveText("User-selected hypothetical conditions");
    await expect(page.getByTestId("target-analysis")).toContainText("23.0 %");
    await expect(page.getByTestId("verdict-badge")).toBeVisible();
  });

  test("a deep link restores group, target and plane", async ({ page, request }) => {
    const groups = (await (await request.get("/api/groups")).json()) as Group[];
    const modelled = groups.filter((g) => g.model_status === "modeled");
    const g = modelled[modelled.length - 1]!;
    const { profiles } = (await (await request.get("/api/targets")).json()) as { profiles: Profile[] };
    const t = profiles.filter((p) => p.kind !== "envelope")[1]!;
    await openExplore(page, `?group=${g.group_id}&target=${t.profile_id}&plane=o2_pressure`);
    await expect(page.getByTestId("group-facts")).toContainText(`${g.n_observations} observations`);
    await expect(page.getByTestId("target-analysis").locator("p").first()).toContainText(t.name);
    await expect(page.getByRole("radio", { name: /pressure/ })).toHaveAttribute("data-state", "on");
  });

  test("footer strip links to the brief and methodology limitations", async ({ page }) => {
    await openExplore(page);
    const strip = page.getByTestId("footer-strip");
    await expect(strip.getByTestId("brief-link")).toHaveAttribute("href", /^\/brief\?.*group=/);
    await expect(strip.getByRole("link", { name: "Limitations" })).toHaveAttribute("href", "/methodology#limitations");
    await expect(strip).toContainText("Dataset");
  });
});

test.describe("Explore science-caveat guards (live API)", () => {
  test("[bug check] the collapsed Full summary does not state a P(sustained) estimate for an insufficient-evidence target", async ({ page, request }) => {
    const groups = (await (await request.get("/api/groups")).json()) as Group[];
    const def = groups.find((g) => g.is_default) ?? groups.find((g) => g.model_status === "modeled")!;
    const { profiles } = (await (await request.get("/api/targets")).json()) as { profiles: Profile[] };
    let far: Profile | undefined;
    for (const p of profiles.filter((x) => x.kind !== "envelope")) {
      const r = await request.post("/api/target/assess", { data: { group_id: def.group_id, target: { profile_id: p.profile_id } } });
      if (r.ok() && ((await r.json()) as { verdict: string }).verdict === "insufficient_evidence") {
        far = p;
        break;
      }
    }
    test.skip(!far, "no documented profile is insufficient_evidence for the default group");
    await openExplore(page, `?group=${def.group_id}&target=${far!.profile_id}`);
    const summary = page.getByTestId("target-analysis").locator("details", { hasText: "Full summary" });
    await summary.locator("summary").click();
    await expect(summary).not.toContainText(/P\(sustained\) over the target region: mean/);
  });
});
