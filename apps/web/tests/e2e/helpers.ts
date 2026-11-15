import { expect, type Locator, type Page } from "@playwright/test";

/** Locators and waits shared by the Explore specs. Nothing here hard-codes a group, count or metric. */

export const mapGroup = (page: Page): Locator => page.locator('[role="group"][aria-label^="Coverage map"]');
export const obsMarks = (page: Page): Locator =>
  mapGroup(page).locator('g[role="button"][aria-label*="flame sustained"], g[role="button"][aria-label*="not sustained"], g[role="button"][aria-label*="outcome not determined"]');
export const candidateMarks = (page: Page): Locator => mapGroup(page).locator('g[role="button"][aria-label^="Candidate"]');
/** Context layer marks: documented-but-not-integrated test envelopes (<title>) and point markers (triangles). */
export const contextEnvelopes = (page: Page): Locator => mapGroup(page).locator("title", { hasText: "not integrated" });
export const contextPoints = (page: Page): Locator => mapGroup(page).locator('g:has(> path[stroke-width="1.2"])');

export const layerChip = (page: Page, layer: string): Locator => page.getByTestId(`layer-${layer}`);
export const groupSelect = (page: Page): Locator => page.getByRole("combobox", { name: "Material and flame configuration" });

/** Open Explore and wait until the map, target analysis and candidate panel have real content. */
export async function openExplore(page: Page, query = ""): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Experimental coverage" })).toBeVisible();
  await expect(mapGroup(page)).toBeVisible();
  await expect(obsMarks(page).first()).toBeVisible();
  await expect(page.getByTestId("target-analysis")).toBeVisible();
  await expect(page.getByTestId("obs-note")).toBeVisible();
}

export async function waitForCandidates(page: Page): Promise<void> {
  await expect(page.getByTestId("top-candidate")).toBeVisible();
}

/** Number N from the note "N of M observations in this group are plotted". */
export async function plottedCount(page: Page): Promise<{ plotted: number; total: number }> {
  const text = (await page.getByTestId("obs-note").innerText()).replace(/,/g, "");
  const m = /(\d+) of (\d+) observations/.exec(text);
  if (!m) throw new Error(`unexpected obs-note: ${text}`);
  return { plotted: Number(m[1]), total: Number(m[2]) };
}

export async function chooseOption(page: Page, trigger: Locator, pick: (labels: string[]) => number | string): Promise<string> {
  await trigger.click();
  const options = page.getByRole("option");
  await expect(options.first()).toBeVisible();
  const labels = (await options.allInnerTexts()).map((t) => t.trim());
  const sel = pick(labels);
  const idx = typeof sel === "number" ? sel : labels.findIndex((l) => l.includes(sel));
  if (idx < 0 || idx >= labels.length) throw new Error(`no matching option in ${JSON.stringify(labels)}`);
  const label = labels[idx] as string;
  await options.nth(idx).click();
  return label;
}

/** Collect same-origin /api requests made by the page (for assertions about what the UI asked for). */
export function trackApi(page: Page): { urls: () => string[]; clear: () => void } {
  let urls: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/")) urls.push(`${r.method()} ${u.pathname}${u.search}`);
  });
  return { urls: () => urls, clear: () => (urls = []) };
}
