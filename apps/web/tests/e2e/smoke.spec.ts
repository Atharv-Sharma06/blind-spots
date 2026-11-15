import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/", nav: "Explore", heading: "Experimental coverage" },
  { path: "/experiments", nav: "Experiments", heading: "Experiments" },
  { path: "/methodology", nav: "Methodology", heading: "Methodology" },
] as const;

test("each page renders its heading", async ({ page }) => {
  for (const p of PAGES) {
    await page.goto(p.path);
    await expect(page.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
  }
});

test("explore shows the subheading, map region and both analysis panels", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Explore what NASA has measured — and what remains uncertain.")).toBeVisible();
  await expect(page.getByTestId("map-region")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Target analysis" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next research candidate" })).toBeVisible();
});

test("primary navigation works and marks the active page", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  for (const p of [PAGES[1], PAGES[2], PAGES[0]]) {
    await nav.getByRole("link", { name: p.nav }).click();
    await expect(page).toHaveURL(new RegExp(`${p.path === "/" ? "/$" : p.path + "$"}`));
    await expect(page.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
    await expect(nav.getByRole("link", { name: p.nav })).toHaveAttribute("aria-current", "page");
  }
});

test("footer carries the disclaimer and data credit", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText("Computational research-planning tool. Not a certified fire-safety assessment. Not endorsed by NASA.");
  await expect(footer).toContainText("Data: NASA Physical Sciences Informatics (CC0)");
});

test("unknown routes show the not-found state", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeAttached();
  await expect(page.getByText("Not found", { exact: true })).toBeVisible();
});

test("with the API down the version chip reports unavailable and panels do not fake data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("version-chip")).toContainText(/unavailable/i);
  await expect(page.getByTestId("version-chip")).toHaveAttribute("data-state", "unavailable");
  await expect(page.getByText("Analysis service unavailable").first()).toBeVisible();
});

test("with a healthy API the chip shows dataset and model versions", async ({ page }) => {
  // fixture_health: test-only stand-in for GET /api/health; never imported by app code.
  const fixture_health = { status: "ok", dataset_version: "0123456789ab", model_version: "fedcba987654", artifacts: {} };
  await page.route("**/api/health", (route) => route.fulfill({ json: fixture_health }));
  await page.goto("/");
  const chip = page.getByTestId("version-chip");
  await expect(chip).toHaveAttribute("data-state", "ok");
  await expect(chip).toContainText("0123456789ab");
});

test("a typed error envelope from the API maps to its code", async ({ page }) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({ status: 503, json: { error: { code: "artifact_missing", message: "model artifact not found" } } }),
  );
  await page.goto("/");
  await expect(page.getByTestId("version-chip")).toHaveAttribute("data-state", "unavailable");
  await expect(page.locator('[data-error-code="artifact_missing"]').first()).toBeVisible();
});
