import { expect, test } from "@playwright/test";
import { EXPLORE_H1 } from "./helpers";

test.describe("How it works (live API)", () => {
  test("renders the plain steps, then every detailed section and the validation charts with sample sizes", async ({ page }) => {
    await page.goto("/methodology");
    await expect(page.getByRole("heading", { level: 1, name: "How it works" })).toBeVisible();
    for (const h of ["The four steps", "Can you trust it?"]) await expect(page.getByRole("heading", { level: 2, name: new RegExp(h) })).toBeVisible();
    await expect(page.getByTestId("data-source-badge").first()).toHaveAttribute("data-source", "live");
    await page.getByRole("button", { name: "Open all sections" }).click();
    for (const h of ["Data", "Modelling", "Active learning", "Validation", "Reproducibility", "Sources and context", "Limitations"]) {
      await expect(page.getByRole("heading", { level: 2, name: new RegExp(h) })).toBeVisible();
    }
    const v = page.locator("#validation");
    await expect.poll(async () => v.locator("svg[role=img]").count()).toBeGreaterThanOrEqual(3);
    for (const svg of await v.locator("svg[role=img]").all()) await expect(svg).toHaveAttribute("aria-label", /.+/);
    await expect(v).toContainText(/Out-of-fold predictions pooled: \d+/);
    await expect(v.getByRole("table").first()).toContainText("Majority-class guess");
  });

  test("table of contents links jump to their sections and the limitations anchor works", async ({ page }) => {
    await page.goto("/methodology#limitations");
    await expect(page.locator("#limitations")).toBeInViewport();
    await page.goto("/methodology");
    await page.getByRole("link", { name: /Validation/ }).first().click();
    await expect(page).toHaveURL(/#validation/);
    await expect(page.locator("#validation")).toBeInViewport();
  });

  test("states the science caveats that qualify every metric", async ({ page }) => {
    await page.goto("/methodology");
    await page.getByRole("button", { name: "Open all sections" }).click();
    const main = page.locator("main");
    await expect(main).toContainText(/flow-turned-off/i);
    await expect(main).toContainText(/length scale/i);
    await expect(main).toContainText(/constant/i);
    await expect(main).toContainText(/majority[- ]class/i);
  });
});

test.describe("Research brief (live API)", () => {
  test("renders the sections, the disclaimer and offers Markdown and PDF downloads", async ({ page }) => {
    await page.goto("/brief");
    const brief = page.getByTestId("brief");
    await expect(brief.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(brief).toContainText("Computational research-planning output");
    await expect(brief).toContainText("This brief contains no test procedures");
    await expect(brief.getByRole("heading", { level: 2, name: /^1\. Target atmosphere/ })).toBeVisible();
    await expect(brief.getByRole("heading", { level: 2, name: /Limitations/ })).toBeVisible();
    await expect(brief.getByRole("heading", { level: 2, name: /Citations/ })).toBeVisible();
    await expect(brief.getByText("Dataset", { exact: true })).toBeVisible();

    const md = brief.getByRole("button", { name: /Download \.md/ });
    const pdf = brief.getByRole("button", { name: /Print \/ Save as PDF/ });
    await expect(md).toBeEnabled();
    await expect(pdf).toBeEnabled();
    const [dl] = await Promise.all([page.waitForEvent("download"), md.click()]);
    expect(dl.suggestedFilename()).toMatch(/^blind-spots-brief-.+\.md$/);
    const path = await dl.path();
    const fs = await import("node:fs/promises");
    const text = await fs.readFile(path, "utf8");
    expect(text.length).toBeGreaterThan(500);
    expect(text).toMatch(/Research brief|Target atmosphere/i);
  });

  test("is reachable from Explore with the selected group and target carried over", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByTestId("target-analysis")).toBeVisible();
    const group = new URL(page.url()).searchParams.get("group");
    await page.getByTestId("brief-link").click();
    await expect(page).toHaveURL(/\/brief\?/);
    if (group) await expect(page).toHaveURL(new RegExp(`group=${group}`));
    await expect(page.getByTestId("brief").getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("link", { name: /Back to Explorer/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: EXPLORE_H1 })).toBeVisible();
  });
});
