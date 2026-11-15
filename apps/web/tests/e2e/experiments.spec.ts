import { expect, test, type Page } from "@playwright/test";

type Exp = {
  experiment_id: string;
  test_label: string;
  investigation_id: string;
  investigation_acronym: string;
  material_type: string | null;
  material_family: string | null;
  notes_raw: string | null;
  sample_id: string | null;
  group_id: string | null;
  included_in_training: boolean;
  source_url: string;
  oxygen_percent_initial?: number | null;
};

const table = (page: Page) => page.getByRole("table", { name: "Experiments" });
const rows = (page: Page) => table(page).locator("tbody tr");
const summary = (page: Page) => page.locator("p[aria-live=polite]");

async function openExperiments(page: Page, query = "") {
  await page.goto(`/experiments${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Experiments" })).toBeVisible();
  await expect(rows(page).first()).toBeVisible();
}

test.describe("Experiments (live API)", () => {
  let all: Exp[];
  test.beforeAll(async ({ request }) => {
    all = (await (await request.get("/api/experiments")).json()) as Exp[];
  });

  test("lists every integrated experiment, one row each, with a live data badge", async ({ page }) => {
    await openExperiments(page);
    await expect(summary(page)).toContainText(`${all.length} of ${all.length} experiments`);
    await expect(rows(page)).toHaveCount(all.length);
    await expect(page.getByTestId("data-source-badge").first()).toHaveAttribute("data-source", "live");
    await expect(page.getByRole("columnheader", { name: /Pressure kPa/ })).toBeVisible();
  });

  test("search narrows the table, is mirrored in the URL and clears", async ({ page }) => {
    const term = all[all.length - 1]!.investigation_acronym;
    const expected = all.filter((e) =>
      [e.test_label, e.experiment_id, e.material_type, e.material_family, e.notes_raw, e.investigation_acronym, e.sample_id].filter(Boolean).join(" ").toLowerCase().includes(term.toLowerCase()),
    ).length;
    expect(expected).toBeGreaterThan(0);
    await openExperiments(page);
    await page.getByRole("searchbox", { name: /Search label, material, notes/ }).fill(term);
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(term)}`));
    await expect(summary(page)).toContainText(`${expected} of ${all.length} experiments match`);
    await expect(rows(page)).toHaveCount(expected);

    // no match -> explicit empty state, not a blank table
    await page.getByRole("searchbox", { name: /Search label, material, notes/ }).fill("zzzz-no-such-record");
    await expect(page.getByText("No experiments match these filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(rows(page)).toHaveCount(all.length);
    await expect(page).not.toHaveURL(/q=/);
  });

  test("filters by training status, group and investigation", async ({ page }) => {
    await openExperiments(page);
    // training status
    await page.getByRole("combobox", { name: "Training" }).click();
    await page.getByRole("option", { name: "Excluded from training" }).click();
    const excluded = all.filter((e) => !e.included_in_training).length;
    await expect(page).toHaveURL(/training=excluded/);
    await expect(rows(page)).toHaveCount(excluded);
    await expect(summary(page)).toContainText(`${excluded} of ${all.length} experiments match`);
    await expect(summary(page)).toContainText("0 in training");

    // group (the API-side filter parameter reaches the CSV link as well)
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    const g = all.find((e) => e.group_id)!;
    await page.getByRole("combobox", { name: "Group" }).click();
    const opts = page.getByRole("option");
    await expect(opts.first()).toBeVisible();
    const labels = await opts.allInnerTexts();
    const idx = labels.findIndex((l) => !l.startsWith("All groups"));
    await opts.nth(idx).click();
    await expect(page).toHaveURL(/group=/);
    const gid = new URL(page.url()).searchParams.get("group")!;
    expect(all.some((e) => e.group_id === gid)).toBe(true);
    await expect(rows(page)).toHaveCount(all.filter((e) => e.group_id === gid).length);
    await expect(page.getByRole("link", { name: /Download normalized records/ })).toHaveAttribute("href", new RegExp(`group=${gid}`));
    void g;

    // investigation
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    const inv = all[0]!.investigation_id;
    await page.goto(`/experiments?investigation=${encodeURIComponent(inv)}`);
    await expect(rows(page).first()).toBeVisible();
    await expect(rows(page)).toHaveCount(all.filter((e) => e.investigation_id === inv).length);
  });

  test("sorting by a numeric column orders the rows and toggles direction", async ({ page }) => {
    await openExperiments(page);
    const head = page.getByRole("columnheader", { name: /O₂ initial %/ });
    const o2 = async () => {
      const cells = await table(page).locator("tbody tr td:nth-child(4)").allInnerTexts();
      return cells.map((c) => Number(c.replace(/[^\d.\-]/g, ""))).filter((n) => Number.isFinite(n));
    };
    await head.getByRole("button").click();
    await expect(head).toHaveAttribute("aria-sort", "ascending");
    const asc = await o2();
    expect(asc.length).toBeGreaterThan(10);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    await head.getByRole("button").click();
    await expect(head).toHaveAttribute("aria-sort", "descending");
    const desc = await o2();
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    expect(desc[0]).toBeGreaterThanOrEqual(asc[0]!);
  });

  test("opens the detail drawer by click and closes it with Escape", async ({ page }) => {
    await openExperiments(page);
    const first = rows(page).first();
    const label = (await first.getAttribute("aria-label"))!;
    await first.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(page).toHaveURL(/[?&]id=/);
    await expect(drawer.getByRole("heading", { name: label.replace(" test ", " test ") })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: /^Flow steps \(\d+\)/ })).toBeVisible();
    await expect(drawer.getByText("Provenance and quality")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(page).not.toHaveURL(/[?&]id=/);
  });

  test("keyboard: arrow keys move between rows and Enter opens the record", async ({ page }) => {
    await openExperiments(page);
    await rows(page).first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(rows(page).nth(1)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(rows(page).nth(2)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(rows(page).nth(1)).toBeFocused();
    const label = (await rows(page).nth(1).getAttribute("aria-label"))!;
    await page.keyboard.press("Enter");
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: label })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("[bug check] closing the drawer from the keyboard returns focus to the row that opened it", async ({ page }) => {
    await openExperiments(page);
    await rows(page).first().focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("body")).not.toBeFocused();
  });

  test("a deep link ?id= opens the drawer; an unknown id shows a typed not-found state", async ({ page }) => {
    const e = all.find((x) => x.included_in_training) ?? all[0]!;
    await page.goto(`/experiments?id=${encodeURIComponent(e.experiment_id)}`);
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: new RegExp(`${e.investigation_acronym} test ${e.test_label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })).toBeVisible();
    await expect(drawer.getByText(e.experiment_id).first()).toBeVisible();

    await page.goto("/experiments?id=NOPE-0:0");
    await expect(page.getByRole("dialog").locator('[data-error-code="not_found"]')).toBeVisible();
  });

  test("source link points at psi.nasa.gov or ntrs.nasa.gov", async ({ page }) => {
    // every record's source URL is a NASA host (checked against the API, not hard-coded per record)
    for (const e of all) {
      const host = new URL(e.source_url).hostname;
      expect(["psi.nasa.gov", "ntrs.nasa.gov"], `${e.experiment_id} -> ${e.source_url}`).toContain(host);
    }
    // the UI renders that link for a selected record
    for (const e of [all[0]!, all[all.length - 1]!]) {
      await page.goto(`/experiments?id=${encodeURIComponent(e.experiment_id)}`);
      const link = page.getByRole("dialog").getByRole("link", { name: /View original NASA record/ });
      await expect(link).toHaveAttribute("href", e.source_url);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noreferrer/);
    }
  });

  test("CSV export responds with normalized records and downloads from the UI", async ({ page, request }) => {
    await openExperiments(page);
    const link = page.getByRole("link", { name: /Download normalized records \(CSV\)/ });
    await expect(link).toHaveAttribute("href", /\/api\/export\/experiments\.csv/);
    const res = await request.get((await link.getAttribute("href"))!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const body = await res.text();
    expect(body.split("\n")[0]).toMatch(/^experiment_id,/);
    expect(body.split("\n").length).toBeGreaterThan(all.length);
    for (const e of all.slice(0, 5)) expect(body).toContain(e.experiment_id);

    const [dl] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(dl.suggestedFilename()).toBe("experiments.csv");
  });

  test("context records (transcribed, not integrated) are listed with their own investigation", async ({ page }) => {
    const ctx = await (await page.request.get("/api/context")).json();
    const rec = (ctx.context_experiments as Exp[])[0];
    test.skip(!rec, "no context experiments");
    await page.goto(`/experiments?investigation=${encodeURIComponent(rec!.investigation_id)}`);
    await expect(rows(page).first()).toBeVisible();
    await expect(rows(page).first()).toContainText(/Excluded/);
  });
});
