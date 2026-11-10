// node shoot.mjs <outDir> [routeFilter,...] [--langs=ar,en] [--themes=light,dark]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [outDir, filter] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = Object.fromEntries(process.argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const BASE = opt.base || 'http://localhost:8091';
const ROUTES = {
  home: '/', assistant: '/assistant', glasses: '/glasses', session: '/session?mode=ask', live: '/live',
  find: '/find', qibla: '/qibla', helper: '/helper', 'help-view': '/help-view', contacts: '/contacts',
  tools: '/tools', senses: '/senses', plugins: '/plugins', account: '/account', pharmacy: '/pharmacy',
  history: '/history', welcome: '/?welcome=1',
};
const langs = (opt.langs || 'ar,en').split(',');
const themes = (opt.themes || 'light,dark').split(',');
const pick = filter ? filter.split(',') : Object.keys(ROUTES);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
for (const theme of themes) {
  const ctx = await browser.newContext({ viewport: { width: Number(opt.w || 390), height: Number(opt.h || 844) }, deviceScaleFactor: 2, colorScheme: theme, isMobile: true, hasTouch: true, permissions: ['camera', 'microphone', 'geolocation'], geolocation: { latitude: 23.588, longitude: 58.3829 } });
  for (const lang of langs) {
    const one = async (name) => {
      const page = await ctx.newPage();
      const r = ROUTES[name];
      const url = BASE + r + (r.includes('?') ? '&' : '?') + 'lang=' + lang;
      const errs = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(Number(opt.wait || 3500));
      await page.addStyleTag({ content: '[data-testid="logbox"],#error-overlay{display:none!important}' }).catch(() => {});
      const file = `${outDir}/${name}.${lang}.${theme}.jpg`;
      await page.screenshot({ path: file, type: 'jpeg', quality: 72, fullPage: opt.full === '1' });
      console.log(file, errs.length ? 'ERR: ' + errs.slice(0, 2).join(' | ').slice(0, 200) : '');
      await page.close();
    };
    for (let i = 0; i < pick.length; i += 4) await Promise.all(pick.slice(i, i + 4).map(one));
  }
  await ctx.close();
}
await browser.close();
