import { expect, test, type Page } from "@playwright/test";

/**
 * The web app runs in live data mode here, so when the analysis service cannot be reached there is no snapshot to
 * fall back to and every surface must say so explicitly (CONTRACTS section 0: never fake data).
 */
async function killApi(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

test.describe("API down -> explicit error states", () => {
  test("Explore shows a typed unavailable state with Retry, and no invented data", async ({ page }) => {
    await killApi(page);
    await page.goto("/");
    await expect(page.locator('[data-error-code="backend_unavailable"]').first()).toBeVisible();
    await expect(page.getByText("Analysis service unavailable").first()).toBeVisible();
    await expect(page.getByTestId("version-chip")).toHaveAttribute("data-state", "unavailable");
    await expect(page.getByTestId("version-chip")).toContainText(/unavailable/i);
    // nothing that looks like data
    await expect(page.locator('[role="group"][aria-label^="Coverage map"]')).toHaveCount(0);
    await expect(page.getByTestId("top-candidate")).toHaveCount(0);
    await expect(page.getByTestId("verdict-badge")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
  });

  test("Retry recovers once the service is back", async ({ page }) => {
    await killApi(page);
    await page.goto("/");
    await expect(page.locator('[data-error-code="backend_unavailable"]').first()).toBeVisible();
    await page.unroute("**/api/**");
    await page.getByRole("button", { name: "Retry" }).first().click();
    await expect(page.locator('[role="group"][aria-label^="Coverage map"]')).toBeVisible();
    await expect(page.getByTestId("target-analysis")).toBeVisible();
  });

  test("Experiments shows the unavailable state instead of an empty table", async ({ page }) => {
    await killApi(page);
    await page.goto("/experiments");
    await expect(page.locator('[data-error-code="backend_unavailable"]').first()).toBeVisible();
    await expect(page.getByRole("table", { name: "Experiments" })).toHaveCount(0);
    await expect(page.getByText("No experiments match these filters")).toHaveCount(0);
  });

  test("Methodology shows errors for its sections rather than numbers", async ({ page }) => {
    await killApi(page);
    await page.goto("/methodology");
    await expect(page.getByRole("heading", { level: 1, name: "Methodology" })).toBeVisible();
    await expect(page.locator('[data-error-code="backend_unavailable"]').first()).toBeVisible();
    await expect(page.locator("#validation").locator("svg[role=img]")).toHaveCount(0);
    await expect(page.getByTestId("data-source-badge").first()).toHaveAttribute("data-source", "unavailable");
  });

  test("Brief shows the unavailable state and keeps downloads disabled", async ({ page }) => {
    await killApi(page);
    await page.goto("/brief");
    await expect(page.locator('[data-error-code="backend_unavailable"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Download \.md/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /Print \/ Save as PDF/ })).toBeDisabled();
  });

  test("a typed error envelope maps to its code", async ({ page }) => {
    await page.route("**/api/health", (route) => route.fulfill({ status: 503, json: { error: { code: "artifact_missing", message: "model artifact not found" } } }));
    await page.route("**/api/groups", (route) => route.fulfill({ status: 503, json: { error: { code: "artifact_missing", message: "model artifact not found" } } }));
    await page.goto("/");
    await expect(page.getByTestId("version-chip")).toHaveAttribute("data-state", "unavailable");
    await expect(page.locator('[data-error-code="artifact_missing"]').first()).toBeVisible();
    await expect(page.getByText("Model or dataset artifacts are missing").first()).toBeVisible();
  });

  test("a single failing panel does not take down the rest of Explore", async ({ page }) => {
    await page.route("**/api/candidates/rank", (route) => route.fulfill({ status: 500, json: { error: { code: "internal", message: "boom" } } }));
    await page.goto("/");
    await expect(page.getByTestId("target-analysis")).toBeVisible();
    await expect(page.locator('[role="group"][aria-label^="Coverage map"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Next research candidate" })).toBeVisible();
    await expect(page.getByTestId("top-candidate")).toHaveCount(0);
    await expect(page.locator('[data-error-code="internal"]').first()).toBeVisible();
  });

  test("a healthy API shows dataset and model versions in the chip", async ({ page, request }) => {
    const h = await (await request.get("/api/health")).json();
    await page.goto("/");
    const chip = page.getByTestId("version-chip");
    await expect(chip).toHaveAttribute("data-state", "ok");
    await expect(chip).toContainText(h.dataset_version.slice(0, 12));
  });
});
