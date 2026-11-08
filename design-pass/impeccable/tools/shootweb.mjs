// node shootweb.mjs <outDir> [page,...]  — Vision website at desktop and phone widths, light/dark scheme
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [outDir, filter] = process.argv.slice(2);
const BASE = process.env.BASE || 'http://localhost:3091';
const PAGES = { landing: '/', plugins: '/plugins', pharmacy: '/pharmacy', studio: '/studio', marketplace: '/studio/marketplace', composer: '/studio/composer', senses: '/studio/senses', handover: '/studio/handover' };
const pick = filter ? filter.split(',') : Object.keys(PAGES);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const [vw, vh, tag] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: tag === 'phone' ? 2 : 1, colorScheme: scheme });
    for (const name of pick) {
      const page = await ctx.newPage();
      await page.goto(BASE + PAGES[name], { waitUntil: 'load', timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
      await page.screenshot({ path: `${outDir}/${name}.${tag}.${scheme}.jpg`, type: 'jpeg', quality: 70, fullPage: name === 'landing' && tag === 'desktop' ? false : false });
      if (name === 'landing') await page.screenshot({ path: `${outDir}/${name}.${tag}.${scheme}.full.jpg`, type: 'jpeg', quality: 60, fullPage: true });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
console.log('done');
