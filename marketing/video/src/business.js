// The business film: 8:40 PM, the GST return due on the 20th and the bills
// everywhere, then what AskLocker does for a business. Built on src/engine.js.
//
// The short cut keeps the story and the three things a business sees first:
// hook, scramble, insight, Scan and file, Ask, Overview, resolution. It drops
// the unanswered call, Reminders and notes, Team, Family and Business, and
// Privacy.
import {
  gsap, PORTRAIT, SHORT, $, $$, build, askArea, inputOverflow, at, scrollTo, layoutChat, place, initialState,
  setLayout, tl, cue, IR, showCallout, reveal, showWhy, showHow, hide, fadeIn, swap, nextZ, nav, chrome, tap, type,
  vibrate, phoneIn, popCard, notify, bubblePop, sub, drawer, finish,
} from './engine.js';
import { phone, scrambleCards, textBlocks, callouts, subtitles, BIZ, PURCHASE } from './business-screens.js';

// ─── Layout: every position that differs between 16:9 and 9:16 ───────────
const L = PORTRAIT ? {
  hookPhone: [540, 1150, 1.0], callPhone: [540, 1160, 0.96], dayPhone: [540, 1176, 0.94],
  resPhone: [540, 1176, 0.94], coScale: 0.88,
  cards: { chat: [520, 590, -3], mail: [590, 820, 3], note: [470, 1060, -2], photos: [620, 1290, 2.5], pc: [470, 1500, -5] },
  coBill: 't-scan', coOverview: 't-overview', coAlerts: 't-alerts',
} : {
  hookPhone: [1260, 540, 0.98], callPhone: [660, 540, 0.95], dayPhone: [1270, 548, 0.94],
  resPhone: [1290, 548, 0.94],
  cards: { chat: [575, 430, -3], mail: [1355, 345, 3], note: [505, 800, -5], photos: [985, 655, -2], pc: [1440, 790, 2.5] },
  coBill: [1632, 690], coOverview: [1636, 700], coAlerts: [1636, 730],
};

await build({ cards: scrambleCards(), texts: textBlocks(), phone: phone(), callouts: callouts(), subs: subtitles() });

// ─── Layout passes: what flexbox would have settled in the app ──────────
askArea('#ask-area', '#scr-ask');
askArea('#ca-area', '#scr-ca');
$('#tag-scroll').style.top = `${$('#scr-tag .sb-fill').offsetHeight + $('#scr-tag .v4-bar').offsetHeight}px`;
$('#tag-scroll').style.bottom = `${$('#scr-tag .tabbar').offsetHeight}px`;
// The bill is shorter than the camera's frame: centre it.
$('#cam-doc').style.marginTop = `${-$('#cam-doc').offsetHeight / 2}px`;

// Upload, after the photo is read: what it found takes the progress card's place.
const ocrSlot = $('.ocr-slot');
ocrSlot.style.height = `${$('#ocr-done').offsetHeight}px`;

const Q1 = `When is the ${BIZ.supplier} bill due, and how much is it?`;
const OV = { q1: inputOverflow('#ask-line', Q1) };
const EMAIL = BIZ.caEmail;
const SHOWN = BIZ.caShown;

// Manage team: the sheet slides up from below; the banner and the pending
// invitation open once it is sent.
const banner = $('#tm-banner');
const pending = $('#tm-pending');
const bannerH = banner.offsetHeight;
const pendingH = pending.offsetHeight;

// ─── Measure tap targets before anything is transformed ─────────────────
const P = {
  scan: at('#up-scan'), shutter: at('#cam-shutter'), save: at('#save-btn'), tagTop: at('#tag-inner'), catTitle: at('#cat-hint'),
  askInput: at($('#ask-typed').closest('.ask-inputbox')), askSend: at('#ask-send-on'), askHome: at('#ask-tab-home'),
  homeAvatar: at('#scr-home-avatar'), drOverview: at('#dr-overview'), drTeam: at('#dr-team'),
  toFamily: at('#business-mode-family'), toBusiness: at('#family-mode-business'),
  markPaid: at('#ov-b1-paid'), pn2: at('#pn2'), nn1: at('#nn-1 .nn-check'),
  notesBack: at('#scr-notes .v4-back'), teamBack: at('#scr-team .v4-back'),
  tmAdd: at('#tm-add'), tmEmail: at('#tm-email'), tmShown: at('#tm-shown'), tmSend: at('#tm-send'),
};
const tagView = $('#tag-scroll').offsetHeight;
const tagMax = $('#tag-inner').offsetHeight - tagView;
ocrSlot.style.height = '';
const moreH = { ln1: $('#ln1-more1').offsetHeight };
banner.style.height = '0px';
pending.style.height = '0px';

// Overview: down to the bills, then, once a bill is paid and gone, to the money.
const ovBills = scrollTo('#ov-inner', '.ov-scroll', '#ov-bills', 12);
const paidH = $('#ov-b1').offsetHeight;
$('#ov-b1').style.display = 'none';
const ovMoney = scrollTo('#ov-inner', '.ov-scroll', '#ov-note', $('.ov-scroll').offsetHeight - $('#ov-note').offsetHeight - 24);
$('#ov-b1').style.display = '';

layoutChat('#ask-area', [['ask-q1'], ['ask-l1', 'ask-a1']]);
layoutChat('#ca-area', [['ca-q1'], ['ca-a1']]);

// ─── Initial state ───────────────────────────────────────────────────────
initialState();
gsap.set('#scr-lock', { autoAlpha: 1 });
gsap.set('#sc-count', { autoAlpha: 0 });
gsap.set(['#cat-hint', `#c-${PURCHASE}-sel`], { autoAlpha: 0 });
gsap.set([banner, pending], { autoAlpha: 0 });
gsap.set('#tm-dim', { autoAlpha: 0 });
gsap.set('#tm-sheet', { yPercent: 105 });
gsap.set($$('.ov-bar'), { scaleY: 0, transformOrigin: '50% 100%' });
place('#phone', L.hookPhone, { autoAlpha: 0 });
for (const [name, pos] of Object.entries(L.cards)) place(`#sc-${name}`, [pos[0], pos[1]], { rotation: pos[2], autoAlpha: 0 });
setLayout(L, { 'co-bill': 'coBill', 'co-overview': 'coOverview', 'co-alerts': 'coAlerts' });

// ═════════════════════════════════════════════════════════════════════════
// SCENES
// ═════════════════════════════════════════════════════════════════════════
const S = {};

// ─── 1. 8:40 PM ──────────────────────────────────────────────────────────
S.hook = 0;
cue(0, 'section', { name: 'night' });
tl.to('#fade', { autoAlpha: 0, duration: 1.2, ease: 'power1.inOut' }, 0);
tl.fromTo('#phone', { autoAlpha: 0, y: `+=70`, scale: L.hookPhone[2] * 0.94 },
  { autoAlpha: 1, y: L.hookPhone[1], scale: L.hookPhone[2], duration: 1.4, ...IR }, 0.25);
chrome(0, 'os', '8:40');
tl.set('#t-hook', { autoAlpha: 1 }, 0.5);
tl.fromTo('#t-hook .clock-big', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.1, ...IR }, 0.5);
tl.fromTo('#t-hook .where', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1.0, ...IR }, 1.0);
vibrate(1.45);
notify('#ln1', 1.5);
sub('sub-1', 1.85, 3.45);
vibrate(3.25);
tl.to('#ln1-more1', { height: moreH.ln1, autoAlpha: 1, duration: 0.45, ease: 'power3.out' }, 3.3);
cue(3.3, 'notif');
sub('sub-2', 3.55, 6.05);
tl.to('#phone', { autoAlpha: 0, scale: L.hookPhone[2] * 0.9, y: '+=40', duration: 0.6, ease: 'power2.in' }, 6.25);
hide('#t-hook', 6.2, { x: -30, y: 0 });

// ─── 2. The scramble ─────────────────────────────────────────────────────
S.scramble = 6.9;
{
  const t0 = S.scramble;
  tl.set('#caps', { autoAlpha: 1 }, t0);
  fadeIn('#time-chip', t0, { from: -10 });
  const all = [
    ['cap1', '#sc-chat', '8:42 PM'], ['cap2', '#sc-mail', '8:49 PM'], ['cap3', '#sc-note', '8:57 PM'],
    ['cap4', '#sc-photos', '9:08 PM'], ['cap5', '#sc-pc', '9:21 PM'],
  ];
  const beats = SHORT ? [all[0], all[2], all[4]] : all;
  const step = SHORT ? 1.7 : 1.85;
  beats.forEach(([cap, card, time], i) => {
    const t = t0 + 0.15 + i * step;
    if (i > 0) {
      tl.set('#chip-time', { text: time }, t);
      tl.fromTo('#time-chip', { scale: 1.12 }, { scale: 1, duration: 0.4, ...IR }, t);
      cue(t, 'tick');
      // Earlier cards fall back as the pile grows.
      tl.to(beats.slice(0, i).map((b) => b[1]), { opacity: 0.55, duration: 0.5, ease: 'power1.out' }, t);
    }
    reveal(`#${cap}`, t);
    popCard(card, t + 0.05);
    tl.to(`#${cap}`, { autoAlpha: 0, duration: 0.3, ease: 'power1.in' }, t + step - 0.3);
  });
  type('#sc-q', 'bill', t0 + 0.55, 0.45);
  tl.to('#sc-caret', { autoAlpha: 0, duration: 0.01 }, t0 + 1.1);
  fadeIn('#sc-count', t0 + 1.15, { from: 4 });
  const pcAt = t0 + 0.15 + beats.findIndex((b) => b[1] === '#sc-pc') * step + 0.75;
  tl.fromTo('#sc-pc .sc-alert', { x: 0 }, { x: 9, duration: 0.05, yoyo: true, repeat: 7, ease: 'sine.inOut', ...IR }, pcAt);
  cue(pcAt, 'error');
  const out = t0 + 0.15 + beats.length * step;
  tl.to(['#sc-chat', '#sc-mail', '#sc-note', '#sc-photos', '#sc-pc'], {
    autoAlpha: 0, y: '+=160', rotation: (i) => [-8, 7, -10, -5, 9][i], duration: 0.55, ease: 'power2.in', stagger: 0.04,
  }, out - 0.2);
  hide('#time-chip', out - 0.2);
  S.insight = out + 0.45;
}

// ─── 3. The insight, and the one person who knows ───────────────────────
{
  const t0 = S.insight;
  tl.set('#t-insight', { autoAlpha: 1 }, t0);
  reveal('#ins-1', t0 + 0.05);
  reveal('#ins-2', t0 + 1.45, { stagger: 0.09, dur: 1.1 });
  cue(t0 + 1.45, 'hit');
  hide('#t-insight', t0 + 3.2);
  const c0 = t0 + 3.75;
  if (SHORT) {
    tl.to('#fade', { autoAlpha: 1, duration: 0.5, ease: 'power1.in' }, t0 + 3.3);
    S.reveal = c0;
  } else {
    // Kavita calls Ravi, who keeps the accounts. Nobody answers.
    S.call = c0;
    tl.set('#scr-call', { autoAlpha: 1, zIndex: nextZ() }, c0);
    tl.set('#scr-lock', { autoAlpha: 0 }, c0);
    chrome(c0, 'os', '9:24');
    tl.fromTo('#phone', { autoAlpha: 0, x: L.callPhone[0], y: L.callPhone[1] + 40, scale: L.callPhone[2] * 0.95 },
      { autoAlpha: 1, x: L.callPhone[0], y: L.callPhone[1], scale: L.callPhone[2], duration: 0.9, ...IR }, c0);
    [0, 1, 2].forEach((i) => {
      tl.fromTo(`#ring${i + 1}`, { autoAlpha: 0.7, scale: 1 }, { autoAlpha: 0, scale: 2.1, duration: 1.5, ease: 'power1.out', repeat: 1, ...IR }, c0 + 0.2 + i * 0.5);
    });
    cue(c0 + 0.25, 'ringback');
    cue(c0 + 1.65, 'ringback');
    tl.set('#t-question', { autoAlpha: 1 }, c0 + 0.35);
    reveal('#t-question .big', c0 + 0.35, { stagger: 0.07 });
    tl.to('#call-actions', { autoAlpha: 0, y: 20, duration: 0.3 }, c0 + 3.1);
    tl.to('#call-label', { text: 'Call ended', duration: 0.01 }, c0 + 3.1);
    fadeIn('#call-missed', c0 + 3.2, { from: 6 });
    cue(c0 + 3.15, 'ring-stop');
    tl.to('#fade', { autoAlpha: 1, duration: 0.7, ease: 'power1.in' }, c0 + 4.0);
    tl.set(['#t-question', '#phone'], { autoAlpha: 0 }, c0 + 4.7);
    S.reveal = c0 + 4.75;
  }
}

// ─── 4. AskLocker for Business ───────────────────────────────────────────
{
  const t0 = S.reveal;
  cue(t0, 'section', { name: 'reveal' });
  cue(t0, 'whoosh');
  tl.set('#vignette', { autoAlpha: 0 }, t0);
  tl.set('#bg-day', { autoAlpha: 1 }, t0);
  tl.to('#fade', { autoAlpha: 0, duration: 0.25, ease: 'none' }, t0);
  tl.to('#bg-day', { clipPath: 'circle(80% at 50% 50%)', duration: 1.1, ease: 'power3.inOut' }, t0);
  tl.set('#brand', { autoAlpha: 1 }, t0 + 0.3);
  tl.fromTo('#logo', { scale: 0.4, rotation: -14, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 1.0, ease: 'back.out(1.7)', ...IR }, t0 + 0.35);
  cue(t0 + 0.4, 'pop');
  bubblePop('#logo', t0 + 0.9);
  tl.fromTo('#wordmark', { clipPath: 'inset(0% 100% 0% 0%)', y: 12 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.8, ease: 'power3.out', ...IR }, t0 + 0.85);
  tl.fromTo('#badge', { autoAlpha: 0, scale: 0.85, y: 10 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.8)', ...IR }, t0 + 1.35);
  cue(t0 + 1.4, 'pop-soft');
  fadeIn('#tagline', t0 + 1.8, { from: 16, duration: 0.7 });
  hide('#brand', t0 + (SHORT ? 3.2 : 4.2), { y: -40 });
  S.scan = t0 + (SHORT ? 3.65 : 4.7);
}

// ─── 5. Scan a bill: filed and read ──────────────────────────────────────
// Each feature scene opens on its why while the phone gets into place, and
// shows its how as the app does the work.
{
  const t0 = S.scan;
  const d = t0 + 1.0;
  cue(t0, 'section', { name: 'day' });
  showWhy('t-scan', t0);
  tl.set('#scr-upload', { autoAlpha: 1, zIndex: nextZ() }, t0);
  tl.set(['#scr-call', '#scr-lock'], { autoAlpha: 0 }, t0);
  chrome(t0, 'app', '10:14');
  phoneIn(t0 + 0.05);
  tap(d + 1.0, P.scan, { press: '#up-scan' });
  nav('scr-upload', 'scr-camera', d + 1.15, 'zoom', 0.4);
  showHow('t-scan', d + 1.1);
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
  tl.fromTo(`#c-${PURCHASE}`, { boxShadow: '0 0 0 0px rgba(212,128,123,0)' }, { boxShadow: '0 0 0 4px rgba(212,128,123,0.45)', duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut', ...IR }, r0 + 1.7);
  tap(r0 + 2.5, P.save, { scroll: scroll1 });
  tl.to('#save-busy', { autoAlpha: 1, duration: 0.12, ease: 'none' }, r0 + 2.52);
  tl.to('#save-btn', { opacity: 0.7, duration: 0.12, ease: 'none' }, r0 + 2.55);
  tl.set('#save-busy', { autoAlpha: 0 }, r0 + 3.15);
  tl.set('#save-btn', { opacity: 1 }, r0 + 3.15);
  tl.fromTo('#up-dialog', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'none', ...IR }, r0 + 3.15);
  tl.fromTo('#up-dialog-box', { scale: 0.92 }, { scale: 1, duration: 0.35, ease: 'power2.out', ...IR }, r0 + 3.15);
  cue(r0 + 3.2, 'success');
  hide('#t-scan', r0 + 4.0);
  hide('#co-bill', r0 + 3.9, { y: '-=20' });
  S.ask = r0 + 4.45;
}

// ─── 6. Ask ──────────────────────────────────────────────────────────────
{
  const t0 = S.ask;
  const d = t0 + 1.4;
  const k = SHORT ? { type: 1.7, think: 1.25 } : { type: 2.0, think: 1.4 };
  const sent = d + 0.9 + k.type + 0.3;
  const ans = sent + 0.25 + k.think;
  showWhy('t-ask', t0);
  nav('scr-tag', 'scr-ask', t0, 'fade', 0.4);
  showHow('t-ask', d + 0.6);
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
  hide('#t-ask', ans + (SHORT ? 1.5 : 2.2));
  S.overview = ans + (SHORT ? 1.95 : 2.65);
}

// ─── 7. Overview: renewals, bills due, money in and out ──────────────────
{
  const t0 = S.overview;
  const k = SHORT ? 0.85 : 1;
  showWhy('t-overview', t0);
  // Home, the drawer behind your initial, then Overview.
  tap(t0 + 0.6, P.askHome);
  nav('scr-ask', 'scr-home', t0 + 0.7, 'fade', 0.3);
  tap(t0 + 1.55, P.homeAvatar, { press: '#scr-home-avatar' });
  drawer('#drawer', t0 + 1.63, true);
  tap(t0 + 2.45, P.drOverview, { press: '#dr-overview' });
  drawer('#drawer', t0 + 2.55, false);
  nav('scr-home', 'scr-overview', t0 + 2.7, 'push');
  showHow('t-overview', t0 + 2.7);
  showCallout('#co-overview', t0 + 3.6);
  tl.fromTo($$('#co-overview .co-check, #co-overview .co-quiet'), { autoAlpha: 0, x: 14 }, { autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.14, ...IR }, t0 + 3.8);
  // The renewal due soonest, then the bills: one paid, and it leaves the list.
  tl.fromTo('#ov-renewals .ov-row:first-child', { backgroundColor: 'rgba(212,128,123,0)' }, { backgroundColor: 'rgba(212,128,123,0.16)', duration: 0.35, yoyo: true, repeat: 1, ease: 'sine.inOut', ...IR }, t0 + 3.7);
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
  hide('#t-overview', end);
  hide('#co-overview', end - 0.1, { y: '-=20' });
  S.alerts = end + 0.45;
}

// ─── 8. Reminders, and your own notes ────────────────────────────────────
if (SHORT) S.res = S.alerts;
if (!SHORT) {
  const t0 = S.alerts;
  showWhy('t-alerts', t0);
  // The next morning: an expiry reminder and a note's reminder, as web pushes.
  nav('scr-overview', 'scr-lockday', t0, 'fade', 0.45);
  chrome(t0, 'os', '9:05');
  vibrate(t0 + 1.6);
  notify('#pn1', t0 + 1.65);
  showHow('t-alerts', t0 + 1.9);
  vibrate(t0 + 2.35);
  notify('#pn2', t0 + 2.4);
  showCallout('#co-alerts', t0 + 3.6);
  tl.fromTo('#co-alerts .track', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.inOut', ...IR }, t0 + 3.8);
  tl.fromTo($$('#co-alerts .co-step'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.16, ...IR }, t0 + 3.8);
  tl.fromTo('#co-alerts .co-foot', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4, ...IR }, t0 + 4.5);
  // The note's reminder opens My notes; the call made, it is ticked off.
  tap(t0 + 5.2, P.pn2, { press: '#pn2' });
  nav('scr-lockday', 'scr-notes', t0 + 5.35, 'zoom', 0.4);
  chrome(t0 + 5.35, 'app', '10:14');
  tap(t0 + 6.6, P.nn1);
  swap('#nn-1 .nn-off', '#nn-1 .nn-on', t0 + 6.62, 0.15);
  tl.to('#nn-1 .nn-t', { color: '#6B7280', textDecorationColor: '#6B7280', duration: 0.15, ease: 'none' }, t0 + 6.62);
  tl.set('#nn-1 .nn-t', { textDecoration: 'line-through' }, t0 + 6.62);
  cue(t0 + 6.65, 'ding');
  hide('#t-alerts', t0 + 7.9);
  hide('#co-alerts', t0 + 7.8, { y: '-=20' });
  S.team = t0 + 8.35;
}

// ─── 9. The team: the CA joins, the records stay ─────────────────────────
if (!SHORT) {
  const t0 = S.team;
  showWhy('t-team', t0);
  tap(t0 + 0.45, P.notesBack, { press: '#scr-notes .v4-back' });
  nav('scr-notes', 'scr-home', t0 + 0.55, 'back', 0.4);
  tap(t0 + 1.35, P.homeAvatar, { press: '#scr-home-avatar' });
  drawer('#drawer', t0 + 1.43, true);
  tap(t0 + 2.2, P.drTeam, { press: '#dr-team' });
  drawer('#drawer', t0 + 2.3, false);
  nav('scr-home', 'scr-team', t0 + 2.45, 'push');
  showHow('t-team', t0 + 2.45);
  // Add: her email, and the name the team will see.
  tap(t0 + 3.6, P.tmAdd, { press: '#tm-add' });
  tl.to('#tm-dim', { autoAlpha: 1, duration: 0.25, ease: 'none' }, t0 + 3.7);
  tl.to('#tm-sheet', { yPercent: 0, duration: 0.4, ease: 'power3.out' }, t0 + 3.7);
  cue(t0 + 3.7, 'whoosh-soft');
  tap(t0 + 4.45, P.tmEmail);
  tl.to('#tm-email', { borderColor: '#0F5C57', duration: 0.1, ease: 'none' }, t0 + 4.47);
  tl.set('#tm-email-ph', { autoAlpha: 0 }, t0 + 4.55);
  type('#tm-email-typed', EMAIL, t0 + 4.55, 0.95);
  tap(t0 + 5.75, P.tmShown);
  tl.to('#tm-email', { borderColor: '#D1D5DB', duration: 0.1, ease: 'none' }, t0 + 5.77);
  tl.to('#tm-shown', { borderColor: '#0F5C57', duration: 0.1, ease: 'none' }, t0 + 5.77);
  tl.set('#tm-shown-ph', { autoAlpha: 0 }, t0 + 5.85);
  type('#tm-shown-typed', SHOWN, t0 + 5.85, 0.8);
  tap(t0 + 7.0, P.tmSend, { press: '#tm-send' });
  tl.to('#tm-sheet', { yPercent: 105, duration: 0.35, ease: 'power3.in' }, t0 + 7.1);
  tl.to('#tm-dim', { autoAlpha: 0, duration: 0.3, ease: 'none' }, t0 + 7.15);
  tl.to(banner, { height: bannerH, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, t0 + 7.4);
  tl.to(pending, { height: pendingH, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, t0 + 7.5);
  cue(t0 + 7.45, 'success');
  hide('#t-team', t0 + 9.6);
  S.apart = t0 + 10.05;
}

// ─── 10. Family and Business, kept apart ─────────────────────────────────
if (!SHORT) {
  const t0 = S.apart;
  showWhy('t-apart', t0);
  tap(t0 + 0.45, P.teamBack, { press: '#scr-team .v4-back' });
  nav('scr-team', 'scr-home', t0 + 0.55, 'back', 0.4);
  tap(t0 + 1.35, P.homeAvatar, { press: '#scr-home-avatar' });
  drawer('#drawer', t0 + 1.43, true);
  showHow('t-apart', t0 + 2.2);
  // Family: the same drawer in the family's colours, over the family's Home.
  const flip = (to, from, t) => {
    tl.set(`#${to}`, { zIndex: nextZ() }, t);
    tl.fromTo(`#${to}`, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'power1.inOut', ...IR }, t);
    tl.set(`#${from}`, { autoAlpha: 0 }, t + 0.25);
    cue(t, 'pop-soft');
  };
  tap(t0 + 3.0, P.toFamily, { press: '#business-mode-family' });
  tl.set('#fdrawer', { autoAlpha: 1 }, t0 + 3.0);
  tl.set('#fdrawer .drawer-dim', { opacity: 1 }, t0 + 3.0);
  tl.set('#fdrawer .drawer-panel', { x: 0 }, t0 + 3.0);
  flip('scr-fhome', 'scr-home', t0 + 3.05);
  tap(t0 + 4.9, P.toBusiness, { press: '#family-mode-business' });
  flip('scr-home', 'scr-fhome', t0 + 4.95);
  hide('#t-apart', t0 + 6.8);
  tl.to('#phone', { autoAlpha: 0, y: `+=60`, duration: 0.55, ease: 'power2.in' }, t0 + 6.85);
  S.trust = t0 + 7.4;
}

// ─── 11. Privacy ─────────────────────────────────────────────────────────
if (!SHORT) {
  const t0 = S.trust;
  const cards = ['#tc1', '#tc2', '#tc3', '#tc4'];
  showWhy('t-trust', t0);
  showHow('t-trust', t0 + 2.2);
  tl.fromTo(cards, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.14, ...IR }, t0 + 2.75);
  cards.forEach((c, i) => cue(t0 + 2.8 + i * 0.14, 'pop-soft'));
  fadeIn('#trust-note', t0 + 3.7, { from: 10, duration: 0.6 });
  hide('#t-trust', t0 + 7.4, { y: -30 });
  S.res = t0 + 7.95;
}

// ─── 12. The same evening ────────────────────────────────────────────────
{
  const t0 = S.res;
  cue(t0, 'section', { name: 'night2' });
  tl.to('#bg-day', { autoAlpha: 0, duration: 0.9, ease: 'power1.inOut' }, t0);
  tl.to('#vignette', { autoAlpha: 1, duration: 0.9 }, t0);
  tl.set('#t-res', { autoAlpha: 1, y: 0 }, t0 + 0.4);
  tl.set(['#res-h1b', '#res-sub'], { autoAlpha: 0 }, t0 + 0.4);
  tl.fromTo('#t-res .kicker', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6, ...IR }, t0 + 0.4);
  tl.fromTo('#t-res .clock-big', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, ...IR }, t0 + 0.45);
  tl.fromTo($$('#res-h1a .wi'), { yPercent: 118 }, { yPercent: 0, duration: 0.95, ease: 'power4.out', stagger: 0.06, ...IR }, t0 + 0.7);
  // Pooja's phone: she is in the business already, so she asks it herself.
  tl.set($$('.scr'), { autoAlpha: 0 }, t0 + 0.3);
  tl.set('#scr-ca', { autoAlpha: 1, zIndex: nextZ(), xPercent: 0 }, t0 + 0.3);
  tl.set(['#ca-new', '#ca-savebar', '#ca-q1'], { autoAlpha: 1 }, t0 + 0.3);
  chrome(t0 + 0.3, 'app', '8:44');
  if (SHORT) {
    tl.to('#phone', { autoAlpha: 0, duration: 0.3, ease: 'none' }, t0);
    tl.set('#phone', { x: L.resPhone[0], y: L.resPhone[1] + 50, scale: L.resPhone[2] }, t0 + 0.3);
  }
  tl.fromTo('#phone', { autoAlpha: 0, x: L.resPhone[0], y: L.resPhone[1] + 50, scale: L.resPhone[2] },
    { autoAlpha: 1, y: L.resPhone[1], duration: 1.0, ...IR }, t0 + 0.4);
  fadeIn('#ca-a1', t0 + 1.2, { from: 8, duration: 0.45 });
  cue(t0 + 1.2, 'answer');
  // Kavita's phone, a few minutes later.
  const m = t0 + 3.9;
  nav('scr-ca', 'scr-lock2', m, 'fade', 0.5);
  chrome(m, 'os', '8:46');
  tl.to('#res-time', { text: '8:46', duration: 0.01 }, m + 0.1);
  tl.fromTo('#t-res .clock-big', { scale: 1.06 }, { scale: 1, duration: 0.5, ...IR }, m + 0.1);
  tl.to('#res-h1a', { autoAlpha: 0, duration: 0.3 }, m + 0.1);
  tl.set('#res-h1b', { autoAlpha: 1 }, m + 0.3);
  tl.fromTo($$('#res-h1b .wi'), { yPercent: 118 }, { yPercent: 0, duration: 0.95, ease: 'power4.out', stagger: 0.06, ...IR }, m + 0.3);
  vibrate(m + 0.65);
  notify('#ln2', m + 0.7);
  sub('sub-5', m + 1.0, m + 4.1);
  fadeIn('#res-sub', m + 1.4, { from: 16, duration: 0.7 });
  hide(['#t-res'], m + 4.25);
  tl.to('#phone', { autoAlpha: 0, y: `+=40`, duration: 0.5, ease: 'power2.in' }, m + 4.25);
  S.end = m + 4.8;
}

// ─── 13. End card ────────────────────────────────────────────────────────
{
  const t0 = S.end;
  cue(t0, 'section', { name: 'end' });
  cue(t0, 'whoosh');
  tl.set('#bg-day', { autoAlpha: 1, clipPath: 'circle(0% at 50% 50%)' }, t0);
  tl.to('#bg-day', { clipPath: 'circle(80% at 50% 50%)', duration: 1.1, ease: 'power3.inOut' }, t0);
  tl.to('#vignette', { autoAlpha: 0, duration: 0.6 }, t0 + 0.3);
  tl.set('#endcard', { autoAlpha: 1 }, t0 + 0.3);
  tl.fromTo('#end-logo', { scale: 0.4, rotation: -14, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 1.0, ease: 'back.out(1.7)', ...IR }, t0 + 0.35);
  cue(t0 + 0.4, 'pop');
  bubblePop('#end-logo', t0 + 0.9);
  tl.fromTo('#end-word', { clipPath: 'inset(0% 100% 0% 0%)', y: 12 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.8, ...IR }, t0 + 0.85);
  tl.fromTo('#end-badge', { autoAlpha: 0, scale: 0.85, y: 10 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.8)', ...IR }, t0 + 1.3);
  fadeIn('#end-tag', t0 + 1.7, { from: 16, duration: 0.7 });
  tl.fromTo('#end-cta', { autoAlpha: 0, scale: 0.9, y: 16 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.7, ease: 'back.out(1.6)', ...IR }, t0 + 2.3);
  cue(t0 + 2.35, 'pop-soft');
  fadeIn('#end-note', t0 + 2.75, { from: 10, duration: 0.6 });
  S.total = t0 + (SHORT ? 5.2 : 6.0);
}

finish(S);
