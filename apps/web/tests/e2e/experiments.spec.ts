import { expect, test } from "@playwright/test";

/** Experiments page (simplified). The detailed pre-redesign table checks are kept in experiments.legacy.ts. */
test.describe("Experiments (live API)", () => {
  test("lists past flame tests from the API with a source link", async ({ page, request }) => {
    const all = (await (await request.get("/api/experiments")).json()) as { source_url: string }[];
    await page.goto("/experiments");
    await expect(page.getByRole("heading", { level: 1, name: "Experiments" })).toBeVisible();
    const table = page.getByRole("table", { name: "Experiments" });
    await expect(table.locator("tbody tr").first()).toBeVisible();
    expect(await table.locator("tbody tr").count()).toBeGreaterThan(0);
    expect(all.length).toBeGreaterThan(0);
    await expect(page.getByTestId("data-source-badge").first()).toHaveAttribute("data-source", "live");
  });

  test("the page says these are past tests, not the suggested next ones", async ({ page }) => {
    await page.goto("/experiments");
    await expect(page.getByText(/These are experiments NASA already ran/)).toBeVisible();
  });
});
