// Headless screenshots of the snapshot-mode site (what judges get) for the backup slide deck.
// Run from apps/web: node ../../submission/slides/build/shoot.js [outdir]
const { chromium } = require('/Users/atharvsharma/Desktop/moon-app/apps/web/node_modules/playwright');
const path = require('path');
const out = process.argv[2] || path.join(__dirname, '..', 'img');
const BASE = process.env.BASE || 'http://localhost:3709';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#answer');
  await page.waitForTimeout(3000);
  // Hide the Next.js dev-mode indicator (not part of the product).
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  const box = async (sel) => { const b = await page.locator(sel).first().boundingBox(); const y = await page.evaluate(() => window.scrollY); return { ...b, y: b.y + y }; };
  // 1. Cabins page: hero + both rows of cabin cards (page top to end of step 1).
  const cab = await box('#cabins');
  await page.addStyleTag({ content: 'header{visibility:hidden!important}' });
  const hero = await box('main h1');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(out, '1-cabins.png'), fullPage: true, clip: { x: cab.x - 36, y: Math.max(0, hero.y - 40), width: cab.width + 72, height: Math.ceil(cab.y + cab.height + 24 - Math.max(0, hero.y - 40)) } });
  // 2. Answer: verdict + chart (answer top to chart bottom).
  const ans = await box('#answer'); const ch = await box('#chart');
  await page.screenshot({ path: path.join(out, '2-answer-chart.png'), fullPage: true, clip: { x: ans.x - 8, y: ans.y - 8, width: ans.width + 16, height: Math.ceil(ch.y + ch.height - ans.y + 24) } });
  // 3. What to test next (+ what would we learn).
  const nx = await box('#next'); const wi = await box('#what-if');
  await page.screenshot({ path: path.join(out, '3-next-tests.png'), fullPage: true, clip: { x: nx.x - 8, y: nx.y - 8, width: nx.width + 16, height: Math.ceil(wi.y + wi.height - nx.y + 24) } });
  const text = {};
  for (const id of ['cabins', 'answer', 'next']) text[id] = await page.locator('#' + id).first().innerText();
  const notCovered = (text.cabins.match(/^Not covered$/gm) || []).length;
  const rec = { at: new Date().toString(), base: BASE, viewport: '1600x900@2x', notCoveredCards: notCovered, text };
  require('fs').writeFileSync(path.join(__dirname, 'shots.json'), JSON.stringify(rec, null, 1));
  console.log(rec.at, 'notCovered cards:', notCovered);
  await browser.close();
})();
