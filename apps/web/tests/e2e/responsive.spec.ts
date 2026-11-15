import { expect, test, type Page } from "@playwright/test";
import { HOME_H1, openExplore } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

/** Wait for open/close transitions so bounding boxes are final (sheets slide in from the right). */
const settled = async (page: Page) => {
  // only finite transitions of dialogs/sheets; the demo progress bar and skeleton pulses are decorative
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => (a.effect?.getComputedTiming().iterations ?? 1) !== Infinity && (a.effect?.getComputedTiming().duration as number) < 1000)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
};

const noHorizontalScroll = async (page: Page, where: string) => {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, `${where}: scrollWidth ${sw} > clientWidth ${cw}`).toBeLessThanOrEqual(cw + 1);
};

test.describe("Responsive smoke at 390x844", () => {
  test("Explore has no horizontal scroll and keeps map, controls and panels reachable", async ({ page }) => {
    await openExplore(page);
    await noHorizontalScroll(page, "explore");
    await expect(page.getByTestId("layer-observations")).toBeVisible();
    await expect(page.getByTestId("target-selector")).toBeVisible();
    await page.getByTestId("target-analysis").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("target-analysis")).toBeVisible();
    await page.getByTestId("top-candidate").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("top-candidate")).toBeVisible();
    await noHorizontalScroll(page, "explore after scroll");
  });

  test("counterfactual preview fits the narrow viewport", async ({ page }) => {
    await openExplore(page);
    await page.getByTestId("explore-candidate").click();
    await expect(page.getByTestId("counterfactual-panel")).toBeVisible();
    await noHorizontalScroll(page, "counterfactual");
  });

  test("Cabins page: no horizontal scroll, two-column cabin cards, answer and next steps reachable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: HOME_H1 })).toBeVisible();
    await expect(page.getByTestId("answer-verdict")).not.toHaveAttribute("data-verdict", "loading", { timeout: 30_000 });
    await noHorizontalScroll(page, "cabins");
    for (const id of ["answer", "chart", "next", "what-if"]) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await noHorizontalScroll(page, "cabins after scroll");
    // two cards per row on a phone
    const xs = new Set((await page.locator("[data-cabin]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))));
    expect(xs.size).toBe(2);
  });

  test("30-second tour card stays inside the viewport", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("home-tour-start").click();
    const card = page.getByTestId("home-tour-card");
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Start" }).click();
    await expect(card).toHaveAttribute("data-tour-state", "scene-1");
    await settled(page);
    const box = await card.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    expect(box!.y + box!.height).toBeLessThanOrEqual(845);
    await noHorizontalScroll(page, "tour");
  });

  for (const path of ["/experiments", "/methodology", "/brief"]) {
    test(`${path} has no horizontal page scroll`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main, article").first()).toBeVisible();
      await noHorizontalScroll(page, path);
    });
  }
});
