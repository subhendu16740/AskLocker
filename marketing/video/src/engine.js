// What both films share: the stage, the layout passes, and one paused GSAP
// timeline with the helpers every scene is written in.
//
// window.__seek(t)  draws the frame at t seconds (used by tools/render.mjs)
// window.__duration total length in seconds
// window.__cues     [{t, type, ...}] sound cues, read by audio/score.py
// window.__ready    true once fonts are loaded and the timeline is built
//
// Opened directly in a browser it plays in real time: space to pause, arrow
// keys to scrub, a number key to jump to that tenth of the film.

export const gsap = window.gsap;
gsap.registerPlugin(window.TextPlugin);

const params = new URLSearchParams(location.search);
export const PORTRAIT = params.get('orientation') === 'portrait';
// The short cut (about a minute, for Reels and Shorts) keeps the story and one
// pass through the product; each film says what it drops.
export const SHORT = params.get('cut') === 'short';
// The family film's voice scene can speak another of the app's voice languages.
export const LANG = params.get('lang') || '';
// Which film: family, nri (the family film told by a son abroad) or business;
// the feature shorts and posters (?film=features) use the family film's story.
export const FILM = ['nri', 'business'].includes(params.get('film')) ? params.get('film') : 'family';
// ?size=1080x1080 sets the stage to any size (the feature posters); without it
// the stage is 16:9 or, with ?orientation=portrait, 9:16.
const SIZE = /^(\d+)x(\d+)$/.exec(params.get('size') || '');
export const W = SIZE ? Number(SIZE[1]) : PORTRAIT ? 1080 : 1920;
export const H = SIZE ? Number(SIZE[2]) : PORTRAIT ? 1920 : 1080;

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const stage = document.getElementById('stage');

// ─── Build the stage ─────────────────────────────────────────────────────
export async function build({ cards, texts, phone, callouts, subs, look = '', fontText = '' }) {
  stage.className = `${PORTRAIT ? 'portrait' : W === H ? 'square' : 'landscape'}${look ? ` ${look}` : ''}`;
  Object.assign(stage.style, { width: `${W}px`, height: `${H}px` });
  stage.innerHTML = `
    <div id="bg-night" class="layer"></div>
    <div id="bg-day" class="layer"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="grid"></div></div>
    <div id="cards" class="layer">${cards}</div>
    <div id="texts" class="layer">${texts}</div>
    ${phone}
    <div id="callouts" class="layer">${callouts}</div>
    <div id="subs">${subs}</div>
    <div id="vignette" class="layer"></div>
    <div id="fade" class="layer"></div>`;

  const fit = () => {
    const k = Math.min(innerWidth / W, innerHeight / H);
    Object.assign(stage.style, {
      position: 'absolute', transform: `scale(${k})`,
      left: `${(innerWidth - W * k) / 2}px`, top: `${(innerHeight - H * k) / 2}px`,
    });
  };
  fit();
  addEventListener('resize', fit);

  await Promise.all([
    '700 86px "Bricolage Grotesque"', '300 190px "Bricolage Grotesque"', 'italic 400 120px "Instrument Serif"',
    '400 15px Roboto', '500 15px Roboto', '700 15px Roboto', 'italic 400 12px Roboto',
    '400 15px "Noto Sans Devanagari"', '600 38px Caveat',
  ].map((f) => document.fonts.load(f)));
  // The voice languages' scripts: a subset loads only for text it covers.
  await Promise.all([
    ['Noto Sans Devanagari', 'हिन्दी मराठी'], ['Noto Sans Bengali', 'বাংলা'], ['Noto Sans Tamil', 'தமிழ்'],
    ['Noto Sans Telugu', 'తెలుగు'], ['Noto Sans Gujarati', 'ગુજરાતી'], ['Noto Sans Kannada', 'ಕನ್ನಡ'],
    ['Noto Sans Malayalam', 'മലയാളം'], ['Noto Sans Gurmukhi', 'ਪੰਜਾਬੀ'],
  ].map(([family, text]) => document.fonts.load(`600 30px "${family}"`, text)));
  // Text the phone shows in other scripts, in every weight the app's text uses.
  if (fontText) {
    const ui = getComputedStyle(document.documentElement).getPropertyValue('--ui');
    await Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(`${w} 15px ${ui}`, fontText)));
  }
  await document.fonts.ready;
}

// ─── Layout passes: what flexbox would have settled in the app ──────────

/** Ask: the chat area runs from under the header (and Search in) to above the save bar. */
export function askArea(areaSel, scrSel) {
  const scr = $(scrSel);
  const top = ['.sb-fill', '.v4-bar', '.search-in'].reduce((sum, s) => sum + ($(s, scr)?.offsetHeight ?? 0), 0);
  Object.assign($(areaSel).style, { top: `${top}px`, bottom: `${$('.ask-bottom', scr).offsetHeight + $('.tabbar', scr).offsetHeight}px` });
}

/** A long question scrolls the input sideways to keep the caret in view. */
export function inputOverflow(lineSel, text) {
  const line = $(lineSel);
  const typed = line.firstElementChild;
  const before = typed.textContent;
  typed.textContent = text;
  const over = line.offsetWidth - line.parentElement.clientWidth + 6;
  const frac = line.parentElement.clientWidth / line.offsetWidth;
  typed.textContent = before;
  return { over: Math.max(0, over), frac: Math.min(1, frac) };
}

/** Where an element is on the phone's screen, in the app's 390-wide points. Measure before anything moves. */
export function at(el) {
  if (typeof el === 'string') el = $(el);
  const s = $('#screen').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const k = 390 / s.width;
  return { x: (r.left - s.left + r.width / 2) * k, y: (r.top - s.top + r.height / 2) * k, top: (r.top - s.top) * k, h: r.height * k };
}

/** A scroll that brings what matters into view, never past the end. */
export function scrollTo(innerSel, viewSel, targetSel, margin) {
  const inner = $(innerSel);
  const max = inner.offsetHeight - $(viewSel).offsetHeight;
  const target = $(targetSel).getBoundingClientRect().top - inner.getBoundingClientRect().top;
  return Math.max(0, Math.min(max, target - margin));
}

// Chat bubbles are placed absolutely, in order, the way the ScrollView lays
// them out; scrolling to the newest one is then a tween of the stack.
export function layoutChat(areaSel, groups) {
  const area = $(areaSel);
  const slots = {};
  let y = 16;
  for (const group of groups) {
    for (const id of group) {
      const el = $(`#${id}`);
      el.style.top = `${y}px`;
      slots[id] = { top: y, h: el.offsetHeight };
    }
    y += slots[group[group.length - 1]].h + 16;
  }
  const areaH = area.offsetHeight;
  return (id) => Math.max(0, slots[id].top + slots[id].h + 8 - areaH);
}

// ─── Initial state ───────────────────────────────────────────────────────
export const place = (el, [x, y, s = 1], extra = {}) => gsap.set(el, { xPercent: -50, yPercent: -50, x, y, scale: s, ...extra });

/** What every film hides before its first frame. Each film then hides its own. */
export function initialState() {
  // Each film has only some of these; a set on nothing would make GSAP warn.
  const set = (els, vars) => { if (els.length) gsap.set(els, vars); };
  gsap.set('#bg-day', { autoAlpha: 0, clipPath: 'circle(0% at 50% 50%)' });
  gsap.set('#vignette', { autoAlpha: 1 });
  gsap.set('#fade', { autoAlpha: 1 });
  set($$('#texts > *'), { autoAlpha: 0 });
  set($$('#texts .wi'), { yPercent: 118 });
  set($$('.wh-how'), { autoAlpha: 0 });
  set($$('.trust-card, .trust-note'), { autoAlpha: 0 });
  // The brand reveal and the end card build up piece by piece: nothing in them
  // shows before its own entrance.
  set($$('#logo, #tagline, #badge, #end-logo, #end-tag, #end-badge, #end-cta, #end-note, #end-url'), { autoAlpha: 0 });
  set($$('#wordmark, #end-word'), { clipPath: 'inset(0% 100% 0% 0%)' });
  set($$('.brand .lm-bubble'), { scale: 0, transformOrigin: '17% 100%' });
  set($$('.cap-line, .subline, .callout, #wave'), { autoAlpha: 0 });
  set($$('.scr'), { autoAlpha: 0 });
  gsap.set(['#touch', '#shutter', '#hb-dark'], { autoAlpha: 0 });
  set($$('.lnotif'), { autoAlpha: 0 });
  set($$('.ln-more'), { height: 0, autoAlpha: 0 });
  set($$('.msg, #call-missed, .call-av .ring, #cam-scan, #ocr-done'), { autoAlpha: 0 });
  set($$('.drawer'), { autoAlpha: 0 });
  set($$('.drawer-dim'), { opacity: 0 });
  set($$('.drawer-panel'), { x: -330 });
}

// The film's layout (positions that differ between 16:9 and 9:16) and its
// callouts: beside the phone in 16:9; in 9:16, in the place of the scene's
// paragraph, which fades out as the callout arrives.
let L = {};
let CALLOUTS = {};
function stageTop(el) {
  let y = 0;
  for (let n = el; n && n !== stage; n = n.offsetParent) y += n.offsetTop;
  return y;
}
function bandPos(id, el, s) {
  const top = stageTop($('.sub', $(`#${id}`))) + 6;
  return [W / 2, top + (el.offsetHeight * s) / 2, s];
}
/** layout: phone positions and callout places; callouts: callout id → the layout key that places it. */
export function setLayout(layout, callouts) {
  L = layout;
  CALLOUTS = callouts;
  for (const [id, key] of Object.entries(CALLOUTS)) {
    const el = $(`#${id}`);
    if (L[key]) place(el, typeof L[key] === 'string' ? bandPos(L[key], el, L.coScale) : L[key]);
  }
}

// ─── Timeline helpers ────────────────────────────────────────────────────
export const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', duration: 0.6 } });
const cues = [];
export const cue = (t, type, extra = {}) => cues.push({ t: Math.round(t * 1000) / 1000, type, ...extra });
export const IR = { immediateRender: false };
// When each scene's paragraph has finished coming in (showHow).
const subIn = {};

export function showCallout(sel, t) {
  const d = PORTRAIT ? { y: 30 } : { x: 36 };
  const from = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, `+=${v}`]));
  const to = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, `-=${v}`]));
  let at = t;
  if (PORTRAIT) {
    // The paragraph goes once it is all there: a fade-out that overlapped its
    // fade-in would lose to it, and the paragraph would stay under the callout.
    const id = L[CALLOUTS[sel.slice(1)]];
    const out = Math.max(t - 0.1, (subIn[id] ?? 0) + 0.05);
    tl.to(`#${id} .sub`, { autoAlpha: 0, duration: 0.3, ease: 'none' }, out);
    at = Math.max(t, out + 0.1);
  }
  tl.fromTo(sel, { autoAlpha: 0, ...from }, { autoAlpha: 1, ...to, duration: 0.7, ...IR }, at);
  cue(at + 0.05, 'pop');
}
export function reveal(container, t, { stagger = 0.055, dur = 0.95 } = {}) {
  const el = typeof container === 'string' ? $(container) : container;
  tl.set(el, { autoAlpha: 1 }, t);
  tl.fromTo($$('.wi', el), { yPercent: 118 }, { yPercent: 0, duration: dur, ease: 'power4.out', stagger, ...IR }, t);
}
// A feature scene opens on why it exists: read first, bigger and centred...
function whyLift(b) {
  const why = $('.wh-why', b);
  const group = [$('.kicker', b), why];
  // In 9:16 the phone sits under the band, so only Privacy (no phone) moves.
  if (PORTRAIT && b.id !== 't-trust') return { why, group, dy: 0, s: 1 };
  const top = stageTop(group[0]);
  const bottom = stageTop(why) + why.offsetHeight;
  return { why, group, dy: Math.max(0, H / 2 - (top + bottom) / 2), s: PORTRAIT ? 1 : 1.18 };
}
export function showWhy(id, t) {
  const b = $(`#${id}`);
  const { why, group, dy, s } = whyLift(b);
  tl.set(b, { autoAlpha: 1, y: 0 }, t);
  tl.set(group, { y: dy }, t);
  tl.set(why, { scale: s, transformOrigin: '0% 0%', opacity: 1 }, t);
  tl.fromTo(group[0], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ...IR }, t);
  tl.fromTo($('.wh-tag', why), { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.45, ...IR }, t + 0.1);
  tl.fromTo($$('.wi', why), { yPercent: 118 }, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.035, ...IR }, t + 0.2);
}
// ...then how AskLocker answers it. The why moves up into its place and
// stays, quieter, above the how; in 9:16 the how takes its place instead.
export function showHow(id, t) {
  const b = $(`#${id}`);
  const { why, group, dy } = whyLift(b);
  if (PORTRAIT && !dy) tl.to(why, { autoAlpha: 0, y: -20, duration: 0.35, ease: 'power2.in' }, t - 0.05);
  else {
    tl.to(group, { y: 0, duration: 0.7, ease: 'power3.inOut' }, t - 0.4);
    tl.to(why, { scale: 1, opacity: PORTRAIT ? 0 : 0.6, duration: 0.7, ease: 'power3.inOut' }, t - 0.4);
  }
  const lag = PORTRAIT ? 0.25 : 0;
  tl.set($('.wh-how', b), { autoAlpha: 1 }, t);
  tl.fromTo($('.wh-how .wh-tag', b), { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.45, ...IR }, t + lag);
  tl.fromTo($$('.wh-how .h1 .wi', b), { yPercent: 118 }, { yPercent: 0, duration: 0.95, ease: 'power4.out', stagger: 0.06, ...IR }, t + lag + 0.1);
  const s = $('.wh-how .sub', b);
  if (s) {
    tl.fromTo(s, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.8, ...IR }, t + lag + 0.5);
    subIn[id] = t + lag + 1.3;
  }
  cue(t + lag + 0.1, 'pop-soft');
}
export const hide = (sel, t, extra = {}) => tl.to(sel, { autoAlpha: 0, y: -24, duration: 0.45, ease: 'power2.in', ...extra }, t);
export const fadeIn = (sel, t, extra = {}) => tl.fromTo(sel, { autoAlpha: 0, y: extra.from ?? 12 }, { autoAlpha: 1, y: 0, duration: 0.4, ...IR, ...extra, from: undefined }, t);
export const swap = (a, b, t, dur = 0.18) => { tl.to(a, { autoAlpha: 0, duration: dur, ease: 'none' }, t); tl.to(b, { autoAlpha: 1, duration: dur, ease: 'none' }, t); };

let z = 1;
/** The next stacking level: a screen set on top of the others. */
export const nextZ = () => ++z;
export function nav(from, to, t, how = 'push', dur = 0.45) {
  const a = $(`#${from}`);
  const b = $(`#${to}`);
  tl.set(b, { zIndex: ++z, autoAlpha: 1, xPercent: 0, yPercent: 0, scale: 1 }, t);
  if (how === 'push') {
    tl.fromTo(b, { xPercent: 100 }, { xPercent: 0, duration: dur, ease: 'power3.inOut', ...IR }, t);
    tl.to(a, { xPercent: -28, duration: dur, ease: 'power3.inOut' }, t);
  } else if (how === 'back') {
    // Back: the screen in front slides away and uncovers the one behind it.
    tl.set(a, { zIndex: ++z }, t);
    tl.fromTo(b, { xPercent: -28 }, { xPercent: 0, duration: dur, ease: 'power3.inOut', ...IR }, t);
    tl.to(a, { xPercent: 100, duration: dur, ease: 'power3.inOut' }, t);
  } else if (how === 'zoom') {
    tl.fromTo(b, { scale: 0.92, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: dur, ease: 'power2.out', ...IR }, t);
  } else {
    tl.fromTo(b, { autoAlpha: 0 }, { autoAlpha: 1, duration: dur, ease: 'power1.inOut', ...IR }, t);
  }
  tl.set(a, { autoAlpha: 0, xPercent: 0 }, t + dur);
}
// The status bar is white throughout: over the night wallpaper, the camera,
// and the theme-colour strip the web app paints. The gesture bar follows the
// bottom of the screen: dark over the app, light over the system's own screens.
export function chrome(t, mode, time) {
  const app = mode === 'app';
  tl.to('#hb-light', { autoAlpha: app ? 0 : 1, duration: 0.2, ease: 'none' }, t);
  tl.to('#hb-dark', { autoAlpha: app ? 1 : 0, duration: 0.2, ease: 'none' }, t);
  if (time) tl.set('.sb-time', { text: time }, t);
}
export function tap(t, p, { scroll = 0, press } = {}) {
  tl.set('#touch', { x: p.x, y: p.y - scroll }, t - 0.2);
  tl.fromTo('#touch', { autoAlpha: 0, scale: 1.6 }, { autoAlpha: 1, scale: 1, duration: 0.18, ease: 'power2.out', ...IR }, t - 0.2);
  tl.to('#touch', { scale: 0.8, duration: 0.08, ease: 'power1.in' }, t - 0.02);
  tl.to('#touch', { autoAlpha: 0, scale: 1.3, duration: 0.32, ease: 'power2.out' }, t + 0.08);
  if (press) {
    tl.to(press, { opacity: 0.72, duration: 0.07, ease: 'none' }, t - 0.02);
    tl.to(press, { opacity: 1, duration: 0.25, ease: 'none' }, t + 0.1);
  }
  cue(t, 'tap');
}
export function type(sel, text, t, dur, delimiter = '') {
  tl.to(sel, { text: { value: text, delimiter }, duration: dur, ease: 'none' }, t);
  cue(t, 'typing', { dur, n: delimiter ? text.split(delimiter).length : text.length });
}
export function vibrate(t) {
  tl.to('.shell', { x: 3.5, duration: 0.035, yoyo: true, repeat: 11, ease: 'sine.inOut' }, t);
  cue(t, 'buzz');
}
export function phoneTo(t, [x, y, s], dur = 0.9, extra = {}) {
  tl.to('#phone', { x, y, scale: s, duration: dur, ease: 'power3.inOut', ...extra }, t);
}
export function phoneIn(t) {
  tl.fromTo('#phone', { autoAlpha: 0, x: L.dayPhone[0] + (PORTRAIT ? 0 : 260), y: L.dayPhone[1] + (PORTRAIT ? 260 : 0), scale: L.dayPhone[2], rotation: PORTRAIT ? 0 : 6 },
    { autoAlpha: 1, x: L.dayPhone[0], y: L.dayPhone[1], rotation: 0, duration: 1.0, ...IR }, t);
  cue(t, 'whoosh-soft');
}
export function popCard(sel, t) {
  tl.fromTo(sel, { autoAlpha: 0, scale: 0.82, y: '+=46' }, { autoAlpha: 1, scale: 1, y: '-=46', duration: 0.6, ease: 'back.out(1.5)', ...IR }, t);
  cue(t, 'pop');
}
/** A notification sliding down onto the lock screen. */
export function notify(sel, t) {
  tl.fromTo(sel, { autoAlpha: 0, y: -26, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.4)', ...IR }, t);
  cue(t, 'notif');
}
// The logo's speech bubble, the "Ask" in AskLocker, pops out of the locker
// once the tile has landed.
export function bubblePop(tile, t) {
  tl.to(`${tile} .lm-bubble`, { scale: 1, duration: 0.5, ease: 'back.out(2.4)' }, t);
  cue(t, 'pop-soft');
}
export function sub(id, t0, t1) {
  tl.fromTo(`#${id}`, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.3, ...IR }, t0);
  tl.to(`#${id}`, { autoAlpha: 0, duration: 0.25, ease: 'none' }, t1);
}
/** A number on screen that changes over time, driven by the playhead so it survives seeking. */
export function count(t, dur, draw, ease = 'power1.inOut') {
  const o = { v: 0 };
  tl.fromTo(o, { v: 0 }, { v: 1, duration: dur, ease, ...IR, onUpdate: () => draw(o.v) }, t);
}

/** The drawer behind your initial (ProfileDrawer.tsx): it slides in, and out. */
export function drawer(sel, t, open) {
  if (open) {
    tl.set(sel, { autoAlpha: 1 }, t);
    tl.to(`${sel} .drawer-dim`, { opacity: 1, duration: 0.22, ease: 'power3.out' }, t);
    tl.to(`${sel} .drawer-panel`, { x: 0, duration: 0.22, ease: 'power3.out' }, t);
    cue(t, 'whoosh-soft');
  } else {
    tl.to(`${sel} .drawer-panel`, { x: -330, duration: 0.18, ease: 'power3.in' }, t);
    tl.to(`${sel} .drawer-dim`, { opacity: 0, duration: 0.18, ease: 'power3.in' }, t);
    tl.set(sel, { autoAlpha: 0 }, t + 0.2);
  }
}

// Continuous motion, driven by the playhead so it survives seeking.
export const motion = { t: 0, amp: 0 };
let bars = [];
function renderMotion() {
  const t = motion.t;
  bars.forEach((b, i) => {
    const n = Math.abs(Math.sin(t * 9.1 + i * 0.83) * 0.6 + Math.sin(t * 13.7 + i * 1.91) * 0.4);
    const env = 0.55 + 0.45 * Math.sin(Math.PI * (i + 0.5) / bars.length);
    b.style.transform = `scaleY(${0.06 + motion.amp * n * env * 0.94})`;
  });
}

// ─── The finished film ───────────────────────────────────────────────────
/** Whole-film motion, then the API the renderer and the preview use. S holds each scene's start, and total. */
export function finish(S) {
  const T = S.total;
  bars = $$('#wave i');
  // Blobs drift, spinners spin, the waveform breathes.
  tl.to(motion, { t: T, duration: T, ease: 'none' }, 0);
  tl.to($$('.spinner'), { rotation: 360 * T / 0.75, duration: T, ease: 'none' }, 0);
  tl.to('#bg-day .b1', { x: 260, y: 140, duration: T, ease: 'sine.inOut' }, 0);
  tl.to('#bg-day .b2', { x: -220, y: -160, duration: T, ease: 'sine.inOut' }, 0);
  tl.to('#bg-day .b3', { x: -180, y: 90, duration: T, ease: 'sine.inOut' }, 0);
  tl.set({}, {}, T); // pad to the full length

  cue(T, 'section', { name: 'out' });
  cues.sort((a, b) => a.t - b.t);

  window.__duration = T;
  window.__cues = cues;
  window.__scenes = S;
  // The frame a poster is taken from, when the film names one.
  window.__hero = S.hero ?? null;
  window.__seek = (t) => { tl.seek(t, false); renderMotion(); };
  window.__seek(0);
  window.__ready = true;

  if (!navigator.webdriver) {
    // Live preview: play in real time with simple keyboard controls.
    let playing = true;
    let last = performance.now();
    let now = 0;
    const loop = (ms) => {
      if (playing) now = (now + (ms - last) / 1000) % T;
      last = ms;
      window.__seek(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    addEventListener('keydown', (e) => {
      if (e.key === ' ') playing = !playing;
      if (e.key === 'ArrowRight') now = Math.min(T, now + 2);
      if (e.key === 'ArrowLeft') now = Math.max(0, now - 2);
      if (/^[0-9]$/.test(e.key)) now = (T * Number(e.key)) / 10;
    });
  }
}
