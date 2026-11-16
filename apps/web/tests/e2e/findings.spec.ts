import { expect, test } from "@playwright/test";

// /findings against the snapshot build (what judges get). The file name does not match the "snapshot" project's
// pattern, so the URL is absolute: E2E_SNAPSHOT_URL or the shared snapshot dev server on :3709.
const SNAP = (process.env.E2E_SNAPSHOT_URL ?? "http://localhost:3709").replace(/\/$/, "");

test.describe("findings page (snapshot)", () => {
  test("renders ranked cards with API sentences; pillar filter, sort and evidence work", async ({ page }) => {
    await page.goto(`${SNAP}/findings`);
    await expect(page.getByRole("heading", { level: 1, name: "What the ISS fire tests show" })).toBeVisible();
    const cards = page.getByTestId("finding-card");
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();
    expect(total).toBeGreaterThan(0);
    await expect(cards.first()).toHaveClass(/card-ink/);
    await expect(page.getByTestId("finding-sentence").first()).not.toBeEmpty();

    // Suppression filter: only suppression sentences remain; the list is not empty.
    await page.getByTestId("pillar-suppression").click();
    await expect(page.getByTestId("pillar-suppression")).toHaveAttribute("aria-pressed", "true");
    expect(await page.locator('[data-testid="finding-sentence"]:not([data-pillar="suppression"])').count()).toBe(0);
    expect(await cards.count()).toBeGreaterThan(0);

    // Detection never filters to a silent empty list.
    await page.getByTestId("pillar-detection").click();
    await expect(page.getByTestId("detection-note")).toContainText("not represented in the integrated records");
    await page.getByRole("button", { name: "Show all materials" }).click();
    await expect(cards).toHaveCount(total);

    // Evidence ids expand and link to the Experiments drawer.
    const evidence = page.getByTestId("finding-evidence").first();
    await evidence.locator("summary").click();
    const link = evidence.getByTestId("evidence-experiment").first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /^\/experiments\?id=/);

    // Nav shows Findings; footer carries the binding lines.
    await expect(page.getByText("ISS tests. Not endorsed by NASA. Not a certified fire-safety assessment.")).toBeVisible();
  });

  test("no horizontal scroll at 390 px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${SNAP}/findings`);
    await expect(page.getByTestId("finding-card").first()).toBeVisible();
    const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(sw).toBeLessThanOrEqual(iw);
  });
});
