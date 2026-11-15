import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_CABIN, EXPLORE_H1, HOME_H1 } from "./helpers";

/**
 * The Cabins page ("/"): three numbered steps on one page. Shared by home.spec.ts (live API) and
 * snapshot.home.spec.ts (precomputed snapshot, no API). Nothing here hard-codes a count or a probability;
 * expectations are read from the page itself, plus the API when one is running.
 */
const VERDICT = {
  supported: /^Covered: ISS flame tests ran in air like this\.$/,
  extrapolation: /^Partly covered: only part of this air has nearby ISS tests\.$/,
  insufficient_evidence: /^Blind spot: /,
} as const;
const CHIP = /Not covered|Barely covered|Covered/;
const FRAMING = "Computational research candidates requiring qualified scientific review, established safety procedures and formal feasibility assessment.";

const cabinCard = (page: Page, id: string) => page.locator(`[data-cabin="${id}"]`);
const noHorizontalScroll = async (page: Page, where: string) => {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, `${where}: scrollWidth ${sw} > clientWidth ${cw}`).toBeLessThanOrEqual(cw + 1);
};

async function openHome(page: Page, query = "") {
  await page.goto(`/${query}`);
  await expect(page.getByRole("heading", { level: 1, name: HOME_H1 })).toBeVisible();
  await expect(page.locator("#cabins")).toBeVisible();
  await expect(page.getByTestId("answer-verdict")).not.toHaveAttribute("data-verdict", "loading", { timeout: 30_000 });
}

export function homeSuite(mode: "live" | "snapshot") {
  test.describe(`Cabins page (${mode})`, () => {
    test("hero, three numbered steps and the default cabin", async ({ page }) => {
      await openHome(page);
      await expect(page.getByRole("heading", { level: 2, name: /Pick a cabin/ })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: /The answer/ })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: /What to test next/ })).toBeVisible();
      await expect(page.getByTestId("home-tour-start")).toBeVisible();
      await expect(cabinCard(page, DEFAULT_CABIN)).toHaveAttribute("aria-checked", "true");
      await expect(page.getByTestId("data-source-badge").first()).toHaveAttribute("data-source", mode);
    });

    test("every cabin card shows its air and a status chip; two labelled rows, no envelope profiles", async ({ page }) => {
      await openHome(page);
      await expect(page.getByText("Today and next", { exact: false }).first()).toBeVisible();
      await expect(page.getByText("Past spacecraft", { exact: false }).first()).toBeVisible();
      const cards = page.locator("[data-cabin]");
      expect(await cards.count()).toBeGreaterThanOrEqual(9);
      for (const card of await cards.all()) {
        await expect(card).toContainText(/\d+(\.\d+)?\s?% oxygen/);
        await expect(card).toContainText(/kPa/);
        await expect(card).toContainText(CHIP);
      }
      await expect(cards.filter({ hasText: "Not covered" }).first()).toBeVisible(); // the blind spot is the story
    });

    test("picking a cabin updates the answer and the URL without a page reload", async ({ page }) => {
      await openHome(page);
      await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
      const other = page.locator("[data-cabin]").filter({ hasNot: page.locator('[aria-checked="true"]') });
      const target = other.nth(0);
      const id = (await target.getAttribute("data-cabin"))!;
      await target.click();
      await expect(page).toHaveURL(new RegExp(`[?&]cabin=${id}`));
      await expect(cabinCard(page, id)).toHaveAttribute("aria-checked", "true");
      await expect(cabinCard(page, DEFAULT_CABIN)).toHaveAttribute("aria-checked", "false");
      expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
      await expect(page.getByTestId("answer-verdict")).not.toHaveAttribute("data-verdict", "loading", { timeout: 30_000 });
      await expect(page.getByTestId("answer-verdict")).toBeVisible();
    });

    test("?cabin= selects that cabin and the answer gives a verdict in words, with the chart", async ({ page }) => {
      await openHome(page, `?cabin=${DEFAULT_CABIN}`);
      const verdict = page.getByTestId("answer-verdict");
      const kind = (await verdict.getAttribute("data-verdict")) as keyof typeof VERDICT;
      expect(Object.keys(VERDICT)).toContain(kind);
      await expect(page.getByTestId("verdict-title")).toHaveText(VERDICT[kind]);
      const chart = page.getByTestId("simple-chart").getByRole("img");
      await expect(chart).toBeVisible();
      expect(((await chart.getAttribute("aria-label")) ?? "").length).toBeGreaterThan(20);
      await expect(page.getByText("Show as table")).toBeVisible();
      await expect(page.getByTestId("material-picker")).toBeVisible();
      if (kind === "insufficient_evidence") await expect(page.getByTestId("answer-card")).not.toContainText(/P\(sustained\)|probability/i); // D2
    });

    test("step 3 lists the next tests, the what-if, the framing sentence and a link into the Explorer", async ({ page }) => {
      await openHome(page);
      const next = page.locator("#next");
      await next.scrollIntoViewIfNeeded();
      await expect(next).toContainText(FRAMING);
      const first = page.getByTestId("next-test-1");
      await expect(first).toBeVisible();
      await expect(first).toContainText(/% oxygen|% O/i);
      await expect(first).toContainText(/kPa/);
      await expect(page.locator("#what-if")).toContainText("Hypothetical model updates, not experimental results.");
      await expect(page.locator("#what-if")).toContainText("What would we learn?");
      const link = page.getByTestId("open-explorer");
      await expect(link).toContainText("Open this cabin in the Explorer");
      await expect(link).toHaveAttribute("href", new RegExp(`^/explore\\?(.*&)?target=${DEFAULT_CABIN}(&|$)`));
      await expect(link).toHaveAttribute("href", /group=/);
      await link.click();
      await expect(page).toHaveURL(/\/explore\?/);
      await expect(page.getByRole("heading", { level: 1, name: EXPLORE_H1 })).toBeVisible();
    });

    test("plain words: none of the expert terms or raw codes appear on the default page", async ({ page }) => {
      await openHome(page);
      await page.waitForLoadState("networkidle");
      const text = await page.locator("main").innerText();
      for (const banned of [/\blatent\b/i, /\bLaplace\b/i, /\bEVR\b/, /reference distance/i, /\bstationarity\b/i, /\bhull\b/i, /\bslice\b/i, /\banalysis group\b/i]) {
        expect(text, `banned term ${banned}`).not.toMatch(banned);
      }
      expect(text, "raw snake_case identifier on the page").not.toMatch(/\b[a-z0-9]+(?:_[a-z0-9]+){1,}\b/);
    });

    test("the footer keeps the disclaimers", async ({ page }) => {
      await openHome(page);
      await expect(page.getByRole("contentinfo")).toContainText("Not endorsed by NASA");
      await expect(page.getByRole("contentinfo")).toContainText("Not a certified fire-safety assessment");
    });

    test("old Explorer links redirect to /explore with the same query string; Cabins params stay", async ({ page }) => {
      for (const qs of ["?group=pmma_thin_film__opposed&target=iss_cabin_nominal&plane=o2_pressure", "?target=exploration_atmosphere_8p2_34", "?plane=o2_pressure"]) {
        await page.goto(`/${qs}`);
        await expect(page.getByRole("heading", { level: 1, name: EXPLORE_H1 })).toBeVisible();
        await expect(page).toHaveURL(/\/explore\?/);
        // the Explorer may add its own defaults to the query; every original parameter must survive the redirect
        const got = new URL(page.url()).searchParams;
        for (const [k, v] of new URLSearchParams(qs.slice(1))) expect(got.get(k), `${k} after redirect`).toBe(v);
      }
      await page.goto(`/?cabin=iss_cabin_nominal&material=pmma_thin_film__opposed`);
      await expect(page.getByRole("heading", { level: 1, name: HOME_H1 })).toBeVisible();
      await expect(page).toHaveURL(/^[^?]*\/\?cabin=iss_cabin_nominal/);
    });

    test("phone: no horizontal scroll at 390 and 320 px; cards and buttons are at least 40 px tall", async ({ page }) => {
      for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        await openHome(page);
        await noHorizontalScroll(page, `home ${width}`);
        await page.locator("#next").scrollIntoViewIfNeeded();
        await noHorizontalScroll(page, `home ${width} scrolled`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await openHome(page);
      for (const card of (await page.locator("[data-cabin]").all()).slice(0, 4)) {
        expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(40);
      }
      expect((await page.getByTestId("home-tour-start").boundingBox())!.height).toBeGreaterThanOrEqual(40);
    });
  });
}
