import { expect, test, type Page } from "@playwright/test";

/**
 * When the analysis service cannot be reached, every surface must say so explicitly or fall back openly to the
 * precomputed snapshot (CONTRACTS section 0: never fake data). Which of the two happens depends on the server's
 * NEXT_PUBLIC_DATA_MODE: "live" (the suite's own build) shows typed errors, "auto" (the shared dev server) falls back
 * to the snapshot and says so in the data-source badge. Each test asserts whichever honest outcome the server gives.
 */
async function killApi(page: Page) {
  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
}

type Outcome = "unavailable" | "snapshot";
async function outcome(page: Page): Promise<Outcome> {
  const badge = page.getByTestId("data-source-badge").first();
  await expect(badge).toHaveAttribute("data-source", /^(unavailable|snapshot)$/);
  return (await badge.getAttribute("data-source")) as Outcome;
}

const errorBox = (page: Page) => page.locator('[data-error-code="backend_unavailable"]').first();

test.describe("API down -> explicit error states or an openly labelled snapshot", () => {
  test("Cabins page never shows invented data when the service is down", async ({ page }) => {
    await killApi(page);
    await page.goto("/cabins");
    const mode = await outcome(page);
    if (mode === "unavailable") {
      await expect(errorBox(page)).toBeVisible();
      await expect(page.getByTestId("version-chip")).toHaveAttribute("data-state", "unavailable");
      await expect(page.getByRole("button", { name: "Retry" }).first()).toBeVisible();
    } else {
      await expect(page.getByTestId("data-source-badge").first()).toContainText("Precomputed data");
      await expect(page.locator('[data-cabin="exploration_atmosphere_8p2_34"]')).toBeVisible();
      await expect(page.locator("[data-error-code]")).toHaveCount(0);
    }
  });

  test("Retry on the Explorer recovers once the service is back", async ({ page }) => {
    await killApi(page);
    await page.goto("/explore");
    test.skip((await outcome(page)) === "snapshot", "this server falls back to the snapshot (auto mode), so there is nothing to retry");
    await expect(errorBox(page)).toBeVisible();
    await expect(page.getByTestId("top-candidate")).toHaveCount(0);
    await page.unroute("**/api/**");
    await page.getByRole("button", { name: "Retry" }).first().click();
    await expect(page.getByTestId("target-analysis")).toBeVisible();
  });

  test("Experiments shows the unavailable state or the snapshot rows, never an empty table", async ({ page }) => {
    await killApi(page);
    await page.goto("/experiments");
    if ((await outcome(page)) === "unavailable") {
      await expect(errorBox(page)).toBeVisible();
      await expect(page.getByRole("table", { name: "Experiments" })).toHaveCount(0);
    } else {
      expect(await page.getByRole("table", { name: "Experiments" }).locator("tbody tr").count()).toBeGreaterThan(20);
    }
    await expect(page.getByText("No experiments match these filters")).toHaveCount(0);
  });

  test("How it works shows errors for its sections or the snapshot charts, never blank charts", async ({ page }) => {
    await killApi(page);
    await page.goto("/methodology#validation");
    await expect(page.getByRole("heading", { level: 1, name: "How it works" })).toBeVisible();
    if ((await outcome(page)) === "unavailable") {
      await expect(errorBox(page)).toBeVisible();
      await expect(page.locator("#validation").locator("svg[role=img]")).toHaveCount(0);
    } else {
      await expect.poll(async () => page.locator("#validation").locator("svg[role=img]").count()).toBeGreaterThanOrEqual(3);
    }
  });

  test("Brief shows the unavailable state with downloads disabled, or the snapshot brief", async ({ page }) => {
    await killApi(page);
    await page.goto("/brief");
    if ((await outcome(page)) === "unavailable") {
      await expect(errorBox(page)).toBeVisible();
      await expect(page.getByRole("button", { name: /Download \.md/ })).toBeDisabled();
      await expect(page.getByRole("button", { name: /Print \/ Save as PDF/ })).toBeDisabled();
    } else {
      await expect(page.getByTestId("brief")).toBeVisible();
    }
  });

  test("a typed error envelope maps to its code", async ({ page }) => {
    const body = { status: 503, json: { error: { code: "artifact_missing", message: "model artifact not found" } } };
    await page.route("**/api/health", (route) => route.fulfill(body));
    await page.route("**/api/groups", (route) => route.fulfill(body));
    await page.goto("/explore");
    await expect(page.getByTestId("version-chip")).toHaveAttribute("data-state", "unavailable");
    await expect(page.locator('[data-error-code="artifact_missing"]').first()).toBeVisible();
    await expect(page.getByText("Model or dataset artifacts are missing").first()).toBeVisible();
  });

  test("a single failing panel does not take down the rest of the Explorer", async ({ page }) => {
    await page.route("**/api/candidates/rank", (route) => route.fulfill({ status: 500, json: { error: { code: "internal", message: "boom" } } }));
    await page.goto("/explore");
    await expect(page.getByTestId("target-analysis")).toBeVisible();
    await expect(page.locator('[role="group"][aria-label*="test results in view"]')).toBeVisible();
    await expect(page.getByTestId("top-candidate")).toHaveCount(0);
    await expect(page.locator('[data-error-code="internal"]').first()).toBeVisible();
  });

  test("a healthy API shows dataset and model versions in the chip", async ({ page, request }) => {
    const h = await (await request.get("/api/health")).json();
    await page.goto("/cabins");
    const chip = page.getByTestId("version-chip");
    await expect(chip).toHaveAttribute("data-state", "ok");
    await expect(chip).toContainText(h.dataset_version.slice(0, 12));
  });
});
