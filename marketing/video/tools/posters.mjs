// The feature posters: one still per feature and size, taken at the moment
// src/features.js names (window.__hero), when the phone shows the feature and
// the callout is in.
//
//   node tools/posters.mjs                         every feature at 1920x1080 and 1080x1080
//   node tools/posters.mjs --features ask,share    some of them
//   node tools/posters.mjs --sizes 1080x1080       one size
//   options: --scale 2 (pixels per point: a 2x PNG for print or retina)
//            --at 4.5 (seconds, instead of each feature's own moment)
// -> out/posters/asklocker-<feature>-<width>x<height>.png
//
// Needs Chromium (Playwright); CHROMIUM=/path/to/chrome uses that browser.

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'out', 'posters');
const ALL = ['ask', 'read', 'voice', 'reminders', 'tree', 'emergency', 'share', 'vaults', 'fingerprint',
  'biz-capture', 'biz-ask', 'biz-overview', 'biz-reminders', 'biz-team', 'biz-share', 'biz-access', 'biz-sheets'];

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const features = opt('features', ALL.join(',')).split(',');
const sizes = opt('sizes', '1920x1080,1080x1080').split(',').map((s) => {
  const m = /^(\d+)x(\d+)$/.exec(s);
  if (!m) throw new Error(`--sizes takes WIDTHxHEIGHT, not ${s}`);
  return { name: s, width: Number(m[1]), height: Number(m[2]) };
});
const scale = Number(opt('scale', 1));
const at = opt('at', null);
for (const f of features) if (!ALL.includes(f)) throw new Error(`No feature "${f}": one of ${ALL.join(', ')}`);

// ─── Static server: module scripts do not load from file:// ───────────────
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
};
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = resolve(join(ROOT, path));
    if (!file.startsWith(ROOT)) throw new Error('outside root');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb', '--hide-scrollbars'],
});
await mkdir(OUT, { recursive: true });

for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: scale });
  page.on('pageerror', (err) => console.error('[page error]', err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') console.error('[console]', msg.text()); });
  page.on('response', (res) => { if (res.status() === 404 && !res.url().endsWith('/favicon.ico')) console.error('[404]', res.url()); });
  const cdp = await page.context().newCDPSession(page);
  for (const feature of features) {
    await page.goto(`${origin}/src/intro.html?film=features&feature=${feature}&size=${size.name}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
    const t = at !== null ? Number(at) : await page.evaluate(() => window.__hero);
    await page.evaluate((time) => window.__seek(time), t);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = join(OUT, `asklocker-${feature}-${size.name}${scale !== 1 ? `@${scale}x` : ''}.png`);
    await writeFile(file, Buffer.from(data, 'base64'));
    console.log(`${file}  (${t.toFixed(2)}s)`);
  }
  await page.close();
}

await browser.close();
server.close();
