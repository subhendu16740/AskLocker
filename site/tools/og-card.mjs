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

const [first, rest] = [hero.title.split(', ')[0], hero.title.split(', ').slice(1).join(', ')];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;font-family:-apple-system,"Segoe UI",Roboto,"Noto Sans",Arial,sans-serif;color:#fff;
background:radial-gradient(700px 420px at 100% 0%,rgba(212,128,123,.45),transparent 70%),linear-gradient(135deg,#1E2D4D 0%,#2A3D66 55%,#4A6491 100%);
display:grid;grid-template-columns:1.15fr .85fr;gap:40px;padding:64px 72px;align-items:center}
.brand{display:flex;align-items:center;gap:18px;font-size:36px;font-weight:800;letter-spacing:-.01em}
.brand svg{border-radius:18px;box-shadow:0 0 0 2px rgba(255,255,255,.25)}
h1{font-size:62px;line-height:1.08;font-weight:800;letter-spacing:-.025em;margin-top:40px}
h1 em{font-style:normal;color:#F2B8B3}
.foot{margin-top:36px;font-size:24px;color:#C9D4EA}
.card{background:#fff;color:#1F2937;border-radius:32px;padding:26px;box-shadow:0 30px 60px rgba(0,0,0,.3)}
.bar{font-weight:700;font-size:22px;padding-bottom:16px;border-bottom:1px solid #E4E8F0;color:#2A3D66}
.q{margin:20px 0 0 auto;background:#2A3D66;color:#fff;border-radius:22px 22px 6px 22px;padding:16px 18px;font-size:22px;width:fit-content;max-width:90%}
.a{margin-top:14px;background:#EEF2F9;border-radius:22px 22px 22px 6px;padding:16px 18px;font-size:22px;line-height:1.4;max-width:94%}
.chip{display:inline-block;margin-top:12px;background:#fff;border:1px solid #E4E8F0;border-radius:999px;padding:5px 14px;font-size:17px;font-weight:700;color:#4A6491}
</style></head><body>
<div><div class="brand">${logo(72)}AskLocker</div>
<h1>${first},<br><em>${rest}</em></h1>
<p class="foot">asklocker.com · Free to start</p></div>
<div class="card"><div class="bar">Ask</div>
<p class="q">${hero.demo.question}</p>
<div class="a">${hero.demo.answer}<br><span class="chip">${hero.demo.source}</span></div></div>
</body></html>`;

const chromium = await loadChromium();
const browser = await chromium.launch();
const pageObj = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await pageObj.setContent(html);
const target = fileURLToPath(new URL('../media/og-card.jpg', import.meta.url));
await pageObj.screenshot({ path: target, type: 'jpeg', quality: 88 });
await browser.close();
console.log(`[site] Wrote ${target}`);
