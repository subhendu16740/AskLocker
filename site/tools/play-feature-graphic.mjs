// Draws assets/store/feature-graphic.png, the 1024 × 500 banner Google Play
// shows at the top of AskLocker's listing (docs/google-play.md), and
// icon-512.png beside it: the app's icon as a full square, since Play rounds
// the corners itself (public/icon-512.png has its corners cut already).
// The share card's look (og-card.mjs): the onboarding's navy gradient, the
// icon, the headline in white. Play crops the edges on some screens, so
// everything sits well inside them.
//
//   node site/tools/play-feature-graphic.mjs
//
// Needs Playwright's Chromium (preinstalled in Claude's cloud sessions; else
// `npx playwright install chromium`).

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hero } from '../content.mjs';
import { logo } from '../lib/html.mjs';

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    const require = createRequire(import.meta.url);
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(require.resolve('playwright', { paths: [globalRoot] })).chromium;
  }
}

const [first, rest] = [hero.title.split(', ')[0], hero.title.split(', ').slice(1).join(', ')];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1024px;height:500px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#fff;
background:linear-gradient(180deg,#2A3D66,#4A6491);display:flex;align-items:center;justify-content:center;gap:48px;padding:0 96px}
svg{flex:none;border-radius:32px;box-shadow:0 0 0 2px rgba(255,255,255,.25)}
.name{font-size:24px;line-height:30px;font-weight:600;color:rgba(255,255,255,.8);letter-spacing:.3px}
h1{font-size:46px;line-height:56px;font-weight:600;margin-top:10px}
p{font-size:24px;line-height:32px;color:rgba(255,255,255,.9);margin-top:14px}
</style></head><body>
${logo(168)}
<div><div class="name">AskLocker</div><h1>${first},<br>${rest}</h1><p>${hero.lead}</p></div>
</body></html>`;

const dir = fileURLToPath(new URL('../../assets/store/', import.meta.url));
mkdirSync(dir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch();
const pageObj = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
await pageObj.setContent(html);
await pageObj.screenshot({ path: `${dir}feature-graphic.png`, type: 'png' });
const iconPage = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
await iconPage.setContent(`<!doctype html><html><head><style>*{margin:0}svg{display:block}</style></head><body>${logo(512).replace('rx="230"', 'rx="0"')}</body></html>`);
await iconPage.screenshot({ path: `${dir}icon-512.png`, type: 'png' });
await browser.close();
console.log(`[site] Wrote ${dir}feature-graphic.png and ${dir}icon-512.png`);
