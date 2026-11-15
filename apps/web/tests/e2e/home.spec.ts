import { expect, test } from "@playwright/test";
import { homeSuite } from "./home-suite";
import { DEFAULT_CABIN } from "./helpers";

homeSuite("live");

type Headline = { profiles: { profile_id: string; comparable_observations: number; groups_with_comparable: number; n_groups: number }[] };

test.describe("Cabins page vs the live API", () => {
  test("each card's status chip follows the one rule (none, barely under 90 % of the materials, covered) from /api/headline", async ({ page, request }) => {
    const { profiles } = (await (await request.get("/api/headline")).json()) as Headline;
    await page.goto("/");
    await expect(page.locator(`[data-cabin="${DEFAULT_CABIN}"]`)).toBeVisible();
    let checked = 0;
    for (const p of profiles) {
      const card = page.locator(`[data-cabin="${p.profile_id}"]`);
      if ((await card.count()) === 0) continue; // envelope profiles are not cards
      const want = p.comparable_observations === 0 ? "Not covered" : p.groups_with_comparable / p.n_groups < 0.9 ? "Barely covered" : "Covered";
      await expect(card, p.profile_id).toContainText(want);
      if (p.comparable_observations > 0) await expect(card).toContainText(String(p.comparable_observations));
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(9);
  });
});
