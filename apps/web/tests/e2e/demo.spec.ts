import { expect, test, type Page } from "@playwright/test";
import { contextEnvelopes, contextPoints, layerChip, openExplore } from "./helpers";

type Group = { group_id: string; model_status: string; is_default?: boolean; pressure_kpa_range: [number, number] | null };
type Profile = { profile_id: string; kind: string; total_pressure_kpa: { nominal: number | null; max: number | null; min: number | null } };

const card = (page: Page) => page.getByTestId("demo-card");
const sceneLabel = (page: Page, n: number) => card(page).getByText(`Scene ${n} of 5`);

async function pauseDemo(page: Page) {
  // autoplay would race the assertions; the Pause button is part of the feature under test
  await card(page).getByRole("button", { name: "Pause" }).click();
  await expect(card(page).getByRole("button", { name: "Play" })).toHaveAttribute("aria-pressed", "true");
}

test.describe("Guided demo (live API)", () => {
  test("advances through five scenes, reaches the end card and exits into normal exploration", async ({ page }) => {
    await openExplore(page);
    await page.getByRole("button", { name: "Guided demo" }).click();
    await expect(card(page)).toBeVisible();
    await expect(sceneLabel(page, 1)).toBeVisible();
    await pauseDemo(page);

    const titles: string[] = [];
    for (let n = 1; n <= 5; n++) {
      await expect(sceneLabel(page, n)).toBeVisible();
      titles.push((await card(page).getByRole("heading", { level: 2 }).innerText()).trim());
      await expect(card(page).getByRole("heading", { level: 2 })).not.toBeEmpty();
      if (n < 5) await card(page).getByRole("button", { name: "Next" }).click();
    }
    expect(new Set(titles).size).toBe(5); // five distinct captions, none repeated
    await card(page).getByRole("button", { name: "Next" }).click();
    await expect(card(page).getByText("Demo complete")).toBeVisible();
    await expect(card(page).getByRole("link", { name: /Research brief/ })).toHaveAttribute("href", /^\/brief\?/);
    await expect(card(page).getByRole("button", { name: "Replay" })).toBeVisible();

    await card(page).getByRole("button", { name: "Exit and explore" }).click();
    await expect(card(page)).toHaveCount(0);
    // everything stays inspectable with the normal controls
    await expect(page.getByTestId("target-analysis")).toBeVisible();
    await expect(page.getByTestId("map-region")).toBeVisible();
  });

  test("Back, Replay, arrow keys and Escape work", async ({ page }) => {
    await openExplore(page);
    await page.getByRole("button", { name: "Guided demo" }).click();
    await pauseDemo(page);
    await page.keyboard.press("ArrowRight");
    await expect(sceneLabel(page, 2)).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(sceneLabel(page, 3)).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(sceneLabel(page, 2)).toBeVisible();
    await card(page).getByRole("button", { name: "Back" }).click();
    await expect(sceneLabel(page, 1)).toBeVisible();
    await expect(card(page).getByRole("button", { name: "Back" })).toBeDisabled();
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    await expect(card(page).getByText("Demo complete")).toBeVisible();
    await card(page).getByRole("button", { name: "Replay" }).click();
    await expect(sceneLabel(page, 1)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card(page)).toHaveCount(0);
  });

  test("?demo=1 starts the demo automatically and exiting drops the parameter", async ({ page }) => {
    await page.goto("/?demo=1");
    await expect(card(page)).toBeVisible();
    await expect(sceneLabel(page, 1)).toBeVisible();
    await card(page).getByRole("button", { name: "Exit" }).click();
    await expect(card(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/demo=1/);
  });

  test("autoplay advances without interaction", async ({ page }) => {
    await openExplore(page);
    await page.getByRole("button", { name: "Guided demo" }).click();
    await expect(sceneLabel(page, 1)).toBeVisible();
    // scene length is a UI constant of a few seconds; wait for the first automatic step
    await expect(sceneLabel(page, 2)).toBeVisible({ timeout: 30_000 });
  });

  test("when the target pressure is outside the group's observed range, scenes 2-5 use the O2 x pressure plane with the context layer on from scene 3", async ({ page, request }) => {
    const groups = (await (await request.get("/api/groups")).json()) as Group[];
    const def = groups.find((g) => g.is_default) ?? groups.find((g) => g.model_status === "modeled")!;
    const { profiles } = (await (await request.get("/api/targets")).json()) as { profiles: Profile[] };
    const [lo, hi] = def.pressure_kpa_range ?? [0, 0];

    await openExplore(page);
    await page.getByRole("button", { name: "Guided demo" }).click();
    await pauseDemo(page);
    await page.keyboard.press("ArrowRight"); // scene 2: the demo chooses its target
    await expect(sceneLabel(page, 2)).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("target")).not.toBeNull();
    const targetId = new URL(page.url()).searchParams.get("target")!;
    const prof = profiles.find((p) => p.profile_id === targetId);
    expect(prof, "demo target must be a documented profile").toBeTruthy();
    const p = prof!.total_pressure_kpa.nominal ?? prof!.total_pressure_kpa.max ?? prof!.total_pressure_kpa.min;
    test.skip(p === null || (p >= lo - 1 && p <= hi + 1), "demo target is inside the observed pressure range for this group");

    for (let scene = 2; scene <= 5; scene++) {
      if (scene > 2) await page.keyboard.press("ArrowRight");
      await expect(sceneLabel(page, scene)).toBeVisible();
      expect.soft(page.url(), `scene ${scene} must use the o2_pressure plane (the pressure gap is only visible there)`).toMatch(/plane=o2_pressure/);
      if (scene >= 3) {
        // documented tests near reduced pressure / elevated O2 stay on the map, captioned as not integrated
        await expect.soft(layerChip(page, "context"), `context layer on in scene ${scene}`).toHaveAttribute("aria-pressed", "true", { timeout: 3000 });
        await expect.soft.poll(async () => (await contextEnvelopes(page).count()) + (await contextPoints(page).count()), { message: `context marks in scene ${scene}`, timeout: 3000 }).toBeGreaterThan(0);
      }
    }
  });
});
