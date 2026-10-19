// The business film: a formal product film. A title, the challenge (what a
// business keeps, and the dates inside it), the product in five parts, then
// five numbered chapters, each beside the phone doing it: Capture, Ask,
// Overview, Reminders, Team. Then access and control, the plans and a closing
// card. Built on src/engine.js.
//
// The short cut keeps the title, the challenge, the five parts, three chapters
// (Capture, Ask, Overview), the plans and the closing card. It drops
// Reminders, Team, and access and control.
import {
  gsap, PORTRAIT, SHORT, $, $$, build, askArea, inputOverflow, at, scrollTo, layoutChat, place, initialState,
  setLayout, tl, cue, IR, showCallout, reveal, hide, fadeIn, swap, nextZ, nav, chrome, tap, type, vibrate, phoneIn,
  notify, bubblePop, drawer, finish,
} from './engine.js';
import { phone, textBlocks, callouts, BIZ, PURCHASE, CHAPTERS } from './business-screens.js';

// ─── Layout: every position that differs between 16:9 and 9:16 ───────────
// The phone sits right of the chapter in 16:9 and under it in 9:16, where a
// callout takes the place of the chapter's points.
const L = PORTRAIT ? {
  dayPhone: [540, 1176, 0.94], coScale: 1.3,
  coBill: 'ch-capture', coOverview: 'ch-overview', coAlerts: 'ch-alerts',
} : {
  dayPhone: [1290, 560, 0.94],
  coBill: [1652, 700], coOverview: [1656, 704], coAlerts: [1656, 734],
};

await build({ cards: '', texts: textBlocks(SHORT), phone: phone(), callouts: callouts(), subs: '', look: 'formal' });

// ─── Layout passes: what flexbox would have settled in the app ──────────
askArea('#ask-area', '#scr-ask');
$('#tag-scroll').style.top = `${$('#scr-tag .sb-fill').offsetHeight + $('#scr-tag .v4-bar').offsetHeight}px`;
$('#tag-scroll').style.bottom = `${$('#scr-tag .tabbar').offsetHeight}px`;
// The bill is shorter than the camera's frame: centre it.
$('#cam-doc').style.marginTop = `${-$('#cam-doc').offsetHeight / 2}px`;

// Upload, after the photo is read: what it found takes the progress card's place.
const ocrSlot = $('.ocr-slot');
ocrSlot.style.height = `${$('#ocr-done').offsetHeight}px`;

const Q1 = `When is the ${BIZ.supplier} bill due, and how much is it?`;
const OV = { q1: inputOverflow('#ask-line', Q1) };

// Manage team: the banner and the pending invitation open once it is sent.
const banner = $('#tm-banner');
const pending = $('#tm-pending');
const bannerH = banner.offsetHeight;
const pendingH = pending.offsetHeight;

// The chapter bar's marker sits under the chapter shown.
const bar = $('#fm-chapters');
const marks = $$('span', bar).map((el) => ({ x: el.offsetLeft, w: el.offsetWidth }));

// ─── Measure tap targets before anything is transformed ─────────────────
const P = {
  scan: at('#up-scan'), shutter: at('#cam-shutter'), save: at('#save-btn'), tagTop: at('#tag-inner'), catTitle: at('#cat-hint'),
  askInput: at($('#ask-typed').closest('.ask-inputbox')), askSend: at('#ask-send-on'), askHome: at('#ask-tab-home'),
  homeAvatar: at('#scr-home-avatar'), drOverview: at('#dr-overview'), drTeam: at('#dr-team'),
  markPaid: at('#ov-b1-paid'), pn2: at('#pn2'), nn1: at('#nn-1 .nn-check'), notesBack: at('#scr-notes .v4-back'),
  tmAdd: at('#tm-add'), tmEmail: at('#tm-email'), tmShown: at('#tm-shown'), tmSend: at('#tm-send'),
};
const tagView = $('#tag-scroll').offsetHeight;
const tagMax = $('#tag-inner').offsetHeight - tagView;
ocrSlot.style.height = '';
banner.style.height = '0px';
pending.style.height = '0px';

// Overview: down to the bills, then, once a bill is paid and gone, to the money.
const ovBills = scrollTo('#ov-inner', '.ov-scroll', '#ov-bills', 12);
const paidH = $('#ov-b1').offsetHeight;
$('#ov-b1').style.display = 'none';
const ovMoney = scrollTo('#ov-inner', '.ov-scroll', '#ov-note', $('.ov-scroll').offsetHeight - $('#ov-note').offsetHeight - 24);
$('#ov-b1').style.display = '';

layoutChat('#ask-area', [['ask-q1'], ['ask-l1', 'ask-a1']]);

// ─── Initial state ───────────────────────────────────────────────────────
initialState();
// A formal film opens in daylight and stays there.
gsap.set('#bg-day', { autoAlpha: 1, clipPath: 'none' });
gsap.set('#vignette', { autoAlpha: 0 });
gsap.set($$('.fm-tile, .fm-pillar, .fm-card, .fm-node, .fm-b, .fm-plan, .fm-p, .fm-eyebrow, .fm-label, #fm-table tbody tr, #fm-table thead'), { autoAlpha: 0 });
// The timeline's line runs across in 16:9 and down in 9:16.
const LINE = PORTRAIT ? 'scaleY' : 'scaleX';
gsap.set('#fm-line', { [LINE]: 0, transformOrigin: PORTRAIT ? '50% 0%' : '0% 50%' });
gsap.set('#fm-chapters', { autoAlpha: 0 });
gsap.set($$('#fm-chapters span'), { opacity: 0.42 });
gsap.set('#fm-ind', { x: marks[0].x, width: marks[0].w });
gsap.set(['#cat-hint', `#c-${PURCHASE}-sel`], { autoAlpha: 0 });
gsap.set([banner, pending], { autoAlpha: 0 });
gsap.set('#tm-dim', { autoAlpha: 0 });
gsap.set('#tm-sheet', { yPercent: 105 });
gsap.set($$('.ov-bar'), { scaleY: 0, transformOrigin: '50% 100%' });
place('#phone', L.dayPhone, { autoAlpha: 0 });
setLayout(L, { 'co-bill': 'coBill', 'co-overview': 'coOverview', 'co-alerts': 'coAlerts' });

// ─── This film's text: a label, a heading, then what follows ────────────
function showBlock(id, t) {
  const b = $(`#${id}`);
  tl.set(b, { autoAlpha: 1, y: 0 }, t);
  fadeIn($('.fm-eyebrow', b), t, { from: 10, duration: 0.5 });
  reveal($('.fm-h', b), t + 0.15, { stagger: 0.05, dur: 0.9 });
  const p = $('.fm-p', b);
  return p;
}
function showChapter(i, t) {
  const b = $(`#${CHAPTERS[i][0]}`);
  tl.set(b, { autoAlpha: 1, y: 0 }, t);
  fadeIn($('.fm-label', b), t, { from: 10, duration: 0.5 });
  reveal($('.fm-h2', b), t + 0.15, { stagger: 0.05, dur: 0.9 });
  tl.fromTo($$('.fm-b', b), { autoAlpha: 0, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.5, stagger: 0.16, ...IR }, t + 0.75);
  if ($('.fm-plan', b)) fadeIn($('.fm-plan', b), t + 1.35, { from: 8, duration: 0.5 });
  cue(t, 'whoosh-soft');
  // The bar above (16:9) marks the chapter shown.
  if (!PORTRAIT) {
    $$('#fm-chapters span').forEach((el, k) => tl.to(el, { opacity: k === i ? 1 : 0.42, duration: 0.3, ease: 'none' }, t));
    tl.to('#fm-ind', { x: marks[i].x, width: marks[i].w, duration: 0.5, ease: 'power3.inOut' }, t);
  }
}
const hideChapter = (i, t) => hide(`#${CHAPTERS[i][0]}`, t, { y: -16 });

// ═════════════════════════════════════════════════════════════════════════
// SCENES
// ═════════════════════════════════════════════════════════════════════════
const S = {};

// ─── 1. Title ────────────────────────────────────────────────────────────
S.title = 0;
cue(0, 'section', { name: 'formal' });
tl.to('#fade', { autoAlpha: 0, duration: 0.9, ease: 'power1.inOut' }, 0);
tl.set('#brand', { autoAlpha: 1 }, 0.2);
tl.fromTo('#logo', { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.9, ease: 'back.out(1.5)', ...IR }, 0.3);
cue(0.35, 'pop');
bubblePop('#logo', 0.85);
tl.fromTo('#wordmark', { clipPath: 'inset(0% 100% 0% 0%)', y: 12 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.8, ease: 'power3.out', ...IR }, 0.8);
tl.fromTo('#badge', { autoAlpha: 0, scale: 0.9, y: 8 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.6)', ...IR }, 1.3);
cue(1.35, 'pop-soft');
fadeIn('#tagline', 1.8, { from: 14, duration: 0.7 });
hide('#brand', SHORT ? 4.0 : 4.6, { y: -30 });
S.docs = SHORT ? 4.5 : 5.1;

// ─── 2. The challenge: the documents, and the dates in them ─────────────
{
  const t0 = S.docs;
  const p = showBlock('f-docs', t0);
  tl.fromTo($$('#f-docs .fm-tile'), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.07, ...IR }, t0 + 0.6);
  cue(t0 + 0.6, 'pop-soft');
  fadeIn(p, t0 + 1.5, { from: 12, duration: 0.6 });
  hide('#f-docs', t0 + (SHORT ? 4.6 : 5.5), { y: -20 });
  S.dates = t0 + (SHORT ? 5.0 : 6.0);
}
{
  // The line draws through each date as it arrives: the dates sit at equal
  // steps along it, so it reaches the i-th at (i + 0.5) / n of its length.
  const t0 = S.dates;
  const p = showBlock('f-dates', t0);
  const nodes = $$('#f-dates .fm-node');
  const step = SHORT ? 0.38 : 0.5;
  const first = t0 + 0.8;
  tl.to('#fm-line', { [LINE]: 1, duration: nodes.length * step, ease: 'none' }, first - step / 2);
  nodes.forEach((m, i) => {
    const t = first + i * step;
    tl.fromTo(m, { autoAlpha: 0, y: PORTRAIT ? 0 : 14, x: PORTRAIT ? 14 : 0 }, { autoAlpha: 1, y: 0, x: 0, duration: 0.45, ...IR }, t);
    tl.fromTo($('.fm-dot', m), { scale: 0 }, { scale: 1, duration: 0.4, ease: 'back.out(2.5)', ...IR }, t);
    cue(t, 'tick');
  });
  fadeIn(p, first + nodes.length * step + 0.2, { from: 12, duration: 0.6 });
  hide('#f-dates', t0 + (SHORT ? 5.8 : 7.0), { y: -20 });
  S.solution = t0 + (SHORT ? 6.2 : 7.5);
}

// ─── 3. The product in five parts ────────────────────────────────────────
{
  const t0 = S.solution;
  cue(t0, 'section', { name: 'solution' });
  showBlock('f-pillars', t0);
  tl.fromTo($$('#f-pillars .fm-pillar'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.12, ...IR }, t0 + 0.6);
  cue(t0 + 0.6, 'pop-soft');
  hide('#f-pillars', t0 + (SHORT ? 4.4 : 5.4), { y: -20 });
  S.capture = t0 + (SHORT ? 4.8 : 5.9);
}

// ─── 4. 01 Capture: a bill photographed, filed and read ─────────────────
{
  const t0 = S.capture;
  const d = t0 + 0.9;
  if (!PORTRAIT) fadeIn('#fm-chapters', t0 - 0.1, { from: -8, duration: 0.5 });
  showChapter(0, t0);
  tl.set('#scr-upload', { autoAlpha: 1, zIndex: nextZ() }, t0);
  chrome(t0, 'app', '10:14');
  phoneIn(t0 + 0.1);
  tap(d + 1.0, P.scan, { press: '#up-scan' });
  nav('scr-upload', 'scr-camera', d + 1.15, 'zoom', 0.4);
  chrome(d + 1.15, 'os');
  tl.fromTo('#cam-guides', { scale: 1.08, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ...IR }, d + 1.5);
  tl.set('#cam-scan', { autoAlpha: 1 }, d + 1.7);
  tl.fromTo('#cam-scan', { y: 0 }, { y: 440, duration: 1.0, ease: 'power1.inOut', ...IR }, d + 1.7);
  tl.set('#cam-scan', { autoAlpha: 0 }, d + 2.7);
  cue(d + 1.7, 'scan', { dur: 1.0 });
  tap(d + 2.9, P.shutter, { press: '#cam-shutter' });
  tl.fromTo('#shutter', { autoAlpha: 0 }, { autoAlpha: 0.95, duration: 0.06, ease: 'none', ...IR }, d + 2.92);
  tl.to('#shutter', { autoAlpha: 0, duration: 0.35, ease: 'power1.out' }, d + 3.0);
  cue(d + 2.92, 'shutter');
  nav('scr-camera', 'scr-tag', d + 3.25, 'fade', 0.35);
  chrome(d + 3.25, 'app');
  tl.fromTo('#ocr-fill', { scaleX: 0 }, { scaleX: 1, duration: 1.55, ease: 'power1.inOut', ...IR }, d + 3.5);
  cue(d + 3.5, 'process', { dur: 1.55 });
  // Read: what it found, and the category its words point to (Purchase Bills).
  const r0 = d + 5.1;
  tl.to('#ocr-card', { autoAlpha: 0, duration: 0.2, ease: 'none' }, r0);
  fadeIn('#ocr-done', r0, { from: 4, duration: 0.3 });
  tl.to(ocrSlot, { height: $('#ocr-done').offsetHeight, duration: 0.3, ease: 'power2.out' }, r0);
  tl.set([`#c-${PURCHASE}-sel`, '#cat-hint'], { autoAlpha: 1 }, r0);
  cue(r0 + 0.05, 'ding');
  showCallout('#co-bill', r0 + 0.2);
  tl.fromTo($$('#co-bill .co-row, #co-bill .co-foot'), { autoAlpha: 0, x: 14 }, { autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.12, ...IR }, r0 + 0.4);
  // Down to the category it picked, and Save.
  const scroll1 = Math.min(tagMax, Math.max(P.catTitle.top - P.tagTop.top - 48, P.save.top + P.save.h + 16 - (P.tagTop.top + tagView)));
  tl.to('#tag-inner', { y: -scroll1, duration: 0.7, ease: 'power2.inOut' }, r0 + 0.9);
  tl.fromTo(`#c-${PURCHASE}`, { boxShadow: '0 0 0 0px rgba(15,92,87,0)' }, { boxShadow: '0 0 0 4px rgba(15,92,87,0.35)', duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut', ...IR }, r0 + 1.7);
  tap(r0 + 2.5, P.save, { scroll: scroll1 });
  tl.to('#save-busy', { autoAlpha: 1, duration: 0.12, ease: 'none' }, r0 + 2.52);
  tl.to('#save-btn', { opacity: 0.7, duration: 0.12, ease: 'none' }, r0 + 2.55);
  tl.set('#save-busy', { autoAlpha: 0 }, r0 + 3.15);
  tl.set('#save-btn', { opacity: 1 }, r0 + 3.15);
  tl.fromTo('#up-dialog', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'none', ...IR }, r0 + 3.15);
  tl.fromTo('#up-dialog-box', { scale: 0.92 }, { scale: 1, duration: 0.35, ease: 'power2.out', ...IR }, r0 + 3.15);
  cue(r0 + 3.2, 'success');
  hide('#co-bill', r0 + 3.9, { y: '-=20' });
  hideChapter(0, r0 + 4.0);
  S.ask = r0 + 4.45;
}

// ─── 5. 02 Ask ───────────────────────────────────────────────────────────
{
  const t0 = S.ask;
  const d = t0 + 1.2;
  const k = SHORT ? { type: 1.7, think: 1.25 } : { type: 2.0, think: 1.4 };
  const sent = d + 0.9 + k.type + 0.3;
  const ans = sent + 0.25 + k.think;
  showChapter(1, t0);
  nav('scr-tag', 'scr-ask', t0, 'fade', 0.4);
  tap(d + 0.75, P.askInput);
  tl.set('#ask-ph', { autoAlpha: 0 }, d + 0.9);
  tl.set('#ask-caret', { autoAlpha: 1 }, d + 0.8);
  swap('#ask-send-off', '#ask-send-on', d + 0.95, 0.15);
  type('#ask-typed', Q1, d + 0.9, k.type);
  if (OV.q1.over) tl.to('#ask-line', { x: -OV.q1.over, duration: k.type * (1 - OV.q1.frac), ease: 'none' }, d + 0.9 + k.type * OV.q1.frac);
  tap(sent, P.askSend, { press: '#ask-send-on' });
  cue(sent + 0.02, 'send');
  tl.set('#ask-typed', { text: '' }, sent + 0.05);
  tl.set('#ask-line', { x: 0 }, sent + 0.05);
  tl.set('#ask-caret', { autoAlpha: 0 }, sent + 0.05);
  tl.set('#ask-ph', { autoAlpha: 1 }, sent + 0.05);
  swap('#ask-send-on', '#ask-send-off', sent + 0.05, 0.1);
  tl.to('#ask-empty', { autoAlpha: 0, duration: 0.2, ease: 'none' }, sent + 0.05);
  tl.to('#ask-new', { autoAlpha: 1, duration: 0.2, ease: 'none' }, sent + 0.05);
  tl.set('#ask-save', { opacity: 0.45 }, sent + 0.05);
  tl.to('#ask-savebar', { autoAlpha: 1, duration: 0.2, ease: 'none' }, sent + 0.05);
  fadeIn('#ask-q1', sent + 0.1, { duration: 0.3 });
  fadeIn('#ask-l1', sent + 0.25, { duration: 0.3 });
  tl.to('#ask-l1', { autoAlpha: 0, duration: 0.15, ease: 'none' }, ans);
  fadeIn('#ask-a1', ans, { from: 8, duration: 0.4 });
  tl.to('#ask-save', { opacity: 1, duration: 0.2, ease: 'none' }, ans + 0.05);
  cue(ans, 'answer');
  tl.to('#ask-hl', { backgroundSize: '100% 100%', duration: 0.6, ease: 'power2.inOut' }, ans + 0.6);
  hideChapter(1, ans + (SHORT ? 1.6 : 2.0));
  S.overview = ans + (SHORT ? 2.05 : 2.45);
}

// ─── 6. 03 Overview: renewals, bills due, money in and out ──────────────
{
  const t0 = S.overview;
  const k = SHORT ? 0.85 : 1;
  showChapter(2, t0);
  // Home, the drawer behind your initial, then Overview.
  tap(t0 + 0.6, P.askHome);
  nav('scr-ask', 'scr-home', t0 + 0.7, 'fade', 0.3);
  tap(t0 + 1.55, P.homeAvatar, { press: '#scr-home-avatar' });
  drawer('#drawer', t0 + 1.63, true);
  tap(t0 + 2.45, P.drOverview, { press: '#dr-overview' });
  drawer('#drawer', t0 + 2.55, false);
  nav('scr-home', 'scr-overview', t0 + 2.7, 'push');
  showCallout('#co-overview', t0 + 3.6);
  tl.fromTo($$('#co-overview .co-check, #co-overview .co-quiet'), { autoAlpha: 0, x: 14 }, { autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.14, ...IR }, t0 + 3.8);
  // The renewal due soonest, then the bills: one paid, and it leaves the list.
  tl.fromTo('#ov-renewals .ov-row:first-child', { backgroundColor: 'rgba(15,92,87,0)' }, { backgroundColor: 'rgba(15,92,87,0.10)', duration: 0.35, yoyo: true, repeat: 1, ease: 'sine.inOut', ...IR }, t0 + 3.7);
  const b0 = t0 + 4.4 * k;
  tl.to('#ov-inner', { y: -ovBills, duration: 0.7, ease: 'power2.inOut' }, b0);
  tap(b0 + 1.05, P.markPaid, { scroll: ovBills, press: '#ov-b1-paid' });
  tl.to('#ov-b1', { autoAlpha: 0, duration: 0.2, ease: 'none' }, b0 + 1.15);
  tl.fromTo('#ov-b1', { height: paidH }, { height: 0, paddingTop: 0, paddingBottom: 0, borderTopWidth: 0, duration: 0.35, ease: 'power2.inOut', ...IR }, b0 + 1.3);
  tl.set('#ov-pay-total', { text: '₹36,580' }, b0 + 1.3);
  tl.set('#ov-tile-bills', { text: '2' }, b0 + 1.3);
  cue(b0 + 1.15, 'ding');
  // Money in and out, month by month: Pro.
  const m0 = b0 + 2.1 * k;
  tl.to('#ov-inner', { y: -ovMoney, duration: 0.8, ease: 'power2.inOut' }, m0);
  tl.to($$('.ov-bar'), { scaleY: 1, duration: 0.6, ease: 'power3.out', stagger: 0.04 }, m0 + 0.5);
  cue(m0 + 0.5, 'process', { dur: 0.8 });
  const end = m0 + (SHORT ? 2.4 : 2.9);
  hide('#co-overview', end - 0.1, { y: '-=20' });
  hideChapter(2, end);
  if (SHORT) {
    tl.to('#phone', { autoAlpha: 0, y: '+=50', duration: 0.5, ease: 'power2.in' }, end);
    hide('#fm-chapters', end, { y: -10 });
  }
  S.alerts = end + 0.45;
}

// ─── 7. 04 Reminders, and your own notes ────────────────────────────────
if (SHORT) S.plans = S.alerts;
if (!SHORT) {
  const t0 = S.alerts;
  showChapter(3, t0);
  // The next morning: an expiry reminder and a note's reminder, as web pushes.
  nav('scr-overview', 'scr-lockday', t0, 'fade', 0.45);
  chrome(t0, 'os', '9:05');
  vibrate(t0 + 1.0);
  notify('#pn1', t0 + 1.05);
  vibrate(t0 + 1.7);
  notify('#pn2', t0 + 1.75);
  showCallout('#co-alerts', t0 + 3.0);
  tl.fromTo('#co-alerts .track', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.inOut', ...IR }, t0 + 3.2);
  tl.fromTo($$('#co-alerts .co-step'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.16, ...IR }, t0 + 3.2);
  tl.fromTo('#co-alerts .co-foot', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, ...IR }, t0 + 3.9);
  // The note's reminder opens My notes; the call made, it is ticked off.
  tap(t0 + 4.3, P.pn2, { press: '#pn2' });
  nav('scr-lockday', 'scr-notes', t0 + 4.45, 'zoom', 0.4);
  chrome(t0 + 4.45, 'app', '10:14');
  tap(t0 + 5.6, P.nn1);
  swap('#nn-1 .nn-off', '#nn-1 .nn-on', t0 + 5.62, 0.15);
  tl.to('#nn-1 .nn-t', { color: '#6B7280', duration: 0.15, ease: 'none' }, t0 + 5.62);
  tl.set('#nn-1 .nn-t', { textDecoration: 'line-through' }, t0 + 5.62);
  cue(t0 + 5.65, 'ding');
  hide('#co-alerts', t0 + 6.7, { y: '-=20' });
  hideChapter(3, t0 + 6.8);
  S.team = t0 + 7.25;
}

// ─── 8. 05 Team: invited, and accepted before anyone sees a thing ───────
if (!SHORT) {
  const t0 = S.team;
  showChapter(4, t0);
  tap(t0 + 0.45, P.notesBack, { press: '#scr-notes .v4-back' });
  nav('scr-notes', 'scr-home', t0 + 0.55, 'back', 0.4);
  tap(t0 + 1.35, P.homeAvatar, { press: '#scr-home-avatar' });
  drawer('#drawer', t0 + 1.43, true);
  tap(t0 + 2.2, P.drTeam, { press: '#dr-team' });
  drawer('#drawer', t0 + 2.3, false);
  nav('scr-home', 'scr-team', t0 + 2.45, 'push');
  // Add: their email, and the name the team will see.
  tap(t0 + 3.5, P.tmAdd, { press: '#tm-add' });
  tl.to('#tm-dim', { autoAlpha: 1, duration: 0.25, ease: 'none' }, t0 + 3.6);
  tl.to('#tm-sheet', { yPercent: 0, duration: 0.4, ease: 'power3.out' }, t0 + 3.6);
  cue(t0 + 3.6, 'whoosh-soft');
  tap(t0 + 4.35, P.tmEmail);
  tl.to('#tm-email', { borderColor: '#0F5C57', duration: 0.1, ease: 'none' }, t0 + 4.37);
  tl.set('#tm-email-ph', { autoAlpha: 0 }, t0 + 4.45);
  type('#tm-email-typed', BIZ.caEmail, t0 + 4.45, 0.95);
  tap(t0 + 5.65, P.tmShown);
  tl.to('#tm-email', { borderColor: '#D1D5DB', duration: 0.1, ease: 'none' }, t0 + 5.67);
  tl.to('#tm-shown', { borderColor: '#0F5C57', duration: 0.1, ease: 'none' }, t0 + 5.67);
  tl.set('#tm-shown-ph', { autoAlpha: 0 }, t0 + 5.75);
  type('#tm-shown-typed', BIZ.caShown, t0 + 5.75, 0.8);
  tap(t0 + 6.9, P.tmSend, { press: '#tm-send' });
  tl.to('#tm-sheet', { yPercent: 105, duration: 0.35, ease: 'power3.in' }, t0 + 7.0);
  tl.to('#tm-dim', { autoAlpha: 0, duration: 0.3, ease: 'none' }, t0 + 7.05);
  tl.to(banner, { height: bannerH, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, t0 + 7.3);
  tl.to(pending, { height: pendingH, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, t0 + 7.4);
  cue(t0 + 7.35, 'success');
  hideChapter(4, t0 + 9.2);
  hide('#fm-chapters', t0 + 9.2, { y: -10 });
  tl.to('#phone', { autoAlpha: 0, y: '+=60', duration: 0.55, ease: 'power2.in' }, t0 + 9.25);
  S.trust = t0 + 9.8;
}

// ─── 9. Access and control ───────────────────────────────────────────────
if (!SHORT) {
  const t0 = S.trust;
  cue(t0, 'section', { name: 'trust' });
  const p = showBlock('f-trust', t0);
  tl.fromTo($$('#f-trust .fm-card'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.12, ...IR }, t0 + 0.8);
  $$('#f-trust .fm-card').forEach((c, i) => cue(t0 + 0.85 + i * 0.12, 'pop-soft'));
  fadeIn(p, t0 + 1.8, { from: 10, duration: 0.6 });
  hide('#f-trust', t0 + 6.8, { y: -20 });
  S.plans = t0 + 7.3;
}

// ─── 10. Plans ───────────────────────────────────────────────────────────
{
  const t0 = S.plans;
  cue(t0, 'section', { name: 'plans' });
  const p = showBlock('f-plans', t0);
  fadeIn('#fm-table thead', t0 + 0.6, { from: 10, duration: 0.5 });
  tl.fromTo($$('#fm-table tbody tr'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.09, ...IR }, t0 + 0.8);
  cue(t0 + 0.8, 'pop-soft');
  fadeIn(p, t0 + 1.8, { from: 10, duration: 0.6 });
  hide('#f-plans', t0 + (SHORT ? 6.0 : 7.0), { y: -20 });
  S.end = t0 + (SHORT ? 6.45 : 7.5);
}

// ─── 11. Closing card ────────────────────────────────────────────────────
{
  const t0 = S.end;
  cue(t0, 'section', { name: 'end' });
  tl.set('#endcard', { autoAlpha: 1 }, t0);
  tl.fromTo('#end-logo', { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.9, ease: 'back.out(1.5)', ...IR }, t0 + 0.1);
  cue(t0 + 0.15, 'pop');
  bubblePop('#end-logo', t0 + 0.65);
  tl.fromTo('#end-word', { clipPath: 'inset(0% 100% 0% 0%)', y: 12 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.8, ...IR }, t0 + 0.6);
  tl.fromTo('#end-badge', { autoAlpha: 0, scale: 0.9, y: 8 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.6)', ...IR }, t0 + 1.05);
  fadeIn('#end-tag', t0 + 1.45, { from: 14, duration: 0.7 });
  tl.fromTo('#end-cta', { autoAlpha: 0, scale: 0.92, y: 14 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.5)', ...IR }, t0 + 2.0);
  cue(t0 + 2.05, 'pop-soft');
  fadeIn('#end-note', t0 + 2.45, { from: 10, duration: 0.6 });
  if ($('#end-url')) fadeIn('#end-url', t0 + 2.7, { from: 8 });
  S.total = t0 + (SHORT ? 5.2 : 6.2);
}

finish(S);
