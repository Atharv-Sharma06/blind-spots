import { expect, test } from "@playwright/test";
import { EXPLORE_H1 } from "./helpers";

const PAGES = [
  { path: "/", nav: "Explore", heading: EXPLORE_H1 },
  { path: "/experiments", nav: "Experiments", heading: "Experiments" },
  { path: "/methodology", nav: "Methodology", heading: "Methodology" },
] as const;

test.describe("App shell", () => {
  test("each page renders its heading", async ({ page }) => {
    for (const p of PAGES) {
      await page.goto(p.path);
      await expect(page.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
    }
  });

  test("primary navigation works and marks the active page", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const p of [PAGES[1], PAGES[2], PAGES[0]]) {
      await nav.getByRole("link", { name: p.nav }).click();
      await expect(page).toHaveURL(new RegExp(p.path === "/" ? "/(\\?.*)?$" : `${p.path}$`));
      await expect(page.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
      await expect(nav.getByRole("link", { name: p.nav })).toHaveAttribute("aria-current", "page");
    }
  });

  test("footer carries the disclaimer and the data credit on every page", async ({ page }) => {
    for (const p of PAGES) {
      await page.goto(p.path);
      const footer = page.getByRole("contentinfo");
      await expect(footer).toContainText("Computational research-planning tool. Not a certified fire-safety assessment. Not endorsed by NASA.");
      await expect(footer).toContainText("Data: NASA Physical Sciences Informatics (CC0)");
    }
  });

  test("unknown routes show the not-found state", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeAttached();
    await expect(page.getByText("Not found", { exact: true })).toBeVisible();
  });

  test("a hydrated page logs no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    for (const p of PAGES) {
      await page.goto(p.path);
      await page.waitForLoadState("networkidle");
    }
    expect(errors).toEqual([]);
  });
});
