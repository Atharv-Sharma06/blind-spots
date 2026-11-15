import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Accessibility scan (WCAG 2.2 AA tags) using the project's baseURL. Against `next dev` use a
// localhost baseURL (127.0.0.1 blocks dev resources). Needs a live API for the data-driven views.
const PAGES = ["/", "/experiments", "/methodology", "/brief"];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page: Page, label: string) {
  const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = res.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 6).map((n) => `${n.target.join(" ")} :: ${(n.failureSummary ?? "").split("\n").slice(1, 3).join(" | ")}`),
    count: v.nodes.length,
  }));
  if (summary.length) console.log(`AXE ${label}: ${JSON.stringify(summary, null, 1)}`);
  expect(summary, `axe violations on ${label}`).toEqual([]);
}

for (const path of PAGES) {
  test(`axe: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await scan(page, path);
  });
}
