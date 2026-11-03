// Draws site/media/og-card.jpg, the 1200 × 630 card a link to asklocker.com
// shows on WhatsApp, LinkedIn, X and in search (og:image). Run it again after
// changing the headline (content.mjs) or the colours:
//
//   node site/tools/og-card.mjs
//
// Needs Playwright's Chromium (preinstalled in Claude's cloud sessions; else
// `npx playwright install chromium`). The build only copies the JPEG.

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

// The onboarding's look: its navy gradient, the icon, the title in white.
const [first, rest] = [hero.title.split(', ')[0], hero.title.split(', ').slice(1).join(', ')];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#fff;
background:linear-gradient(180deg,#2A3D66,#4A6491);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
svg{border-radius:28px;box-shadow:0 0 0 2px rgba(255,255,255,.25)}
h1{font-size:56px;line-height:66px;font-weight:600;margin-top:36px}
p{font-size:28px;line-height:36px;color:rgba(255,255,255,.9);margin-top:16px}
small{display:block;font-size:22px;color:rgba(255,255,255,.7);margin-top:28px}
</style></head><body>
${logo(120)}
<h1>${first},<br>${rest}</h1>
<p>${hero.lead}</p>
<small>asklocker.com</small>
</body></html>`;

const chromium = await loadChromium();
const browser = await chromium.launch();
const pageObj = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await pageObj.setContent(html);
const target = fileURLToPath(new URL('../media/og-card.jpg', import.meta.url));
await pageObj.screenshot({ path: target, type: 'jpeg', quality: 88 });
await browser.close();
console.log(`[site] Wrote ${target}`);
