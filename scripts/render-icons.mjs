// Renders every AskLocker icon PNG from one drawing,
// assets/expo.icon/Assets/asklocker-mark.svg (the question lock: white, the
// keyhole a real hole). Run it again after changing that file:
//
//   node scripts/render-icons.mjs
//
// Needs Playwright's Chromium (preinstalled in Claude's cloud sessions; else
// `npx playwright install chromium`), like site/tools/og-card.mjs. The app's
// build only reads the PNGs it writes.
//
//   assets/images/icon.png                    1024, navy square, edge to edge (the stores round it)
//   assets/images/android-icon-foreground.png 1024, the mark inside Android's safe circle
//   assets/images/android-icon-background.png 1024, navy
//   assets/images/android-icon-monochrome.png 1024, the foreground in one colour (themed icons)
//   assets/images/splash-icon.png             512, the mark alone (the splash is navy behind it)
//   assets/images/favicon.png                 256, the rounded icon
//   assets/images/logo-mark.png               256, the mark alone (the login box is navy behind it)
//   public/icon-192.png, public/icon-512.png  the rounded icon (web app, Home Screen, notifications)
//   public/badge-96.png                       96, the mark alone (Android's status bar badge)

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NAVY = '#2A3D66';
// The mark's own middle (the glyph spans x 272–752, y 176–856 on the 1024 grid).
const MID = { x: 512, y: 516 };

const source = readFileSync(`${ROOT}assets/expo.icon/Assets/asklocker-mark.svg`, 'utf8');
const glyph = source
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .trim();

/** The mark at `scale` of the 1024 grid, centred, on `bg` (none: transparent) with corners `rx`. */
function svg(size, { scale = 1, bg = null, rx = 0 } = {}) {
  const tile = bg ? `<rect width="1024" height="1024" rx="${rx}" fill="${bg}"/>` : '';
  const place = `translate(512 512) scale(${scale}) translate(${-MID.x} ${-MID.y})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${tile}<g transform="${place}">${glyph}</g></svg>`;
}

const ROUNDED = { bg: NAVY, rx: 230 };
const OUTPUTS = [
  ['assets/images/icon.png', svg(1024, { bg: NAVY })],
  // Android crops the foreground to a shape inside its middle 72 of 108 dp,
  // and keeps only the middle 66 dp safe: 0.68 keeps the mark's corners in it.
  ['assets/images/android-icon-foreground.png', svg(1024, { scale: 0.68 })],
  ['assets/images/android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${NAVY}"/></svg>`],
  ['assets/images/android-icon-monochrome.png', svg(1024, { scale: 0.68 })],
  ['assets/images/splash-icon.png', svg(512, { scale: 1.12 })],
  ['assets/images/favicon.png', svg(256, ROUNDED)],
  ['assets/images/logo-mark.png', svg(256, { scale: 1.12 })],
  ['public/icon-192.png', svg(192, ROUNDED)],
  ['public/icon-512.png', svg(512, ROUNDED)],
  ['public/badge-96.png', svg(96, { scale: 1.24 })],
];

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    const require = createRequire(import.meta.url);
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(require.resolve('playwright', { paths: [globalRoot] })).chromium;
  }
}

const chromium = await loadChromium();
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [path, markup] of OUTPUTS) {
  const size = Number(markup.match(/width="(\d+)"/)[1]);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${markup}</body></html>`);
  writeFileSync(`${ROOT}${path}`, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
  console.log(`[icons] ${path} (${size}×${size})`);
}
await browser.close();
