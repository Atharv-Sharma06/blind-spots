import { expect, test, type Page } from "@playwright/test";
import { openExplore } from "./helpers";

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
    await expect(page.getByRole("group", { name: "Map layers" })).toBeVisible();
    await expect(page.getByTestId("target-selector")).toBeVisible();
    await page.getByTestId("target-analysis").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("target-analysis")).toBeVisible();
    await page.getByTestId("top-candidate").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("top-candidate")).toBeVisible();
    await noHorizontalScroll(page, "explore after scroll");
  });

  test("target selector and counterfactual preview fit the narrow viewport", async ({ page }) => {
    await openExplore(page);
    await page.getByTestId("target-selector").click();
    const dialog = page.getByRole("dialog", { name: "Target atmosphere" });
    await expect(dialog).toBeVisible();
    await settled(page);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    await noHorizontalScroll(page, "target sheet open");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.getByTestId("explore-candidate").click();
    await expect(page.getByTestId("counterfactual-panel")).toBeVisible();
    await noHorizontalScroll(page, "counterfactual");
  });

  test("guided demo card stays inside the viewport", async ({ page }) => {
    await openExplore(page);
    await page.getByRole("button", { name: "Guided demo" }).click();
    const card = page.getByTestId("demo-card");
    await expect(card).toBeVisible();
    await settled(page);
    const box = await card.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    expect(box!.y + box!.height).toBeLessThanOrEqual(845);
    await noHorizontalScroll(page, "demo");
  });

  for (const path of ["/experiments", "/methodology", "/brief"]) {
    test(`${path} has no horizontal page scroll`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main, article").first()).toBeVisible();
      await noHorizontalScroll(page, path);
    });
  }

  test("experiment drawer fits the narrow viewport", async ({ page }) => {
    await page.goto("/experiments");
    const row = page.getByRole("table", { name: "Experiments" }).locator("tbody tr").first();
    await expect(row).toBeVisible();
    await row.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: /^Flow steps/ })).toBeVisible();
    await settled(page);
    const box = await drawer.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    await noHorizontalScroll(page, "drawer");
  });
});
