// The professions' pamphlets (src/sectors.js): one A4 page each, a PDF to
// print and a PNG to send on WhatsApp. The phone on it is the profession's
// short at its moment (the question answered), taken from the film itself,
// and the QR code goes to asklocker.com (tools/qr.mjs).
//
//   node tools/pamphlets.mjs                        every profession
//   node tools/pamphlets.mjs --sectors lawyers      some of them
// -> out/pamphlets/asklocker-<sector>-pamphlet-a4.pdf   A4, for print
//    out/pamphlets/asklocker-<sector>-pamphlet.png      1240x1754, for sending
//
// Needs Chromium (Playwright); CHROMIUM=/path/to/chrome uses that browser.

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SECTORS, PAMPHLET, pamphletUrl } from '../src/sectors.js';
import { icon } from '../src/icons.js';
import { qrSvg } from './qr.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'out', 'pamphlets');
const MARK = join(ROOT, '..', '..', 'assets', 'expo.icon', 'Assets', 'asklocker-mark.svg');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const keys = opt('sectors', Object.keys(SECTORS).join(',')).split(',');
for (const k of keys) if (!SECTORS[k]) throw new Error(`No sector "${k}": one of ${Object.keys(SECTORS).join(', ')}`);

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
const watch = (page) => {
  page.on('pageerror', (err) => console.error('[page error]', err.message));
  page.on('response', (r) => { if (r.status() === 404 && !r.url().endsWith('/favicon.ico')) console.error('[404]', r.url()); });
};

/** The phone from the profession's short, at its moment, on nothing. */
async function phoneStill(key) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
  watch(page);
  await page.goto(`${origin}/src/intro.html?film=features&feature=sector-${key}&orientation=portrait`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
  await page.evaluate(() => window.__seek(window.__hero));
  await page.addStyleTag({ content: `
    html, body, #viewport, #stage { background: transparent !important; }
    #stage > :not(#phone) { visibility: hidden !important; }
    .shell { box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.14), inset 0 0 0 6px #0a0b0d !important; }` });
  const file = join(OUT, `phone-${key}.png`);
  await (await page.$('#phone')).screenshot({ path: file, omitBackground: true });
  await page.close();
  return `/out/pamphlets/phone-${key}.png`;
}

const emph = (s) => s.replace(/\*([^*]+)\*/g, '<span class="em">$1</span>').replace(/~/g, '&nbsp;');
const esc = (s) => s.replace(/&(?!nbsp;)/g, '&amp;');

function pageHtml(key, S, phone, mark) {
  const P = S.pamphlet;
  const tick = icon('check', 15, '#0F5C57', 3);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>AskLocker ${esc(S.badge.toLowerCase())}</title>
<link rel="stylesheet" href="/fonts/fonts.css">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 210mm; height: 297mm; background: #fff; }
  body { font-family: 'Roboto', sans-serif; color: #1f2937; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; }
  .top { position: absolute; left: 0; top: 0; right: 0; height: 330px; padding: 40px 48px 0;
    background: radial-gradient(120% 140% at 100% 0%, #1A7A72 0%, #0F5C57 55%, #0B4844 100%); color: #fff; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .tile { width: 46px; height: 46px; border-radius: 12px; background: linear-gradient(160deg, #3a5288, #2A3D66); display: grid; place-items: center;
    box-shadow: 0 6px 16px rgba(0,0,0,0.25); }
  .tile img { width: 34px; height: 34px; }
  .word { font: 700 27px/1 'Bricolage Grotesque', sans-serif; letter-spacing: -0.01em; }
  .badge { margin-left: 6px; display: inline-flex; align-items: center; gap: 7px; padding: 6px 13px 6px 11px; border-radius: 999px;
    background: #B7791F; font: 600 14px/1 'Roboto', sans-serif; }
  h1 { margin-top: 30px; width: 430px; font: 700 41px/1.06 'Bricolage Grotesque', sans-serif; letter-spacing: -0.02em; }
  h1 .em { font-family: 'Instrument Serif', serif; font-style: italic; font-weight: 400; color: #F3C77B; letter-spacing: 0; }
  .sub { margin-top: 14px; width: 420px; font-size: 15px; line-height: 1.5; color: rgba(255,255,255,0.86); }
  .phone { position: absolute; right: 44px; top: 58px; width: 246px; filter: drop-shadow(0 22px 28px rgba(9,17,38,0.35)); }
  .phone img { width: 100%; display: block; }
  .mid { position: absolute; left: 48px; top: 362px; width: 440px; }
  h2 { font: 600 12px/1 'Bricolage Grotesque', sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: #0F5C57; margin-bottom: 12px; }
  .q { display: block; width: fit-content; max-width: 400px; margin-bottom: 8px; padding: 9px 14px; border-radius: 16px 16px 4px 16px;
    background: #2A3D66; color: #fff; font-size: 14px; line-height: 1.35; }
  .q:nth-child(odd) { margin-left: 0; }
  .keeps { position: absolute; left: 48px; right: 48px; top: 596px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 18px; }
  .k { display: flex; align-items: center; gap: 8px; font-size: 14px; line-height: 1.3; }
  .k svg { flex: none; }
  .steps { position: absolute; left: 48px; right: 48px; top: 704px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .step { padding: 16px 16px 15px; border-radius: 14px; background: #F3F8F7; border: 1px solid #DCEBE8; }
  .step .n { display: flex; align-items: center; gap: 9px; font: 700 16px/1.1 'Bricolage Grotesque', sans-serif; color: #0B3B38; }
  .step .ic { width: 30px; height: 30px; border-radius: 9px; background: #0F5C57; display: grid; place-items: center; flex: none; }
  .step p { margin-top: 8px; font-size: 12.5px; line-height: 1.45; color: #4b5563; }
  .also { position: absolute; left: 48px; right: 48px; top: 852px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 22px; }
  .a { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; }
  .star { color: #B7791F; font-weight: 700; }
  .bottom { position: absolute; left: 0; right: 0; bottom: 0; height: 158px; padding: 22px 48px 0; background: #E7F4F2;
    display: flex; justify-content: space-between; }
  .cta { font: 700 24px/1.1 'Bricolage Grotesque', sans-serif; color: #0B3B38; }
  .cta b { color: #0F5C57; }
  .plans { margin-top: 7px; font-size: 14px; color: #0F5C57; font-weight: 500; }
  .priv { margin-top: 12px; width: 470px; font-size: 11.5px; line-height: 1.45; color: #4b5563; }
  .qr { text-align: center; }
  .qr .code { width: 108px; height: 108px; padding: 0; background: #fff; border-radius: 10px; overflow: hidden; }
  .qr .code svg { width: 108px; height: 108px; display: block; }
  .qr span { display: block; margin-top: 6px; font-size: 11px; font-weight: 500; color: #0F5C57; }
  .fine { position: absolute; left: 48px; right: 48px; bottom: 10px; font-size: 9.5px; color: #6b7280; }
</style></head><body><div class="page">
  <header class="top">
    <div class="brand"><div class="tile"><img src="${mark}" alt=""></div><span class="word">AskLocker</span>
      <span class="badge">${icon('briefcase', 15, '#fff', 2.4)}${esc(S.badge)}</span></div>
    <h1>${emph(esc(S.head))}</h1>
    <p class="sub">${esc(P.sub)}</p>
  </header>
  <div class="phone"><img src="${phone}" alt=""></div>
  <section class="mid">
    <h2>Ask in plain words</h2>
    ${P.asks.map((q) => `<span class="q">${esc(q)}</span>`).join('')}
  </section>
  <section class="keeps"><h2>Keep it all in one place</h2>
    <div class="grid">${P.keeps.map((k) => `<div class="k">${tick}<span>${esc(k)}</span></div>`).join('')}</div></section>
  <section class="steps">${PAMPHLET.steps.map(([ic, t, l], i) => `<div class="step">
    <div class="n"><span class="ic">${icon(ic, 16, '#fff', 2.4)}</span><span>${i + 1}. ${esc(t)}</span></div><p>${esc(l)}</p></div>`).join('')}</section>
  <section class="also">${PAMPHLET.also.map(([ic, t, plus]) => `<div class="a">${icon(ic, 15, '#0F5C57', 2.4)}<span>${esc(t)}${plus ? ' <span class="star">★</span>' : ''}</span></div>`).join('')}</section>
  <footer class="bottom">
    <div>
      <div class="cta">Start your business vault at <b>${PAMPHLET.url}</b></div>
      <div class="plans">${esc(PAMPHLET.plans)} · <span class="star">★</span> on a paid plan</div>
      <p class="priv">${esc(PAMPHLET.privacy)} What happens to your documents, in plain words: asklocker.com/privacy</p>
    </div>
    <div class="qr"><div class="code">${qrSvg(pamphletUrl(key), { color: '#0B3B38' })}</div><span>Scan to start</span></div>
  </footer>
  <div class="fine">The screen shows a fictional business. Questions: support@asklocker.com</div>
</div></body></html>`;
}

const markSvg = await readFile(MARK, 'utf8');
await writeFile(join(OUT, 'mark.svg'), markSvg);
for (const key of keys) {
  const S = SECTORS[key];
  const phone = await phoneStill(key);
  await writeFile(join(OUT, `${key}.html`), pageHtml(key, S, phone, '/out/pamphlets/mark.svg'));
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1240 / 794 });
  watch(page);
  await page.goto(`${origin}/out/pamphlets/${key}.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  const pdf = join(OUT, `asklocker-${key}-pamphlet-a4.pdf`);
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  const png = join(OUT, `asklocker-${key}-pamphlet.png`);
  await page.screenshot({ path: png, clip: { x: 0, y: 0, width: 794, height: 1123 } });
  await page.close();
  console.log(`${pdf}\n${png}`);
}

await browser.close();
server.close();
