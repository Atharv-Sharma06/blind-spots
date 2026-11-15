import { expect, test, type Page } from "@playwright/test";
import { HOME_H1 } from "./helpers";

/** The 30-second tour of the Cabins page ("/"): a title card, five scenes (Next / Back), an end card. */
const card = (page: Page) => page.getByTestId("home-tour-card");
const start = (page: Page) => page.getByTestId("home-tour-start");
const sceneLabel = (page: Page, n: number) => card(page).getByText(new RegExp(`^${n} of 5 · `));

async function openTour(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: HOME_H1 })).toBeVisible();
  await expect(start(page)).toHaveText(/30-second tour/);
  await start(page).click();
  await expect(card(page)).toHaveAttribute("data-tour-state", "title");
}

/** autoplay would race the assertions: step off the title card, then pause. */
async function pauseOnScene1(page: Page) {
  await card(page).getByRole("button", { name: "Start" }).click();
  await expect(sceneLabel(page, 1)).toBeVisible();
  await card(page).getByRole("button", { name: "Pause" }).click();
  await expect(card(page).getByRole("button", { name: "Play" })).toHaveAttribute("aria-pressed", "true");
}

test.describe("30-second tour on the Cabins page", () => {
  test("title card, five scenes with distinct captions, end card, then Exit leaves a normal page", async ({ page }) => {
    await openTour(page);
    await pauseOnScene1(page);
    const captions: string[] = [];
    for (let n = 1; n <= 5; n++) {
      await expect(sceneLabel(page, n)).toBeVisible();
      const cap = card(page).getByTestId("home-tour-caption");
      await expect(cap).not.toBeEmpty();
      captions.push((await cap.innerText()).trim());
      if (n < 5) await card(page).getByRole("button", { name: "Next" }).click();
    }
    expect(new Set(captions).size).toBe(5);
    await card(page).getByRole("button", { name: "Next" }).click();
    await expect(card(page)).toHaveAttribute("data-tour-state", "end");
    await expect(card(page).getByRole("heading", { level: 2, name: "Blind Spots" })).toBeVisible();
    await expect(card(page).getByRole("button", { name: "Replay" })).toBeVisible();
    await expect(card(page)).toContainText("Not endorsed by NASA");
    await card(page).getByRole("button", { name: "Close the tour" }).click();
    await expect(card(page)).toHaveCount(0);
    // the page underneath is intact and still interactive
    await expect(page.locator("#cabins")).toBeVisible();
    await expect(page.locator("#answer")).toBeVisible();
  });

  test("Back, Replay, arrow keys and Escape work", async ({ page }) => {
    await openTour(page);
    await pauseOnScene1(page);
    await page.keyboard.press("ArrowRight");
    await expect(sceneLabel(page, 2)).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(sceneLabel(page, 3)).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(sceneLabel(page, 2)).toBeVisible();
    await card(page).getByRole("button", { name: "Back" }).click();
    await expect(sceneLabel(page, 1)).toBeVisible();
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    await expect(card(page)).toHaveAttribute("data-tour-state", "end");
    await card(page).getByRole("button", { name: "Replay" }).click();
    await expect(card(page)).toHaveAttribute("data-tour-state", "title");
    await page.keyboard.press("ArrowRight");
    await expect(sceneLabel(page, 1)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card(page)).toHaveCount(0);
  });

  test("?demo=1 starts the tour automatically and exiting drops the parameter", async ({ page }) => {
    await page.goto("/?demo=1");
    await expect(card(page)).toBeVisible();
    await expect(sceneLabel(page, 1)).toBeVisible({ timeout: 10_000 });
    await card(page).getByRole("button", { name: "Exit the tour" }).click();
    await expect(card(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/demo=1/);
  });

  test("?demo=1 plays on its own to the end card within 31 s (30-second tour)", async ({ page }) => {
    test.setTimeout(75_000);
    await page.goto("/?demo=1");
    await expect(card(page)).toBeVisible();
    const t0 = Date.now();
    await expect(card(page)).toHaveAttribute("data-tour-state", "end", { timeout: 33_000 });
    expect(Date.now() - t0, "tour length").toBeLessThanOrEqual(32_000);
  });

  test("pausing keeps the scene on screen; the highlight ring and caption card stay inside the viewport", async ({ page }) => {
    await openTour(page);
    await pauseOnScene1(page);
    await expect(card(page)).toContainText("paused");
    await page.waitForTimeout(5_000); // longer than scene 1: paused means it stays
    await expect(sceneLabel(page, 1)).toBeVisible();
    const box = await card(page).boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 1);
  });
});
