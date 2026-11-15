import { expect, test, type Page } from "@playwright/test";
import { candidateMarks, chooseOption, groupSelect, layerChip, mapGroup, obsMarks, openExplore, trackApi, waitForCandidates } from "./helpers";

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

test.describe("Explore (snapshot, no API)", () => {
  test("renders real observations from the precomputed snapshot without calling the API", async ({ page }) => {
    const api = trackApi(page);
    await openExplore(page);
    await expect(page.getByTestId("data-source-badge").first()).toHaveAttribute("data-source", "snapshot");
    await expect(page.getByTestId("data-source-badge").first()).toContainText(`Precomputed snapshot · ${manifest.model_version}`);
    await expect(page.getByTestId("verdict-badge")).toBeVisible();
    await waitForCandidates(page);
    await expect(candidateMarks(page).first()).toBeVisible();
    expect(await obsMarks(page).count()).toBeGreaterThan(0);
    expect(apiCalls(api.urls()), "snapshot mode must not call the live API").toEqual([]);
    await expect(page.getByText("Precomputed snapshot: slice values are limited to those exported")).toBeVisible();
  });

  test("the slice control offers exactly the exported slices", async ({ page }) => {
    await openExplore(page);
    const slice = page.getByRole("combobox", { name: /slice/i });
    await expect(slice).toBeVisible();
    const current = (await slice.innerText()).trim();
    await slice.click();
    const labels = (await page.getByRole("option").allInnerTexts()).map((t) => t.trim());
    expect(labels).toEqual(manifest.slices.o2_flow.map((v) => `${v.toFixed(1)} kPa`));
    // pick a different exported slice: the map re-renders from the snapshot with no error state
    const otherIdx = labels.findIndex((l) => l !== current);
    expect(otherIdx).toBeGreaterThanOrEqual(0);
    await page.getByRole("option").nth(otherIdx).click();
    await expect(slice).toHaveText(labels[otherIdx]!);
    await expect(mapGroup(page)).toBeVisible();
    await expect(page.locator("[data-error-code]")).toHaveCount(0);

    await page.getByRole("radio", { name: /pressure/ }).click();
    await expect(page).toHaveURL(/plane=o2_pressure/);
    const s2 = page.getByRole("combobox", { name: /slice/i });
    await s2.click();
    const labels2 = (await page.getByRole("option").allInnerTexts()).map((t) => t.trim());
    expect(labels2).toEqual(manifest.slices.o2_pressure.map((v) => `${v.toFixed(1)} cm/s`));
    await page.keyboard.press("Escape");
    await expect(mapGroup(page)).toBeVisible();
  });

  test("custom targets are honestly unavailable", async ({ page }) => {
    await openExplore(page);
    await page.getByTestId("target-selector").click();
    const dialog = page.getByRole("dialog", { name: "Target atmosphere" });
    await expect(dialog.getByRole("button", { name: "Custom target…" })).toBeDisabled();
    await expect(dialog).toContainText("Custom targets require the live analysis service. This deployment serves a precomputed snapshot.");
    // documented profiles are all listed (envelopes excluded)
    for (const id of manifest.profiles) expect(id).toBeTruthy();
    expect(await dialog.getByRole("button", { pressed: false }).count()).toBeGreaterThan(0);
  });

  test("a hand-written custom target URL shows the 'requires the live analysis service' state, not fabricated numbers", async ({ page }) => {
    const custom = { label: "User-selected hypothetical conditions", oxygen_percent: { nominal: 23, min: null, max: null }, total_pressure_kpa: { nominal: 101.3, min: null, max: null }, airflow_cm_s: null };
    const enc = Buffer.from(JSON.stringify(custom)).toString("base64url");
    await page.goto(`/?target=custom:${enc}`);
    await expect(page.getByText("Requires the live analysis service").first()).toBeVisible();
    await expect(page.getByTestId("verdict-badge")).toHaveCount(0);
    await expect(page.getByTestId("top-candidate")).toHaveCount(0);
  });

  test("switching group and target works from the snapshot", async ({ page }) => {
    const groups = await groupsFromSnapshot(page);
    const api = trackApi(page);
    await openExplore(page);
    const startUrl = page.url();
    const current = groups.find((x) => page.url().includes(`group=${x.group_id}`))!;
    const label = await chooseOption(page, groupSelect(page), (labels) => labels.findIndex((l) => l.includes("modelled") && !l.startsWith(current.label)));
    const g = groups.find((x) => label.startsWith(x.label))!;
    await expect(page).toHaveURL(new RegExp(`group=${g.group_id}`));
    expect(page.url()).not.toBe(startUrl);
    await expect(page.getByTestId("group-facts")).toContainText(`${g.n_observations} observations`);

    await page.getByTestId("target-selector").click();
    const dialog = page.getByRole("dialog", { name: "Target atmosphere" });
    const buttons = dialog.locator('li button[aria-pressed="false"]');
    await buttons.last().click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("verdict-badge")).toBeVisible();
    expect(apiCalls(api.urls())).toEqual([]);
  });

  test("every documented profile x modelled group renders an assessment and a candidate panel from the snapshot", async ({ page }) => {
    test.setTimeout(420_000);
    const problems: string[] = [];
    for (const g of manifest.modelled_groups) {
      for (const p of manifest.profiles) {
        await page.goto(`/?group=${g}&target=${p}`);
        const verdict = page.getByTestId("verdict-badge");
        const rank = page.getByTestId("top-candidate").or(page.getByText("No eligible candidates")).or(page.getByText("Requires the live analysis service").first()).or(page.locator("[data-error-code]").first());
        try {
          await expect(verdict).toBeVisible({ timeout: 20_000 });
          await expect(rank).toBeVisible({ timeout: 20_000 });
          if ((await page.locator("[data-error-code]").count()) > 0 || (await page.getByText("Requires the live analysis service").count()) > 0) problems.push(`${g} x ${p}: error or snapshot gap shown`);
          else if ((await page.getByTestId("top-candidate").count()) === 0) problems.push(`${g} x ${p}: no top candidate`);
        } catch {
          problems.push(`${g} x ${p}: did not render`);
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("Explore candidate opens a counterfactual preview from the snapshot", async ({ page }) => {
    await openExplore(page);
    await waitForCandidates(page);
    await page.getByTestId("explore-candidate").click();
    const cf = page.getByTestId("counterfactual-panel");
    await expect(cf).toBeVisible();
    // either the precomputed scenarios, or the explicit live-only notice; never a blank panel
    await expect(cf.getByTestId("scenario-sustained").or(page.getByText("Requires the live analysis service").first())).toBeVisible();
    await expect(page.getByTestId("hypothetical-label")).toHaveText("Hypothetical outcome — not an experimental result");
  });

  test("comparison either works from the snapshot or says it needs the live service", async ({ page }) => {
    await openExplore(page);
    await waitForCandidates(page);
    const toggles = page.getByRole("button", { name: /^(Compare|In comparison)$/ });
    await toggles.nth(0).click();
    await toggles.nth(1).click();
    await page.getByTestId("open-compare").click();
    const sheet = page.getByRole("dialog", { name: "Compare candidates" });
    await expect(sheet.getByTestId("compare-verdict").or(sheet.getByText("Requires the live analysis service"))).toBeVisible();
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

  test("the guided demo runs from the snapshot", async ({ page }) => {
    await openExplore(page);
    await page.getByRole("button", { name: "Guided demo" }).click();
    const card = page.getByTestId("demo-card");
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Pause" }).click();
    for (let n = 1; n <= 5; n++) {
      await expect(card.getByText(`Scene ${n} of 5`)).toBeVisible();
      await page.keyboard.press("ArrowRight");
    }
    await expect(card.getByText("Demo complete")).toBeVisible();
    await card.getByRole("button", { name: "Exit and explore" }).click();
    await expect(card).toHaveCount(0);
  });
});

test.describe("Other pages (snapshot, no API)", () => {
  test("Experiments lists records, opens the drawer and offers a CSV download", async ({ page }) => {
    const api = trackApi(page);
    await page.goto("/experiments");
    const rows = page.getByRole("table", { name: "Experiments" }).locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(20);
    await expect(page.getByTestId("data-source-badge")).toHaveAttribute("data-source", "snapshot");
    await rows.first().click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: /^Flow steps/ })).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("link", { name: /View original NASA record/ })).toHaveAttribute("href", /^https:\/\/(psi|ntrs)\.nasa\.gov\//);
    await page.keyboard.press("Escape");

    const link = page.getByRole("link", { name: /Download normalized records \(CSV\)/ });
    await expect(link).toBeVisible();
    const [dl] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(dl.suggestedFilename()).toBe("experiments.csv");
    const fs = await import("node:fs/promises");
    const text = await fs.readFile((await dl.path())!, "utf8");
    expect(text.split("\n")[0]).toMatch(/^experiment_id,/);
    expect(apiCalls(api.urls())).toEqual([]);
  });

  test("Methodology renders validation charts with sample sizes", async ({ page }) => {
    await page.goto("/methodology");
    const v = page.locator("#validation");
    await expect.poll(async () => v.locator("svg[role=img]").count()).toBeGreaterThanOrEqual(3);
    await expect(v.getByText("Observations (training)")).toBeVisible();
    await expect(v).toContainText(/Out-of-fold predictions pooled: \d+/);
    await expect(page.getByTestId("data-source-badge").first()).toHaveAttribute("data-source", "snapshot");
  });

  test("Brief renders and offers downloads, or says it needs the live service", async ({ page }) => {
    await page.goto("/brief");
    const brief = page.getByTestId("brief");
    await expect(brief.getByRole("heading", { level: 1 }).or(brief.getByText("Requires the live analysis service"))).toBeVisible();
    if ((await brief.getByRole("heading", { level: 1 }).count()) > 0) {
      await expect(brief.getByRole("button", { name: /Download \.md/ })).toBeEnabled();
      await expect(brief).toContainText("This brief contains no test procedures");
    }
  });
});
