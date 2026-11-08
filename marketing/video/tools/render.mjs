// Renders a film in src/intro.html to MP4, one frame at a time.
//
// The composition is a paused GSAP timeline; `window.__seek(t)` draws the frame
// at time t. Seeking instead of playing makes every frame deterministic: a slow
// frame can never drop, so the video is identical on any machine.
//
//   node tools/render.mjs                   the family film, 16:9, 1920x1080 -> out/video-family-16x9.mp4
//   node tools/render.mjs --film business   the business film -> out/video-business-16x9.mp4
//   node tools/render.mjs --film nri        the family film told from abroad -> out/video-nri-16x9.mp4
//   add --portrait for 9:16 (1080x1920), --short for the ~70s cut:
//   the tag is <film>-16x9, <film>-9x16, <film>-16x9-short or <film>-9x16-short
//   --lang ta puts the family film's voice scene in that voice language
//   (src/voice-lines.js), and the tag ends -ta
//   --film features --feature ask --portrait   a feature short -> out/video-feature-ask-9x16.mp4
//   (without --portrait, the poster's layout as a 16:9 video; the posters
//   themselves are stills: tools/posters.mjs)
//   --film privacy                    what AskLocker does with documents -> out/video-privacy-16x9.mp4
//   --film privacy --reel ai --portrait   one of its reels (ai, who, where,
//   control) -> out/video-privacy-ai-9x16.mp4
//   --launch   what the films say once end-to-end encryption ships (src/claims.js);
//   the tag ends -launch. Nothing rendered with it is posted before the launch.
//   --film locked --launch   the launch's own film (src/locked.js), and --reel
//   one of its reels; --film locked-business the same film for a business
//   --film why --reel founder|family|business   why AskLocker was made (src/why.js)
//   --ui hi   the film's words in Hindi (src/i18n.js; bn, mr, ta, te, gu, kn, ml, pa
//   too, qq to test): the tag ends -in-hi, and the family film's voice scene
//   speaks it unless --lang names another
//   --strings   no video: every string the film shows, and those its --ui
//   language lacks, -> out/strings-<tag>.json
//   --narration en   a guide's voice over the full family film (tools/narration.py):
//   the tag ends -narrated. Its frames are the plain film's, so --cues-only
//   writes out/cues-<tag>.json alone, and VIDEO=out/video-family-16x9.mp4
//   tools/mux.sh family-16x9-narrated scores it over the plain film's video
//   tools/mux.sh <tag> then adds sound -> out/asklocker-<tag>.mp4
//   node tools/render.mjs --stills 3,12.5   PNGs of single frames -> out/stills/
//   (--stills hero: the frame the film names for its poster or cover)
//   options: --fps 30  --from 0 --to 20 (seconds)  --workers 3  --scale 1
//
// Needs Chromium (Playwright) and an ffmpeg with libx264: set FFMPEG=/path/to/ffmpeg
// or have `ffmpeg` on PATH. Audio is added afterwards by audio/score.py + tools/mux.sh.

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = join(ROOT, 'out');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const orientation = flag('portrait') ? 'portrait' : 'landscape';
const fps = Number(opt('fps', 30));
const scale = Number(opt('scale', 1));
const workers = Math.max(1, Number(opt('workers', 3)));
const stills = opt('stills', null);
const size = orientation === 'portrait' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
const short = flag('short');
const film = opt('film', 'family');
if (!['family', 'nri', 'business', 'features', 'privacy', 'locked', 'locked-business', 'why'].includes(film)) throw new Error(`--film is family, nri, business, features, privacy, locked, locked-business or why, not ${film}`);
// --ui: the film's words in an Indian language (src/i18n.js); the family
// film's voice scene speaks it too, unless --lang names another.
const ui = opt('ui', '');
if (ui && !['hi', 'bn', 'mr', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'qq'].includes(ui)) throw new Error(`--ui is hi, bn, mr, ta, te, gu, kn, ml, pa or qq, not ${ui}`);
const lang = opt('lang', ui && ui !== 'qq' && ['family', 'nri'].includes(film) ? ui : '');
if (lang && !['family', 'nri'].includes(film)) throw new Error('--lang is for the family and NRI films, whose voice scene it changes');
const feature = opt('feature', '');
if ((film === 'features') !== Boolean(feature)) throw new Error('--feature names one feature of --film features (src/features.js)');
const reel = opt('reel', '');
if (reel && !['privacy', 'locked', 'locked-business', 'why'].includes(film)) throw new Error('--reel is for --film privacy, locked, locked-business or why');
// --launch: what the films say once end-to-end encryption ships (src/claims.js).
// Never posted before the launch; its files end -launch.
const launch = flag('launch');
// --narration en: the narrator (src/narration.js); the page refuses any film
// but the full family film in English with today's claims.
const narration = opt('narration', '');
if (narration && narration !== 'en') throw new Error('--narration is en (tools/narration.py)');
const shape = orientation === 'portrait' ? '9x16' : '16x9';
const tag = (feature ? `feature-${feature}-${shape}`
  : `${film}${reel ? `-${reel}` : ''}-${shape}${short ? '-short' : ''}${lang && lang !== ui ? `-${lang}` : ''}`) + (ui ? `-in-${ui}` : '') + (launch ? '-launch' : '') + (narration ? '-narrated' : '');

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
const base = `http://127.0.0.1:${server.address().port}/src/intro.html?film=${film}&orientation=${orientation}${short ? '&cut=short' : ''}${lang ? `&lang=${lang}` : ''}${feature ? `&feature=${feature}` : ''}${reel ? `&reel=${reel}` : ''}${launch ? '&claims=launch' : ''}${ui ? `&ui=${ui}` : ''}${narration ? `&narration=${narration}` : ''}`;

// CHROMIUM=/path/to/chrome uses that browser instead of the one this
// Playwright version downloads (a machine with Chromium pre-installed).
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb', '--hide-scrollbars'],
});

async function openPage() {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: scale });
  let failed;
  const crashed = new Promise((_, reject) => { failed = reject; });
  page.on('pageerror', (err) => { console.error('[page error]', err.message); failed(err); });
  page.on('console', (msg) => { if (msg.type() === 'error') console.error('[console]', msg.text()); });
  await page.goto(base);
  await Promise.race([page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 }), crashed]);
  const cdp = await page.context().newCDPSession(page);
  return { page, cdp };
}

async function frame({ page, cdp }, t) {
  await page.evaluate((time) => window.__seek(time), t);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(data, 'base64');
}

const probe = await openPage();
const duration = await probe.page.evaluate(() => window.__duration);
const cues = await probe.page.evaluate(() => window.__cues);
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, `cues-${tag}.json`), JSON.stringify({ duration, fps, cues }, null, 2));

if (flag('cues-only')) {
  console.log(`${join(OUT, `cues-${tag}.json`)}: ${cues.length} cues, ${duration.toFixed(2)}s`);
  await browser.close();
  server.close();
  process.exit(0);
}

if (flag('strings')) {
  // What the film says, for its translations (src/i18n.js): every string that
  // went through t(), those the --ui language has no entry for, and any text
  // on the film's own layers that is still in Latin letters.
  const report = await probe.page.evaluate(() => {
    const latin = [];
    for (const layer of ['#texts', '#callouts', '#subs']) {
      const walk = document.createTreeWalker(document.querySelector(layer), NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const text = n.textContent.trim();
        if (/[A-Za-z]/.test(text) && !latin.includes(text)) latin.push(text);
      }
    }
    return { ui: window.__i18n.ui, seen: [...window.__i18n.seen], missing: [...window.__i18n.missing], latin };
  });
  const file = join(OUT, `strings-${tag}.json`);
  await writeFile(file, JSON.stringify(report, null, 2));
  console.log(`${file}: ${report.seen.length} strings, ${report.missing.length} missing in ${ui || 'en'}, ${report.latin.length} in Latin letters`);
  await browser.close();
  server.close();
  process.exit(0);
}

if (stills) {
  await mkdir(join(OUT, 'stills'), { recursive: true });
  // "hero" is the frame the film names for its poster or cover (window.__hero).
  const hero = await probe.page.evaluate(() => window.__hero);
  for (const s of stills.split(',').map((v) => (v === 'hero' ? hero : Number(v)))) {
    const png = await frame(probe, s);
    const name = join(OUT, 'stills', `${tag}-${s.toFixed(2).padStart(6, '0')}.png`);
    await writeFile(name, png);
    console.log(name);
  }
  await browser.close();
  server.close();
  process.exit(0);
}

const from = Number(opt('from', 0));
const to = Math.min(Number(opt('to', duration)), duration);
const first = Math.round(from * fps);
const last = Math.round(to * fps); // exclusive
const total = last - first;
console.log(`${orientation} ${size.width}x${size.height}@${fps} · frames ${first}..${last - 1} (${(total / fps).toFixed(1)}s) · ${workers} workers`);

// Each worker renders a contiguous slice into its own intermediate file; the
// slices are joined losslessly at the end.
const slices = Array.from({ length: workers }, (_, i) => {
  const a = first + Math.floor((total * i) / workers);
  const b = first + Math.floor((total * (i + 1)) / workers);
  return { i, a, b, file: join(OUT, `slice-${tag}-${i}.mp4`) };
}).filter((s) => s.b > s.a);

let done = 0;
const started = Date.now();
const progress = setInterval(() => {
  const rate = done / ((Date.now() - started) / 1000);
  process.stdout.write(`\r  ${done}/${total} frames · ${rate.toFixed(1)} fps · eta ${Math.round((total - done) / Math.max(rate, 0.01))}s   `);
}, 2000);

async function renderSlice(slice, ctx) {
  const ff = spawn(FFMPEG, [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-vf', scale !== 1 ? `scale=${size.width}:${size.height}:flags=lanczos` : 'null',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps),
    slice.file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const exited = new Promise((ok, fail) => ff.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`)))));
  for (let f = slice.a; f < slice.b; f++) {
    const png = await frame(ctx, f / fps);
    if (!ff.stdin.write(png)) await new Promise((ok) => ff.stdin.once('drain', ok));
    done++;
  }
  ff.stdin.end();
  await exited;
}

const contexts = [probe, ...(await Promise.all(slices.slice(1).map(() => openPage())))];
await Promise.all(slices.map((s, i) => renderSlice(s, contexts[i])));
clearInterval(progress);
process.stdout.write('\n');

const list = join(OUT, `slices-${tag}.txt`);
await writeFile(list, slices.map((s) => `file '${s.file}'`).join('\n'));
const video = join(OUT, `video-${tag}.mp4`);
await new Promise((ok, fail) => {
  spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', video], { stdio: 'inherit' })
    .on('close', (code) => (code === 0 ? ok() : fail(new Error(`concat exited ${code}`))));
});
await Promise.all([...slices.map((s) => rm(s.file)), rm(list)]);
console.log(`${video} · ${((Date.now() - started) / 1000).toFixed(0)}s`);

await browser.close();
server.close();
