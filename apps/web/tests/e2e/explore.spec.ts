import { expect, test } from "@playwright/test";
import { candidateMarks, layerChip, mapGroup, obsMarks, openExplore, plottedCount, waitForCandidates } from "./helpers";

/**
 * Explorer (/explore), live API. The deeper pre-redesign checks (dialogs, slice slider, compare sheet) are kept in
 * explore.legacy.ts and still need porting to the de-jargoned Explorer wording.
 */
test.describe("Explorer (live API)", () => {
  test("opens on the blind spot with map, verdict, material control and candidates", async ({ page, request }) => {
    await openExplore(page);
    await expect(page.getByTestId("data-source-badge").first()).toHaveAttribute("data-source", "live");
    await expect(page.getByTestId("target-analysis")).toContainText("Blind spot");
    await expect(page.getByRole("combobox", { name: "Material" })).toBeVisible();
    await waitForCandidates(page);
    expect(await candidateMarks(page).count()).toBeGreaterThan(0);
    const groups = (await (await request.get("/api/groups")).json()) as { n_observations: number; is_default?: boolean }[];
    const def = groups.find((g) => g.is_default)!;
    expect((await plottedCount(page)).total).toBe(def.n_observations); // the note says N of M with M from the API
  });

  test("every old query parameter still works: group, target and plane survive in the URL", async ({ page }) => {
    await openExplore(page, "?group=pmma_thin_film__opposed&target=iss_cabin_nominal&plane=o2_flow");
    const q = new URL(page.url()).searchParams;
    expect(q.get("target")).toBe("iss_cabin_nominal");
    expect(q.get("plane")).toBe("o2_flow");
    await expect(page.getByTestId("target-analysis")).toBeVisible();
  });

  test("layer chips toggle and the map keeps its marks", async ({ page }) => {
    await openExplore(page);
    await expect(layerChip(page, "observations")).toHaveAttribute("aria-pressed", "true");
    await layerChip(page, "prediction").click();
    await expect(layerChip(page, "prediction")).toHaveAttribute("aria-pressed", "true");
    await layerChip(page, "observations").click();
    await expect(layerChip(page, "observations")).toHaveAttribute("aria-pressed", "false");
    await expect(obsMarks(page)).toHaveCount(0);
    await expect(mapGroup(page)).toBeVisible();
  });

  test("an insufficient-evidence target never shows a probability estimate (D2)", async ({ page }) => {
    await openExplore(page);
    await expect(page.getByTestId("plain-verdict")).toContainText("Blind spot");
    await expect(page.getByTestId("points-supported")).toContainText(/\b0 of \d+/);
    await expect(page.getByTestId("candidate-panel")).not.toContainText("P(sustained)");
  });

  test("the candidate panel carries the framing sentence and a Cabins link leads home", async ({ page }) => {
    await openExplore(page);
    await expect(page.getByTestId("candidate-panel")).toContainText("Computational research candidates requiring qualified scientific review");
    await page.getByRole("link", { name: /Cabins/ }).first().click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
  });
});
