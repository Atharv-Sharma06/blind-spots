// Render the deck to PDF (1920x1080 per page) headless, plus PNG previews of each slide.
// Run from apps/web: node ../../submission/slides/build/render.js
const { chromium } = require('/Users/atharvsharma/Desktop/moon-app/apps/web/node_modules/playwright');
const path = require('path');
const dir = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.join(dir, 'blind-spots-slides.html'), { waitUntil: 'load' });
  await page.evaluate(() => Promise.all(Array.from(document.images).map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
  const broken = await page.evaluate(() => Array.from(document.images).filter(i => !i.naturalWidth).map(i => i.src));
  if (broken.length) { console.error('broken images', broken); process.exitCode = 1; }
  const overflow = await page.evaluate(() => Array.from(document.querySelectorAll('.slide')).map((s, i) => {
    const r = s.getBoundingClientRect(); const bad = [];
    s.querySelectorAll('*').forEach(e => { const b = e.getBoundingClientRect(); if (b.width && (b.bottom > r.bottom - 100 && !e.closest('.footer')) ) bad.push(e.tagName + '.' + e.className + ' ' + Math.round(b.bottom - r.top)); });
    return { slide: i + 1, bad: bad.slice(0, 5) };
  }));
  console.log(JSON.stringify(overflow));
  await page.pdf({ path: path.join(dir, 'blind-spots-slides.pdf'), width: '1920px', height: '1080px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  if (process.env.PREVIEW) {
    const n = await page.locator('.slide').count();
    for (let i = 0; i < n; i++) await page.locator('.slide').nth(i).screenshot({ path: path.join(process.env.PREVIEW, `slide-${i + 1}.png`) });
  }
  await browser.close();
})();
