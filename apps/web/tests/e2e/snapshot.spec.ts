import { expect, test, type Page } from "@playwright/test";
import { candidateMarks, layerChip, mapGroup, obsMarks, openExplore, trackApi, waitForCandidates } from "./helpers";

/**
 * Snapshot mode: NEXT_PUBLIC_DATA_MODE=snapshot, no API (the /api rewrite points at a closed port).
 * Everything is derived from /snapshot/manifest.json, nothing hard-coded to a group, profile or slice.
 */
type Manifest = {
  generated_at: string;
  dataset_version: string;
  model_version: string;
  slices: { o2_flow: number[]; o2_pressure: number[] };
  profiles: string[];
  modelled_groups: string[];
  entries: Record<string, string>;
};

let manifest: Manifest;
test.beforeAll(async ({ request }) => {
  manifest = (await (await request.get("/snapshot/manifest.json")).json()) as Manifest;
});

const apiCalls = (calls: string[]) => calls.filter((u) => !u.includes("/snapshot/"));

async function groupsFromSnapshot(page: Page) {
  const entry = manifest.entries["GET /api/groups"];
  expect(entry, "snapshot must contain GET /api/groups").toBeTruthy();
  return (await (await page.request.get(`/snapshot/${entry}`)).json()) as { group_id: string; label: string; model_status: string; n_observations: number; is_default?: boolean }[];
}

test.describe("Explorer (snapshot, no API)", () => {
  test("renders real test results from the precomputed snapshot without calling the API", async ({ page }) => {
    const api = trackApi(page);
    await openExplore(page);
    await expect(page.getByTestId("data-source-badge").first()).toHaveAttribute("data-source", "snapshot");
    await expect(page.getByTestId("data-source-badge").first()).toContainText("Precomputed data");
    await expect(page.getByTestId("data-source-badge").first()).toHaveAttribute("data-version", manifest.model_version);
    await expect(page.getByTestId("plain-verdict")).toBeVisible();
    await waitForCandidates(page);
    await expect(candidateMarks(page).first()).toBeVisible();
    expect(await obsMarks(page).count()).toBeGreaterThan(0);
    expect(apiCalls(api.urls()), "snapshot mode must not call the live API").toEqual([]);
  });

  test("the airflow control offers exactly the exported slices", async ({ page }) => {
    await openExplore(page);
    await expect(mapGroup(page)).toHaveAttribute("aria-label", /oxygen versus pressure/);
    const slice = page.getByRole("combobox", { name: /Airflow held at/i });
    await expect(slice).toBeVisible();
    const current = (await slice.innerText()).trim();
    await slice.click();
    const labels = (await page.getByRole("option").allInnerTexts()).map((t) => t.trim());
    expect(labels).toEqual(manifest.slices.o2_pressure.map((v) => `${v.toFixed(1)} cm/s`));
    const otherIdx = labels.findIndex((l) => l !== current);
    expect(otherIdx).toBeGreaterThanOrEqual(0);
    await page.getByRole("option").nth(otherIdx).click();
    await expect(slice).toHaveText(labels[otherIdx]!);
    await expect(mapGroup(page)).toBeVisible();
    await expect(page.locator("[data-error-code]")).toHaveCount(0);
  });

  test("a hand-written custom target URL shows the 'not in this precomputed version' state, not fabricated numbers", async ({ page }) => {
    const custom = { label: "User-selected hypothetical conditions", oxygen_percent: { nominal: 23, min: null, max: null }, total_pressure_kpa: { nominal: 101.3, min: null, max: null }, airflow_cm_s: null };
    const enc = Buffer.from(JSON.stringify(custom)).toString("base64url");
    await page.goto(`/explore?target=custom:${enc}`);
    await expect(page.getByText("Not in this precomputed version").first()).toBeVisible();
    await expect(page.getByTestId("plain-verdict")).toHaveCount(0);
    await expect(page.getByTestId("top-candidate")).toHaveCount(0);
  });

  test("switching material works from the snapshot", async ({ page }) => {
    const groups = await groupsFromSnapshot(page);
    const api = trackApi(page);
    await openExplore(page);
    const startUrl = page.url();
    const material = page.getByRole("combobox", { name: "Material" });
    const current = (await material.innerText()).trim();
    await material.click();
    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();
    expect(await options.count()).toBeGreaterThanOrEqual(2);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    const labels = (await options.allInnerTexts()).map((t) => t.trim());
    const idx = labels.findIndex((l) => l !== current && !l.includes("not modelled"));
    await options.nth(idx >= 0 ? idx : 1).click();
    await expect(page).not.toHaveURL(startUrl);
    await expect(page.getByTestId("target-analysis")).toBeVisible();
    expect(apiCalls(api.urls())).toEqual([]);
  });

  test("every documented profile and every modelled material renders a verdict and a candidate panel from the snapshot", async ({ page }) => {
    test.setTimeout(420_000);
    const groups = await groupsFromSnapshot(page);
    const def = groups.find((g) => g.is_default)?.group_id ?? manifest.modelled_groups[0]!;
    const pairs = [...manifest.profiles.map((p) => [def, p] as const), ...manifest.modelled_groups.map((g) => [g, manifest.profiles[0]!] as const)];
    const problems: string[] = [];
    for (const [g, p] of pairs) {
      await page.goto(`/explore?group=${g}&target=${p}`);
      const rank = page.getByTestId("top-candidate").or(page.getByText("No eligible candidates")).or(page.getByText("Not in this precomputed version").first()).or(page.locator("[data-error-code]").first());
      try {
        await expect(page.getByTestId("plain-verdict")).toBeVisible({ timeout: 20_000 });
        await expect(rank).toBeVisible({ timeout: 20_000 });
        if ((await page.locator("[data-error-code]").count()) > 0 || (await page.getByText("Not in this precomputed version").count()) > 0) problems.push(`${g} x ${p}: error or snapshot gap shown`);
        else if ((await page.getByTestId("top-candidate").count()) === 0) problems.push(`${g} x ${p}: no top candidate`);
      } catch {
        problems.push(`${g} x ${p}: did not render`);
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("What would we learn? opens a counterfactual preview from the snapshot", async ({ page }) => {
    await openExplore(page);
    await waitForCandidates(page);
    await page.getByTestId("explore-candidate").click();
    const cf = page.getByTestId("counterfactual-panel");
    await expect(cf).toBeVisible();
    await expect(cf.getByTestId("scenario-sustained").or(page.getByText("Not in this precomputed version").first())).toBeVisible();
    await expect(page.getByTestId("hypothetical-label")).toContainText("Hypothetical");
  });

  test("layer toggles work in snapshot mode", async ({ page }) => {
    await openExplore(page);
    await layerChip(page, "observations").click();
    await expect(obsMarks(page)).toHaveCount(0);
    await layerChip(page, "observations").click();
    await expect(obsMarks(page).first()).toBeVisible();
    await layerChip(page, "prediction").click();
    await expect(layerChip(page, "prediction")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-error-code]")).toHaveCount(0);
  });
});

test.describe("Other pages (snapshot, no API)", () => {
  test("Experiments lists records from the snapshot with no API call", async ({ page }) => {
    const api = trackApi(page);
    await page.goto("/experiments");
    const rows = page.getByRole("table", { name: "Experiments" }).locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(20);
    await expect(page.getByTestId("data-source-badge").first()).toHaveAttribute("data-source", "snapshot");
    expect(apiCalls(api.urls())).toEqual([]);
  });

  test("How it works renders validation charts from the snapshot", async ({ page }) => {
    await page.goto("/methodology#validation");
    await expect(page.getByRole("heading", { level: 1, name: "How it works" })).toBeVisible();
    const v = page.locator("#validation");
    await expect.poll(async () => v.locator("svg[role=img]").count()).toBeGreaterThanOrEqual(3);
    await expect(v).toContainText(/Out-of-fold predictions pooled: \d+/);
    await expect(page.getByTestId("data-source-badge").first()).toHaveAttribute("data-source", "snapshot");
  });

  test("Brief renders and offers downloads, or says it needs the live service", async ({ page }) => {
    await page.goto("/brief");
    const brief = page.getByTestId("brief");
    await expect(brief.getByRole("heading", { level: 1 }).or(brief.getByText("Not in this precomputed version"))).toBeVisible();
    if ((await brief.getByRole("heading", { level: 1 }).count()) > 0) {
      await expect(brief.getByRole("button", { name: /Download \.md/ })).toBeEnabled();
      await expect(brief).toContainText("This brief contains no test procedures");
    }
  });
});
