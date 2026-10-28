// One AskLocker feature at a time: the feature posters and the feature shorts.
// Built on src/engine.js, with the films' own screens (family-screens.js,
// business-screens.js) and the few only these need (feature-screens.js).
//
//   ?film=features&feature=ask&orientation=portrait   a short, 9:16: why the
//       feature exists, then how AskLocker answers it while the phone does it,
//       then the end card (tools/render.mjs --film features --feature ask --portrait)
//   ?film=features&feature=ask&size=1920x1080         a poster: a line on the
//       left, the phone on the right doing the same; window.__hero is the
//       moment tools/posters.mjs takes the still (also at 1080x1080)
//
// FEATURES holds each one's words, screens and choreography. Every play()
// starts at t, once the phone is in place, and says when the how comes in,
// when the callout does, the poster's moment (hero) and when it is done.
// coY is how high the callout sits beside the phone on a 16:9 poster.
import {
  gsap, PORTRAIT, W, H, $, $$, build, askArea, inputOverflow, at, scrollTo, layoutChat, place, initialState,
  setLayout, tl, cue, IR, showCallout, showWhy, showHow, hide, fadeIn, swap, nextZ, nav, chrome, tap, type,
  vibrate, phoneIn, notify, bubblePop, sub, drawer, finish,
} from './engine.js';
import { icon, logoMark, phoneShell, lockScreen, pushNotif, cameraScreen, whyHow, brand } from './parts.js';
import * as FAM from './family-screens.js';
import * as BUS from './business-screens.js';
import {
  documentScreen, vaultsScreen, appLockScreen, sheetTagScreen, sheetAskScreen, DOCS, SHEET_Q, SALES, CALLOUTS, NAVY, TEAL,
} from './feature-screens.js';
import { VOICE_LINES, voiceSubtitles } from './voice-lines.js';
import { VOICES } from './voices.js';

const STORY = FAM.STORY;
const SQUARE = W === H;

// ─── What two features share ─────────────────────────────────────────────

/** Ask's chat area, the question's overflow and the taps, measured before anything moves. */
function askSetup(p, scr, Q) {
  askArea(`#${p}-area`, `#${scr}`);
  const ov = inputOverflow(`#${p}-line`, Q);
  const P = { input: at($(`#${p}-typed`).closest('.ask-inputbox')), send: at(`#${p}-send-on`), save: at(`#${p}-save`) };
  layoutChat(`#${p}-area`, [[`${p}-q1`], [`${p}-l1`, `${p}-a1`]]);
  return { Q, ov, P };
}

/** A question typed and sent, and its answer (search.tsx). Returns when the answer shows. */
function askTurn(p, t, { Q, ov, P }, k = { type: 1.8, think: 1.3 }) {
  tap(t, P.input);
  tl.set(`#${p}-caret`, { autoAlpha: 1 }, t + 0.05);
  tl.set(`#${p}-ph`, { autoAlpha: 0 }, t + 0.15);
  swap(`#${p}-send-off`, `#${p}-send-on`, t + 0.2, 0.15);
  type(`#${p}-typed`, Q, t + 0.15, k.type);
  if (ov.over) tl.to(`#${p}-line`, { x: -ov.over, duration: k.type * (1 - ov.frac), ease: 'none' }, t + 0.15 + k.type * ov.frac);
  const sent = t + 0.15 + k.type + 0.3;
  const ans = sent + 0.25 + k.think;
  tap(sent, P.send, { press: `#${p}-send-on` });
  cue(sent + 0.02, 'send');
  tl.set(`#${p}-typed`, { text: '' }, sent + 0.05);
  tl.set(`#${p}-line`, { x: 0 }, sent + 0.05);
  tl.set(`#${p}-caret`, { autoAlpha: 0 }, sent + 0.05);
  tl.set(`#${p}-ph`, { autoAlpha: 1 }, sent + 0.05);
  swap(`#${p}-send-on`, `#${p}-send-off`, sent + 0.05, 0.1);
  tl.to(`#${p}-empty`, { autoAlpha: 0, duration: 0.2, ease: 'none' }, sent + 0.05);
  tl.to(`#${p}-new`, { autoAlpha: 1, duration: 0.2, ease: 'none' }, sent + 0.05);
  // The save bar comes with the first message, and wakes once there is an answer.
  tl.set(`#${p}-save`, { opacity: 0.45 }, sent + 0.05);
  tl.to(`#${p}-savebar`, { autoAlpha: 1, duration: 0.2, ease: 'none' }, sent + 0.05);
  fadeIn(`#${p}-q1`, sent + 0.1, { duration: 0.3 });
  fadeIn(`#${p}-l1`, sent + 0.25, { duration: 0.3 });
  tl.to(`#${p}-l1`, { autoAlpha: 0, duration: 0.15, ease: 'none' }, ans);
  fadeIn(`#${p}-a1`, ans, { from: 8, duration: 0.4 });
  tl.to(`#${p}-save`, { opacity: 1, duration: 0.2, ease: 'none' }, ans + 0.05);
  cue(ans, 'answer');
  tl.to(`#${p}-hl`, { backgroundSize: '100% 100%', duration: 0.6, ease: 'power2.inOut' }, ans + 0.5);
  return ans;
}

/** A scroll view's top and bottom, under the header and above the tab bar (what flexbox settles in the app). */
function fitScroll(scrollSel, scrSel) {
  const scr = $(scrSel);
  $(scrollSel).style.top = `${$('.sb-fill', scr).offsetHeight + $('.v4-bar', scr).offsetHeight}px`;
  $(scrollSel).style.bottom = `${$('.tabbar', scr).offsetHeight}px`;
}

/** A row the film points at: a soft pulse in the vault's colour. */
function pulse(sel, t, rgb = '212,128,123', a = 0.45) {
  tl.fromTo(sel, { boxShadow: `0 0 0 0px rgba(${rgb},0)` }, { boxShadow: `0 0 0 4px rgba(${rgb},${a})`, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut', ...IR }, t);
}
function glow(sel, t, rgb = '212,128,123', a = 0.14) {
  tl.fromTo(sel, { backgroundColor: `rgba(${rgb},0)` }, { backgroundColor: `rgba(${rgb},${a})`, duration: 0.35, yoyo: true, repeat: 1, ease: 'sine.inOut', ...IR }, t);
}

/** Upload's camera: the guides, the scan line, the shutter, then the photo
 * read on the next screen, and the category its words point to. Returns when
 * it has been read. */
function snapPhoto(t, { shutter, slot, cat }) {
  tl.fromTo('#cam-guides', { scale: 1.08, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ...IR }, t);
  tl.set('#cam-scan', { autoAlpha: 1 }, t + 0.2);
  tl.fromTo('#cam-scan', { y: 0 }, { y: 440, duration: 0.9, ease: 'power1.inOut', ...IR }, t + 0.2);
  tl.set('#cam-scan', { autoAlpha: 0 }, t + 1.1);
  cue(t + 0.2, 'scan', { dur: 0.9 });
  tap(t + 1.3, shutter, { press: '#cam-shutter' });
  tl.fromTo('#shutter', { autoAlpha: 0 }, { autoAlpha: 0.95, duration: 0.06, ease: 'none', ...IR }, t + 1.32);
  tl.to('#shutter', { autoAlpha: 0, duration: 0.35, ease: 'power1.out' }, t + 1.4);
  cue(t + 1.32, 'shutter');
  nav('scr-camera', 'scr-tag', t + 1.65, 'fade', 0.35);
  chrome(t + 1.65, 'app');
  tl.fromTo('#ocr-fill', { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'power1.inOut', ...IR }, t + 1.85);
  cue(t + 1.85, 'process', { dur: 1.4 });
  const r0 = t + 3.3;
  tl.to('#ocr-card', { autoAlpha: 0, duration: 0.2, ease: 'none' }, r0);
  fadeIn('#ocr-done', r0, { from: 4, duration: 0.3 });
  tl.to(slot, { height: $('#ocr-done').offsetHeight, duration: 0.3, ease: 'power2.out' }, r0);
  tl.set([`#c-${cat}-sel`, '#cat-hint'], { autoAlpha: 1 }, r0);
  cue(r0 + 0.05, 'ding');
  return r0;
}

/** Save, the Uploaded dialog, View, and the document's page scrolled down to
 * what was read off it. Returns when it has scrolled. */
function saveAndView(sv, { save, view }, scroll, doc, rgb, a = 0.14) {
  tap(sv, save, { scroll });
  tl.to('#save-busy', { autoAlpha: 1, duration: 0.12, ease: 'none' }, sv + 0.02);
  tl.to('#save-btn', { opacity: 0.7, duration: 0.12, ease: 'none' }, sv + 0.05);
  tl.set('#save-busy', { autoAlpha: 0 }, sv + 0.6);
  tl.set('#save-btn', { opacity: 1 }, sv + 0.6);
  tl.fromTo('#up-dialog', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'none', ...IR }, sv + 0.6);
  tl.fromTo('#up-dialog-box', { scale: 0.92 }, { scale: 1, duration: 0.35, ease: 'power2.out', ...IR }, sv + 0.6);
  cue(sv + 0.65, 'success');
  tap(sv + 1.3, view, { press: '#up-dialog .b.o' });
  nav('scr-tag', 'scr-doc', sv + 1.45, 'push');
  const d = sv + 2.2;
  tl.to('#dp-inner', { y: -doc, duration: 0.8, ease: 'power2.inOut' }, d);
  glow('#dp-meta-title, .dp-meta', d + 0.9, rgb, a);
  return d;
}

/** A document's share sheet, measured: it sits on the bottom edge, so it is
 * taller once the link is made, and Copy link is measured in that layout. */
function shareSetup() {
  const h = (s) => $(s).offsetHeight;
  const formH = h('#ss-form');
  const madeH = h('#ss-made');
  const noneH = h('#ss-none');
  const rowH = h('#ss-row');
  $('#ss-swap1').style.height = `${madeH}px`;
  $('#ss-swap2').style.height = `${rowH}px`;
  const copy = at('#ss-copy');
  $('#ss-swap1').style.height = `${formH}px`;
  $('#ss-swap2').style.height = `${noneH}px`;
  const P = { share: at('#dp-share'), input: at('#ss-input'), make: at('#ss-make'), copy };
  gsap.set(['#ss-made', '#ss-row', '#ss-dim'], { autoAlpha: 0 });
  gsap.set('#ss-sheet', { yPercent: 105 });
  return { madeH, rowH, P };
}

/** Share, who it is for, Make a link (7 days is chosen already), Copy link. */
function sharePlay(t, { madeH, rowH, P }, note, accent) {
  tap(t, P.share, { press: '#dp-share' });
  tl.to('#ss-dim', { autoAlpha: 1, duration: 0.25, ease: 'none' }, t + 0.1);
  tl.to('#ss-sheet', { yPercent: 0, duration: 0.4, ease: 'power3.out' }, t + 0.1);
  cue(t + 0.1, 'whoosh-soft');
  tap(t + 1.0, P.input);
  tl.set('#ss-input', { borderColor: accent }, t + 1.02);
  tl.set('#ss-caret', { autoAlpha: 1 }, t + 1.05);
  tl.set('#ss-ph', { autoAlpha: 0 }, t + 1.15);
  type('#ss-typed', note, t + 1.15, 0.7);
  tl.set('#ss-caret', { autoAlpha: 0 }, t + 2.05);
  tl.set('#ss-input', { borderColor: '#D1D5DB' }, t + 2.05);
  tap(t + 2.2, P.make, { press: '#ss-make' });
  tl.to('#ss-busy', { autoAlpha: 1, duration: 0.12, ease: 'none' }, t + 2.22);
  // The link, shown once; and it joins the document's working links.
  const m = t + 2.85;
  tl.to('#ss-form', { autoAlpha: 0, duration: 0.15, ease: 'none' }, m);
  tl.to('#ss-made', { autoAlpha: 1, duration: 0.25, ease: 'none' }, m + 0.2);
  tl.to('#ss-swap1', { height: madeH, duration: 0.35, ease: 'power2.inOut' }, m);
  tl.to('#ss-none', { autoAlpha: 0, duration: 0.15, ease: 'none' }, m);
  tl.to('#ss-row', { autoAlpha: 1, duration: 0.25, ease: 'none' }, m + 0.2);
  tl.to('#ss-swap2', { height: rowH, duration: 0.35, ease: 'power2.inOut' }, m);
  cue(m, 'ding');
  const k = m + 1.5;
  tap(k, P.copy, { press: '#ss-copy' });
  swap('#ss-copy .ss-copy-a', '#ss-copied', k + 0.02, 0.15);
  cue(k + 0.05, 'pop-soft');
  return { how: t + 0.1, callout: m + 0.3, hero: k + 0.9, end: k + 1.9 };
}

// ═════════════════════════════════════════════════════════════════════════
// THE FEATURES
// ═════════════════════════════════════════════════════════════════════════
// why / how: the short's two lines (*stars* mark the emphasis, ~ a space that
// never breaks). head / line: the poster's. The words follow CLAUDE.md: plain,
// and never more privacy than AskLocker gives.
const FEATURES = {
  // ─── Ask: a question, answered from the family's own papers ───────────
  ask: {
    theme: 'family', kicker: 'Ask', icon: 'message-circle',
    why: 'In a panic, *nobody remembers* which file has the number.',
    how: "Just ask, the way you'd ask a person.",
    head: 'Ask your documents *anything.*',
    line: 'The answer comes from your own papers, with the document it came from.',
    time: '9:41', first: 'scr-ask',
    screens: () => FAM.askScreen(),
    coY: 640,
    setup: () => askSetup('ask', 'scr-ask', "What is Papa's health insurance policy number?"),
    play(t, c) {
      const ans = askTurn('ask', t, c);
      // Kept for later, behind the clock at the top (saved-chats.tsx).
      const s = ans + 2.7;
      tap(s, c.P.save, { press: '#ask-save' });
      tl.to('#ask-saved', { autoAlpha: 1, duration: 0.18, ease: 'none' }, s + 0.02);
      fadeIn('#ask-savenote', s + 0.1, { from: 4, duration: 0.3 });
      cue(s + 0.05, 'ding');
      tl.fromTo('#ask-clock', { scale: 1 }, { scale: 1.22, duration: 0.22, yoyo: true, repeat: 1, ease: 'sine.inOut', ...IR }, s + 0.6);
      return { how: t, callout: ans + 0.8, hero: ans + 2.3, end: s + 1.5 };
    },
  },

  // ─── Read: a photo, and what is on it, the moment it is added ─────────
  read: {
    theme: 'family', kicker: 'Instant insights', icon: 'zap',
    why: 'What you need is *buried in the fine~print.*',
    how: 'Snap it. AskLocker reads it.',
    head: 'Snap a page. *Know what it says.*',
    line: 'AskLocker reads the policy number, the expiry date and the amount the moment you add it.',
    time: '9:41', first: 'scr-camera', os: true,
    screens: () => `${cameraScreen(FAM.policyPaper())}${FAM.tagScreen()}${documentScreen()}`,
    coY: 362,
    setup() {
      fitScroll('#tag-scroll', '#scr-tag');
      // Measured as it will be once the photo is read, a vault chosen and
      // "Who does this belong to?" open, then put back the way it starts.
      const slot = $('#scr-tag .ocr-slot');
      const hint = $('#scr-tag .vf-hint');
      const hintH = ['#vf-hint0', '#vf-hint1'].map((s) => $(s).offsetHeight);
      const who = $('#who');
      const whoH = who.offsetHeight;
      slot.style.height = `${$('#ocr-done').offsetHeight}px`;
      hint.style.height = `${hintH[1]}px`;
      const P = {
        shutter: at('#cam-shutter'), vault: at('#vault-field'), vmFamily: at('#vm-family'), papa: at('#p-papa'),
        save: at('#save-btn'), top: at('#tag-inner'), vaultTitle: at('#scr-tag .vf-h'), whoTitle: at('#who .up-h'),
        view: at('#up-dialog .b.o'),
      };
      const view = $('#tag-scroll').offsetHeight;
      const max = $('#tag-inner').offsetHeight - view;
      const maxBefore = max - whoH + hintH[0] - hintH[1];
      slot.style.height = '';
      hint.style.height = `${hintH[0]}px`;
      who.style.height = '0px';
      // The page opens at the top; the film scrolls down to what was read.
      const doc = $('#dp-inner').offsetHeight - $('#dp-scroll').offsetHeight;
      gsap.set(['#vf-chosen', '#vault-menu', '#vf-hint1', '#who', '#cat-hint', '#save-l1'], { autoAlpha: 0 });
      gsap.set(`#c-${FAM.HEALTH}-sel`, { autoAlpha: 0 });
      gsap.set('#save-btn', { opacity: 0.7 });
      return { slot, hint, hintH, who, whoH, P, view, max, maxBefore, doc };
    },
    play(t, c) {
      const { P } = c;
      const r0 = snapPhoto(t, { shutter: P.shutter, slot: c.slot, cat: FAM.HEALTH });
      // Where it goes, and whose it is: Sharma Family, Papa's.
      const s1 = Math.min(c.maxBefore, P.vaultTitle.top - P.top.top - 12);
      tl.to('#tag-inner', { y: -s1, duration: 0.6, ease: 'power2.inOut' }, r0 + 0.9);
      tap(r0 + 1.6, P.vault, { scroll: s1 });
      tl.to('#vault-field', { borderColor: NAVY, duration: 0.12, ease: 'none' }, r0 + 1.62);
      tl.fromTo('#vault-menu', { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.2, ...IR }, r0 + 1.65);
      tap(r0 + 2.2, P.vmFamily, { scroll: s1 });
      tl.to('#vm-family', { backgroundColor: '#EFF6FF', duration: 0.1, ease: 'none' }, r0 + 2.21);
      const v = r0 + 2.35;
      tl.to('#vault-menu', { autoAlpha: 0, duration: 0.18, ease: 'none' }, v);
      tl.to('#vault-field', { borderColor: '#D1D5DB', duration: 0.12, ease: 'none' }, v);
      swap('#vf-empty', '#vf-chosen', v, 0.15);
      swap('#vf-hint0', '#vf-hint1', v, 0.2);
      tl.to(c.hint, { height: c.hintH[1], duration: 0.3, ease: 'power2.out' }, v);
      swap('#save-l0', '#save-l1', v, 0.15);
      tl.to('#save-btn', { opacity: 1, duration: 0.15, ease: 'none' }, v);
      tl.to(c.who, { height: c.whoH, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, v + 0.05);
      const s2 = Math.min(c.max, P.whoTitle.top - P.top.top - 12);
      tl.to('#tag-inner', { y: -s2, duration: 0.55, ease: 'power2.inOut' }, v + 0.4);
      tap(v + 1.05, P.papa, { scroll: s2 });
      swap('#p-me-sel', '#p-papa-sel', v + 1.06, 0.16);
      const s3 = Math.max(s2, Math.min(c.max, P.save.top + P.save.h + 16 - (P.top.top + c.view)));
      tl.to('#tag-inner', { y: -s3, duration: 0.55, ease: 'power2.inOut' }, v + 1.4);
      // Save, then View: the document's own page, and what was read off it.
      const d = saveAndView(v + 2.1, P, s3, c.doc, '212,128,123');
      return { how: t + 0.1, callout: r0 + 0.3, hero: d + 2.3, end: d + 3.3 };
    },
  },

  // ─── Voice: Maa asks in Hindi and hears the answer ────────────────────
  voice: {
    theme: 'family', kicker: 'Voice', icon: 'mic',
    why: 'Not every parent types, *or reads~English.*',
    how: 'Ask out loud. Hear the answer.',
    head: 'Ask out loud. *Hear the answer.*',
    line: 'In nine Indian languages and English, for parents who would rather talk than type.',
    time: '9:41', first: 'scr-voice',
    screens: () => FAM.voiceScreen(''),
    // The question, read in Hindi, and the answer under it: subtitles in English.
    subs: () => {
      const v = voiceSubtitles('hi', STORY.policyNo);
      return `<div class="subline on-light" id="sub-q">${v.q}</div><div class="subline on-light" id="sub-a">${v.a1}</div>`;
    },
    fontText: `${VOICE_LINES.hi.q} ${VOICE_LINES.hi.lead} ${VOICE_LINES.hi.a2}`,
    coY: 790,
    setup() {
      askArea('#v-area', '#scr-voice');
      // While it listens, the mic is a wider ✕ Cancel pill, and the input narrower.
      const micW = $('#v-mic').offsetWidth;
      const pillW = $('#mic-listen').offsetWidth;
      $('#v-mic').style.width = `${pillW}px`;
      const VQ = VOICE_LINES.hi.q;
      const ov = inputOverflow('#v-line', VQ);
      $('#v-mic').style.width = '';
      const P = { mic: at('#v-mic') };
      const scroll = layoutChat('#v-area', [['v-q1'], ['v-l1', 'v-a1']]);
      return { micW, pillW, VQ, ov, P, scroll };
    },
    play(t, c) {
      tap(t, c.P.mic);
      cue(t, 'mic-on');
      tl.to('#v-mic', { width: c.pillW, duration: 0.2, ease: 'power2.out' }, t + 0.02);
      swap('#mic-idle', '#mic-listen', t + 0.02, 0.15);
      swap('#v-ph-idle', '#v-ph-listen', t + 0.02, 0.15);
      tl.to('#v-icon-on', { autoAlpha: 1, duration: 0.15 }, t + 0.02);
      // Maa asks; the words appear a beat behind her, as a recogniser's do.
      const q0 = t + 0.3;
      const q1 = q0 + VOICES.ask.dur;
      cue(q0, 'voice', { line: 'ask', wav: 'ask-hi.wav' });
      if (PORTRAIT) sub('sub-q', q0, q1 + 0.5);
      const typing = q1 - q0 - 0.2;
      tl.set('#v-ph-listen', { autoAlpha: 0 }, q0 + 0.3);
      type('#v-typed', c.VQ, q0 + 0.3, typing, ' ');
      if (c.ov.over) tl.to('#v-line', { x: -c.ov.over, duration: typing * (1 - c.ov.frac), ease: 'none' }, q0 + 0.3 + typing * c.ov.frac);
      // She stops speaking and the question goes by itself.
      const think = q1 + 0.4;
      tl.set('#v-typed', { text: '' }, think);
      tl.set('#v-line', { x: 0 }, think);
      swap('#mic-listen', '#mic-think', think, 0.15);
      tl.to('#v-mic', { width: c.micW, duration: 0.2, ease: 'power2.out' }, think);
      tl.to('#v-icon-on', { autoAlpha: 0, duration: 0.15 }, think);
      tl.set('#v-ph-think', { autoAlpha: 1 }, think);
      tl.to('#v-empty', { autoAlpha: 0, duration: 0.2, ease: 'none' }, think);
      tl.to('#v-new', { autoAlpha: 1, duration: 0.2, ease: 'none' }, think);
      tl.set('#v-save', { opacity: 0.45 }, think);
      tl.to('#v-savebar', { autoAlpha: 1, duration: 0.2, ease: 'none' }, think);
      fadeIn('#v-q1', think + 0.05, { duration: 0.3 });
      fadeIn('#v-l1', think + 0.2, { duration: 0.3 });
      const ans = think + 1.5;
      tl.to('#v-l1', { autoAlpha: 0, duration: 0.15, ease: 'none' }, ans);
      fadeIn('#v-a1', ans, { from: 8, duration: 0.4 });
      tl.to('#v-save', { opacity: 1, duration: 0.2, ease: 'none' }, ans + 0.05);
      tl.to('#v-stack', { y: -c.scroll('v-a1'), duration: 0.45, ease: 'power2.out' }, ans);
      swap('#mic-think', '#mic-speak', ans, 0.15);
      swap('#v-ph-think', '#v-ph-again', ans, 0.15);
      cue(ans, 'answer');
      // The answer, read aloud: its first sentence, with the number.
      const a0 = ans + 0.35;
      const a1 = a0 + VOICES.answer.sentence2;
      cue(a0, 'voice', { line: 'answer', wav: 'answer-hi.wav', to: VOICES.answer.sentence2 });
      if (PORTRAIT) sub('sub-a', a0 + 0.1, a1 + 0.1);
      tl.to('#v-hl', { backgroundSize: '100% 100%', duration: 0.6, ease: 'power2.inOut' }, a0 + VOICES.answer.number);
      swap('#mic-speak', '#mic-idle', a1 + 0.2, 0.2);
      swap('#v-stop1', '#v-again1', a1 + 0.2, 0.2);
      return { how: t, callout: think + 0.2, hero: a0 + VOICES.answer.number + 1.0, end: a1 + 0.9 };
    },
  },

  // ─── Reminders: before a policy runs out, on the lock screen ──────────
  reminders: {
    theme: 'family', kicker: 'Reminders', icon: 'bell', plus: '★ Family Plus',
    why: 'Policies lapse quietly. You find out *the day you need~one.*',
    how: 'Everyone is reminded in time.',
    head: 'Renew it *before it runs out.*',
    line: 'Everyone in the family hears 90, 30 and 7 days before a policy or passport runs out. Birthdays too.',
    time: '9:05', first: 'scr-lockday', os: true,
    screens: () => `${FAM.lockDayScreen()}${FAM.notificationsScreen()}`,
    coY: 742,
    setup: () => ({ P: { pn1: at('#pn1') } }),
    play(t, c) {
      vibrate(t);
      notify('#pn1', t + 0.05);
      vibrate(t + 0.9);
      notify('#pn2', t + 0.95);
      // Tapping it opens Notifications (public/sw.js).
      const s = t + 4.3;
      tap(s, c.P.pn1, { press: '#pn1' });
      nav('scr-lockday', 'scr-notifs', s + 0.15, 'zoom', 0.4);
      chrome(s + 0.15, 'app');
      tl.fromTo($$('#nt-list .nt-card'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.08, ...IR }, s + 0.3);
      return { how: t + 0.1, callout: t + 1.8, hero: t + 3.7, end: s + 2.3 };
    },
  },

  // ─── Family tree: everyone, and asking by relation ─────────────────────
  tree: {
    theme: 'family', kicker: 'Family tree', icon: 'git-branch',
    why: 'Everyone says “Dadi”, not *“Kamala~Sharma”.*',
    how: 'Ask by relation. It knows who you mean.',
    head: 'It knows who *“Dadi”* is.',
    line: 'One family tree, with or without accounts. Ask by relation, in English or Hindi.',
    time: '9:41', first: 'scr-home',
    screens: () => `${FAM.homeScreen()}${FAM.treeScreen()}`,
    coY: 806,
    setup() {
      // The tree opens scrolled to centre your own card (family-tree.tsx).
      const canvas = $('#tree-canvas');
      const content = $('#tree-content');
      const cb = canvas.getBoundingClientRect();
      const me = $('#tc-me').getBoundingClientRect();
      const cx = me.left + me.width / 2 - cb.left - canvas.clientLeft;
      const max = Math.max(0, content.offsetWidth - canvas.clientWidth);
      content.style.transform = `translateX(${-Math.min(max, Math.max(0, cx - canvas.clientWidth / 2))}px)`;
      const gens = [['#tc-dadi'], ['#tc-papa', '#tc-maa'], ['#tc-neha', '#tc-me', '#tc-priya'], ['#tc-aarav']];
      gsap.set(gens.flat(), { autoAlpha: 0 });
      gsap.set($$('#tree-content .vl, #tree-content .ml, #tree-content .bar'), { autoAlpha: 0 });
      return { gens, P: { avatar: at('#home-avatar'), tree: at('#dr-tree') } };
    },
    play(t, { gens, P }) {
      // Home, the drawer behind your initial, then Family tree.
      tap(t, P.avatar, { press: '#home-avatar' });
      drawer('#drawer', t + 0.08, true);
      tap(t + 0.95, P.tree, { press: '#dr-tree' });
      drawer('#drawer', t + 1.05, false);
      nav('scr-home', 'scr-tree', t + 1.2, 'push');
      // Generation by generation, as the cards settle in.
      const g = t + 1.5;
      gens.forEach((cards, i) => tl.fromTo(cards, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, ...IR }, g + i * 0.12));
      tl.fromTo($$('#tree-content .vl, #tree-content .ml, #tree-content .bar'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ...IR }, g + 0.15);
      // The ones who never sign in are in it too: Dadi, Neha, Aarav.
      [['#tc-dadi', 0.85], ['#tc-neha', 1.0], ['#tc-aarav', 1.15]].forEach(([card, k]) => pulse(card, g + k, '42,61,102', 0.28));
      // Each relation lights the card it means.
      const co = g + 2.5;
      [['#tc-papa', 0.4], ['#tc-dadi', 0.55]].forEach(([card, k]) => pulse(card, co + k));
      return { how: t + 1.2, callout: co, hero: co + 1.9, end: co + 3.0 };
    },
  },

  // ─── Emergency card: what a doctor asks, for each person ──────────────
  emergency: {
    theme: 'family', kicker: 'Emergency card', icon: 'plus-square',
    why: 'Blood group? Allergies? At 2~AM, *nobody remembers.*',
    how: 'One emergency card for each person.',
    head: 'What the doctor asks, *one tap away.*',
    line: 'Blood group, allergies, medicines and the policy number, for everyone in the family.',
    time: '9:41', first: 'scr-person',
    screens: () => `${FAM.personScreen()}${FAM.emergencyScreen()}`,
    coY: 790,
    setup: () => ({ P: { open: at('#pp-open') }, scroll: scrollTo('#em-inner', '.em-scroll', '#em-ins', 150) }),
    play(t, c) {
      tap(t, c.P.open, { press: '#pp-open' });
      nav('scr-person', 'scr-emerg', t + 0.15, 'push');
      glow('.em-allergy', t + 1.1, '185,28,28', 0.12);
      const s = t + 4.1;
      tl.to('#em-inner', { y: -c.scroll, duration: 1.0, ease: 'power2.inOut' }, s);
      tl.to('#em-hl', { backgroundSize: '100% 100%', duration: 0.6, ease: 'power2.inOut' }, s + 1.0);
      return { how: t + 0.15, callout: t + 1.9, hero: t + 3.6, end: s + 2.4 };
    },
  },

  // ─── Share: one document, by a link that ends ─────────────────────────
  share: {
    theme: 'family', kicker: 'Share by link', icon: 'link',
    why: 'Your CA needs one paper. *Not your whole vault.*',
    how: 'Send a link that expires.',
    head: 'Send one document. *Not your whole vault.*',
    line: 'A link for your CA or agent. It opens without an account, and stops working when you say.',
    time: '9:41', first: 'scr-doc',
    screens: () => documentScreen({ share: true }),
    coY: 330,
    setup: shareSetup,
    play: (t, c) => sharePlay(t, c, DOCS.policy.share.note, NAVY),
  },

  // ─── Who can open what: a vault for every document ────────────────────
  vaults: {
    theme: 'family', kicker: 'Privacy', icon: 'shield',
    why: 'Policies, IDs, medical records: *the most private papers* you~have.',
    how: 'Sent and stored encrypted.',
    head: 'Your papers, sent and stored *encrypted.*',
    line: 'In AskLocker, only your family can open them, and you choose who sees each one.',
    time: '9:41', first: 'scr-vaults',
    screens: () => vaultsScreen(),
    coY: 300,
    setup() {
      fitScroll('#vs-scroll', '#scr-vaults');
      const hint = $('#vs-hint');
      const hintH = ['#vs-h0', '#vs-h1', '#vs-h2'].map((s) => $(s).offsetHeight);
      hint.style.height = `${hintH[0]}px`;
      const P = { field: at('#vs-field'), personal: at('#vs-m-personal'), family: at('#vs-m-family') };
      gsap.set(['#vs-personal', '#vs-family', '#vs-menu', '#vs-h1', '#vs-h2', '#vs-s1', '#vs-s2'], { autoAlpha: 0 });
      gsap.set('#vs-save', { opacity: 0.7 });
      return { hint, hintH, P };
    },
    play(t, { hint, hintH, P }) {
      const open = (a) => {
        tap(a, P.field);
        tl.to('#vs-field', { borderColor: NAVY, duration: 0.12, ease: 'none' }, a + 0.02);
        tl.fromTo('#vs-menu', { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.2, ...IR }, a + 0.05);
      };
      const pick = (a, row, from, to, i) => {
        tap(a, P[row]);
        tl.to(`#vs-m-${row}`, { backgroundColor: '#EFF6FF', duration: 0.1, ease: 'none' }, a + 0.01);
        tl.to('#vs-menu', { autoAlpha: 0, duration: 0.18, ease: 'none' }, a + 0.15);
        tl.set(`#vs-m-${row}`, { backgroundColor: '#FFFFFF' }, a + 0.35);
        tl.to('#vs-field', { borderColor: '#D1D5DB', duration: 0.12, ease: 'none' }, a + 0.15);
        swap(`#vs-${from}`, `#vs-${to}`, a + 0.15, 0.15);
        swap(`#vs-h${i - 1}`, `#vs-h${i}`, a + 0.15, 0.2);
        tl.to(hint, { height: hintH[i], duration: 0.3, ease: 'power2.out' }, a + 0.15);
        swap(`#vs-s${i - 1}`, `#vs-s${i}`, a + 0.15, 0.15);
      };
      open(t);
      // Yours alone, then the family's: the hint under it says who will see it.
      const p1 = t + 2.9;
      pick(p1, 'personal', 'empty', 'personal', 1);
      tl.to('#vs-save', { opacity: 1, duration: 0.15, ease: 'none' }, p1 + 0.15);
      cue(p1 + 0.2, 'pop-soft');
      const p2 = p1 + 1.9;
      open(p2);
      pick(p2 + 0.7, 'family', 'personal', 'family', 2);
      cue(p2 + 0.9, 'pop-soft');
      return { how: t + 0.05, callout: t + 0.9, hero: t + 2.5, end: p2 + 2.4 };
    },
  },

  // ─── Fingerprint sign-in: a passkey, after Google once ────────────────
  fingerprint: {
    theme: 'family', kicker: 'Fingerprint sign-in', icon: 'aperture',
    why: 'Another password *nobody~remembers.*',
    how: 'Open it with your fingerprint.',
    head: 'Open it with *a touch.*',
    line: 'Sign in with Google once. After that, your fingerprint or face opens it.',
    time: '9:41', first: 'scr-applock',
    screens: () => `${appLockScreen()}${FAM.homeScreen()}`,
    coY: 330,
    setup() {
      const P = { unlock: at('#al-unlock'), fp: at('#pk-fp') };
      gsap.set(['#pk-dim', '#pk-ok', '#pk-hint-ok'], { autoAlpha: 0 });
      gsap.set('#pk-sheet', { yPercent: 115 });
      return { P };
    },
    play(t, { P }) {
      tap(t, P.unlock, { press: '#al-unlock' });
      tl.to('#al-busy', { autoAlpha: 1, duration: 0.12, ease: 'none' }, t + 0.05);
      tl.to('#pk-dim', { autoAlpha: 1, duration: 0.25, ease: 'none' }, t + 0.4);
      tl.to('#pk-sheet', { yPercent: 0, duration: 0.45, ease: 'power3.out' }, t + 0.4);
      cue(t + 0.4, 'whoosh-soft');
      // The sensor waits, its ring breathing; then a finger.
      tl.fromTo('#pk-ring', { scale: 0.92, autoAlpha: 0.9 }, { scale: 1.3, autoAlpha: 0, duration: 1.1, ease: 'power1.out', repeat: 2, ...IR }, t + 0.9);
      const f = t + 3.7;
      tap(f, P.fp);
      swap('#pk-icon', '#pk-ok', f + 0.25, 0.2);
      swap('#pk-hint', '#pk-hint-ok', f + 0.25, 0.2);
      tl.fromTo('#pk-ok', { scale: 0.6 }, { scale: 1, duration: 0.4, ease: 'back.out(2)', ...IR }, f + 0.25);
      cue(f + 0.3, 'success');
      tl.to('#pk-sheet', { yPercent: 115, duration: 0.35, ease: 'power3.in' }, f + 1.0);
      tl.to('#pk-dim', { autoAlpha: 0, duration: 0.3, ease: 'none' }, f + 1.05);
      nav('scr-applock', 'scr-home', f + 1.35, 'fade', 0.35);
      return { how: t + 0.4, callout: t + 1.2, hero: t + 3.0, end: f + 2.6 };
    },
  },

  // ═══ A business's: Arora Electric, on Pro ═════════════════════════════
  // ─── Capture: a supplier's bill photographed, filed and read ──────────
  'biz-capture': {
    theme: 'business', kicker: 'Capture', icon: 'camera',
    why: 'Bills arrive by email, on chat apps *and on~paper.*',
    how: 'Snap it. AskLocker files it and reads it.',
    head: 'Snap a bill. *Know what it says.*',
    line: 'AskLocker reads the GSTIN, bill number, total and due date, and files it under Purchase Bills.',
    time: '10:14', first: 'scr-camera', os: true,
    screens: () => `${cameraScreen(BUS.billPaper())}${BUS.tagScreen()}${documentScreen({ doc: 'bill' })}`,
    coY: 362,
    setup() {
      fitScroll('#tag-scroll', '#scr-tag');
      // The bill is shorter than the camera's frame: centre it.
      $('#cam-doc').style.marginTop = `${-$('#cam-doc').offsetHeight / 2}px`;
      // Measured as it will be once the photo is read, then put back.
      const slot = $('#scr-tag .ocr-slot');
      slot.style.height = `${$('#ocr-done').offsetHeight}px`;
      const P = {
        shutter: at('#cam-shutter'), save: at('#save-btn'), top: at('#tag-inner'), cat: at('#cat-hint'), view: at('#up-dialog .b.o'),
      };
      const view = $('#tag-scroll').offsetHeight;
      const max = $('#tag-inner').offsetHeight - view;
      slot.style.height = '';
      const doc = $('#dp-inner').offsetHeight - $('#dp-scroll').offsetHeight;
      gsap.set(['#cat-hint', `#c-${BUS.PURCHASE}-sel`], { autoAlpha: 0 });
      return { slot, P, view, max, doc };
    },
    play(t, c) {
      const { P } = c;
      const r0 = snapPhoto(t, { shutter: P.shutter, slot: c.slot, cat: BUS.PURCHASE });
      // Down to the category its words point to (Purchase Bills), and Save.
      const s = Math.min(c.max, Math.max(P.cat.top - P.top.top - 48, P.save.top + P.save.h + 16 - (P.top.top + c.view)));
      tl.to('#tag-inner', { y: -s, duration: 0.7, ease: 'power2.inOut' }, r0 + 0.9);
      pulse(`#c-${BUS.PURCHASE}`, r0 + 1.7, '15,92,87', 0.35);
      const d = saveAndView(r0 + 2.5, P, s, c.doc, '15,92,87', 0.12);
      return { how: t + 0.1, callout: r0 + 0.3, hero: d + 2.3, end: d + 3.3 };
    },
  },

  // ─── Ask: a question, answered from the business's own papers ─────────
  'biz-ask': {
    theme: 'business', kicker: 'Ask', icon: 'message-circle',
    why: 'When is that bill due? *Someone digs through~files.*',
    how: 'Ask anything. Get the answer and its source.',
    head: 'Ask your records *anything.*',
    line: 'Plain questions, answered from your own bills and papers, with the document it came from.',
    time: '10:14', first: 'scr-ask',
    screens: () => BUS.askScreen(),
    coY: 640,
    setup: () => askSetup('ask', 'scr-ask', `When is the ${BUS.BIZ.supplier} bill due, and how much is it?`),
    play(t, c) {
      const ans = askTurn('ask', t, c);
      return { how: t, callout: ans + 0.8, hero: ans + 2.3, end: ans + 3.8 };
    },
  },

  // ─── Overview: renewals, bills due, money in and out ──────────────────
  'biz-overview': {
    theme: 'business', kicker: 'For business', icon: 'briefcase',
    why: 'Due dates and totals sit *inside a~pile~of~bills.*',
    how: 'One overview, read from your papers.',
    head: 'Bills due, renewals, *money in and out.*',
    line: 'Read from your invoices, bills and licences, with nothing to type in.',
    time: '10:14', first: 'scr-overview',
    screens: () => BUS.overviewScreen(),
    coY: 300,
    setup() {
      // Down to the bills, then, once a bill is paid and gone, to the money.
      const bills = scrollTo('#ov-inner', '.ov-scroll', '#ov-bills', 12);
      const paidH = $('#ov-b1').offsetHeight;
      $('#ov-b1').style.display = 'none';
      const money = scrollTo('#ov-inner', '.ov-scroll', '#ov-note', $('.ov-scroll').offsetHeight - $('#ov-note').offsetHeight - 24);
      $('#ov-b1').style.display = '';
      gsap.set($$('.ov-bar'), { scaleY: 0, transformOrigin: '50% 100%' });
      return { bills, paidH, money, P: { paid: at('#ov-b1-paid') } };
    },
    play(t, c) {
      glow('#ov-renewals .ov-row:first-child', t, '15,92,87', 0.1);
      const b0 = t + 0.9;
      tl.to('#ov-inner', { y: -c.bills, duration: 0.7, ease: 'power2.inOut' }, b0);
      tap(b0 + 1.05, c.P.paid, { scroll: c.bills, press: '#ov-b1-paid' });
      tl.to('#ov-b1', { autoAlpha: 0, duration: 0.2, ease: 'none' }, b0 + 1.15);
      tl.fromTo('#ov-b1', { height: c.paidH }, { height: 0, paddingTop: 0, paddingBottom: 0, borderTopWidth: 0, duration: 0.35, ease: 'power2.inOut', ...IR }, b0 + 1.3);
      tl.set('#ov-pay-total', { text: '₹36,580' }, b0 + 1.3);
      tl.set('#ov-tile-bills', { text: '2' }, b0 + 1.3);
      cue(b0 + 1.15, 'ding');
      // Money in and out, month by month: Pro.
      const m0 = b0 + 2.3;
      tl.to('#ov-inner', { y: -c.money, duration: 0.8, ease: 'power2.inOut' }, m0);
      tl.to($$('.ov-bar'), { scaleY: 1, duration: 0.6, ease: 'power3.out', stagger: 0.04 }, m0 + 0.5);
      cue(m0 + 0.5, 'process', { dur: 0.8 });
      return { how: t, callout: t + 1.9, hero: m0 + 1.9, end: m0 + 2.9 };
    },
  },

  // ─── Reminders: a renewal and a note's reminder, on the lock screen ───
  'biz-reminders': {
    theme: 'business', kicker: 'Reminders', icon: 'bell', plus: '★ Plus',
    why: 'Licences and policies lapse quietly, *and then cost~you.*',
    how: 'Reminded before anything lapses.',
    head: 'Renew it *before it lapses.*',
    line: 'Everyone in the business hears before a licence or policy runs out. Your own notes remind you too.',
    time: '9:05', first: 'scr-lockday', os: true,
    screens: () => `${BUS.lockDayScreen()}${BUS.notesScreen()}`,
    coY: 742,
    setup: () => ({ P: { pn2: at('#pn2'), nn1: at('#nn-1 .nn-check') } }),
    play(t, { P }) {
      vibrate(t);
      notify('#pn1', t + 0.05);
      vibrate(t + 0.9);
      notify('#pn2', t + 0.95);
      // The note's reminder opens My notes; the call made, it is ticked off.
      const s = t + 4.3;
      tap(s, P.pn2, { press: '#pn2' });
      nav('scr-lockday', 'scr-notes', s + 0.15, 'zoom', 0.4);
      chrome(s + 0.15, 'app', '9:06');
      const d = s + 1.5;
      tap(d, P.nn1);
      swap('#nn-1 .nn-off', '#nn-1 .nn-on', d + 0.02, 0.15);
      tl.to('#nn-1 .nn-t', { color: '#6B7280', duration: 0.15, ease: 'none' }, d + 0.02);
      tl.set('#nn-1 .nn-t', { textDecoration: 'line-through' }, d + 0.02);
      cue(d + 0.05, 'ding');
      return { how: t + 0.1, callout: t + 1.8, hero: t + 3.7, end: d + 1.5 };
    },
  },

  // ─── Team: the CA invited, and pending until she accepts ──────────────
  'biz-team': {
    theme: 'business', kicker: 'Team', icon: 'users',
    why: 'Your CA wants the papers *every single~month.*',
    how: 'Invite your team and your CA.',
    head: 'Your team and your CA, *by invitation.*',
    line: 'They join only when they accept. What someone adds stays with the business, even after they leave.',
    time: '10:14', first: 'scr-team',
    screens: () => BUS.teamScreen(),
    coY: 720,
    setup() {
      // The banner and the pending invitation open once it is sent.
      const banner = $('#tm-banner');
      const pending = $('#tm-pending');
      const h = { banner: banner.offsetHeight, pending: pending.offsetHeight };
      const P = { add: at('#tm-add'), email: at('#tm-email'), shown: at('#tm-shown'), send: at('#tm-send') };
      banner.style.height = '0px';
      pending.style.height = '0px';
      gsap.set([banner, pending, '#tm-dim'], { autoAlpha: 0 });
      gsap.set('#tm-sheet', { yPercent: 105 });
      return { banner, pending, h, P };
    },
    play(t, { banner, pending, h, P }) {
      // Add: their email, and the name the team will see.
      tap(t, P.add, { press: '#tm-add' });
      tl.to('#tm-dim', { autoAlpha: 1, duration: 0.25, ease: 'none' }, t + 0.1);
      tl.to('#tm-sheet', { yPercent: 0, duration: 0.4, ease: 'power3.out' }, t + 0.1);
      cue(t + 0.1, 'whoosh-soft');
      tap(t + 0.85, P.email);
      tl.to('#tm-email', { borderColor: TEAL, duration: 0.1, ease: 'none' }, t + 0.87);
      tl.set('#tm-email-ph', { autoAlpha: 0 }, t + 0.95);
      type('#tm-email-typed', BUS.BIZ.caEmail, t + 0.95, 0.95);
      tap(t + 2.15, P.shown);
      tl.to('#tm-email', { borderColor: '#D1D5DB', duration: 0.1, ease: 'none' }, t + 2.17);
      tl.to('#tm-shown', { borderColor: TEAL, duration: 0.1, ease: 'none' }, t + 2.17);
      tl.set('#tm-shown-ph', { autoAlpha: 0 }, t + 2.25);
      type('#tm-shown-typed', BUS.BIZ.caShown, t + 2.25, 0.8);
      const s = t + 3.4;
      tap(s, P.send, { press: '#tm-send' });
      tl.to('#tm-shown', { borderColor: '#D1D5DB', duration: 0.1, ease: 'none' }, s + 0.02);
      tl.to('#tm-sheet', { yPercent: 105, duration: 0.35, ease: 'power3.in' }, s + 0.1);
      tl.to('#tm-dim', { autoAlpha: 0, duration: 0.3, ease: 'none' }, s + 0.15);
      // Asked, not added: she shows as Pending approval until she accepts.
      tl.to(banner, { height: h.banner, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, s + 0.4);
      tl.to(pending, { height: h.pending, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, s + 0.5);
      cue(s + 0.45, 'success');
      pulse('#tm-pending .tm-card', s + 1.3, '183,121,31', 0.35);
      return { how: t, callout: s + 0.8, hero: s + 2.4, end: s + 4.2 };
    },
  },

  // ─── Share: one bill, by a link that ends ─────────────────────────────
  'biz-share': {
    theme: 'business', kicker: 'Share by link', icon: 'link',
    why: 'Your CA needs this one bill, *right~now.*',
    how: 'Send a link that expires.',
    head: 'Send one record. *Not the whole vault.*',
    line: 'A link for your CA, bank or buyer. It opens without an account, and stops working when you say.',
    time: '10:14', first: 'scr-doc',
    screens: () => documentScreen({ doc: 'bill', share: true }),
    coY: 330,
    setup: shareSetup,
    play: (t, c) => sharePlay(t, c, DOCS.bill.share.note, TEAL),
  },

  // ─── Access and control: who is in, and as what ──────────────────────
  'biz-access': {
    theme: 'business', kicker: 'Access and control', icon: 'shield',
    why: 'Invoices, payroll, contracts: *the papers a business runs~on.*',
    how: 'Sent and stored encrypted.',
    head: 'Your records, sent and stored *encrypted.*',
    line: 'In AskLocker, only your team can open them, and admins decide who joins.',
    time: '10:14', first: 'scr-home',
    screens: () => `${BUS.homeScreen()}${BUS.teamScreen()}${BUS.notesScreen()}`,
    coY: 330,
    setup() {
      // Manage team as it is before anyone is asked: no banner, no invitation.
      $('#tm-banner').style.height = '0px';
      $('#tm-pending').style.height = '0px';
      gsap.set(['#tm-banner', '#tm-pending', '#tm-dim'], { autoAlpha: 0 });
      gsap.set('#tm-sheet', { yPercent: 105 });
      return { P: { avatar: at('#scr-home-avatar'), team: at('#dr-team'), notes: at('#dr-notes'), back: at('#scr-team .v4-back') } };
    },
    play(t, { P }) {
      const open = (a, row, to, from = 'scr-home') => {
        tap(a, P.avatar, { press: '#scr-home-avatar' });
        drawer('#drawer', a + 0.08, true);
        tap(a + 0.95, P[row], { press: `#dr-${row}` });
        drawer('#drawer', a + 1.05, false);
        nav(from, to, a + 1.2, 'push');
      };
      // Manage team: who is in, and as what (one admin, and viewers).
      open(t, 'team', 'scr-team');
      const r = t + 1.9;
      ['#tm-me', '#tm-ravi', '#tm-sunil'].forEach((card, i) => pulse(card, r + i * 0.18, '15,92,87', 0.3));
      glow('.tm-only', r + 1.0, '15,92,87', 0.1);
      // Then My notes: each person's own, which nobody else in the team opens.
      const b = r + 2.2;
      tap(b, P.back, { press: '#scr-team .v4-back' });
      nav('scr-team', 'scr-home', b + 0.1, 'back', 0.4);
      open(b + 0.8, 'notes', 'scr-notes');
      glow('.nn-intro', b + 2.6, '15,92,87', 0.12);
      return { how: t + 1.2, callout: r + 0.2, hero: r + 1.9, end: b + 4.2 };
    },
  },

  // ─── Spreadsheets: an .xlsx read when it is added, then asked ─────────
  'biz-sheets': {
    theme: 'business', kicker: 'Spreadsheets', icon: 'grid',
    why: '245 rows, three sheets, *and one number you need.*',
    how: 'AskLocker reads it. You just ask.',
    head: 'Ask your Excel sheets *in plain words.*',
    line: 'Add an .xlsx or .csv. AskLocker reads every row, and answers from them.',
    time: '10:14', first: 'scr-sheet',
    screens: () => `${sheetTagScreen()}${sheetAskScreen()}`,
    coY: 760,
    setup() {
      fitScroll('#sh-scroll', '#scr-sheet');
      const slot = $('#sh-slot');
      const doneH = $('#sh-done').offsetHeight;
      slot.style.height = `${doneH}px`;
      const P = {
        save: at('#sh-save'), top: at('#sh-inner'), cat: at('#sh-hint'), done: at('#sh-dialog .b.f'),
        ask: at('#scr-sheet .search-btn'),
      };
      const view = $('#sh-scroll').offsetHeight;
      const max = $('#sh-inner').offsetHeight - view;
      slot.style.height = '';
      const ask = askSetup('sa', 'scr-sask', SHEET_Q);
      gsap.set(['#sh-done', '#sh-hint', `#sc-${SALES}-sel`], { autoAlpha: 0 });
      gsap.set('#sh-fill', { scaleX: 0 });
      return { slot, doneH, P, view, max, ask };
    },
    play(t, c) {
      const { P } = c;
      tl.fromTo('#sh-fill', { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: 'power1.inOut', ...IR }, t);
      cue(t, 'process', { dur: 1.3 });
      // Read: every row, and the category its first rows point to.
      const r0 = t + 1.4;
      tl.to('#sh-card', { autoAlpha: 0, duration: 0.2, ease: 'none' }, r0);
      fadeIn('#sh-done', r0, { from: 4, duration: 0.3 });
      tl.to(c.slot, { height: c.doneH, duration: 0.3, ease: 'power2.out' }, r0);
      tl.set([`#sc-${SALES}-sel`, '#sh-hint'], { autoAlpha: 1 }, r0);
      cue(r0 + 0.05, 'ding');
      const s = Math.min(c.max, Math.max(P.cat.top - P.top.top - 48, P.save.top + P.save.h + 16 - (P.top.top + c.view)));
      tl.to('#sh-inner', { y: -s, duration: 0.7, ease: 'power2.inOut' }, r0 + 0.9);
      pulse(`#sc-${SALES}`, r0 + 1.6, '15,92,87', 0.35);
      const sv = r0 + 2.3;
      tap(sv, P.save, { scroll: s });
      tl.to('#sh-busy', { autoAlpha: 1, duration: 0.12, ease: 'none' }, sv + 0.02);
      tl.to('#sh-save', { opacity: 0.7, duration: 0.12, ease: 'none' }, sv + 0.05);
      tl.set('#sh-busy', { autoAlpha: 0 }, sv + 0.6);
      tl.set('#sh-save', { opacity: 1 }, sv + 0.6);
      tl.fromTo('#sh-dialog', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'none', ...IR }, sv + 0.6);
      tl.fromTo('#sh-dialog-box', { scale: 0.92 }, { scale: 1, duration: 0.35, ease: 'power2.out', ...IR }, sv + 0.6);
      cue(sv + 0.65, 'success');
      tap(sv + 1.3, P.done, { press: '#sh-dialog .b.f' });
      tl.to('#sh-dialog', { autoAlpha: 0, duration: 0.2, ease: 'none' }, sv + 1.4);
      // Then Ask, about what it read.
      tap(sv + 1.95, P.ask, { press: '#scr-sheet .search-btn' });
      nav('scr-sheet', 'scr-sask', sv + 2.05, 'fade', 0.35);
      const ans = askTurn('sa', sv + 2.75, c.ask, { type: 1.5, think: 1.3 });
      return { how: t, callout: r0 + 0.3, hero: ans + 1.6, end: ans + 2.7 };
    },
  },
};

// ═════════════════════════════════════════════════════════════════════════
// THE COMPOSITION
// ═════════════════════════════════════════════════════════════════════════
const NAME = new URLSearchParams(location.search).get('feature') || 'ask';
const F = FEATURES[NAME];
if (!F) throw new Error(`No feature "${NAME}": one of ${Object.keys(FEATURES).join(', ')}`);
const BIZ = F.theme === 'business';

// *stars* mark a poster headline's emphasis, as rich() does a why's.
const emph = (s) => s.replace(/\*([^*]+)\*/g, '<span class="em">$1</span>');

function posterText() {
  return `<div class="pst" id="pst">
      <div class="pst-kicker">${icon(F.icon, 22, 'currentColor', 2.4)}<span>${F.kicker}</span>${F.plus ? `<span class="k-plus">${F.plus}</span>` : ''}</div>
      <div class="pst-h">${emph(F.head)}</div>
      <div class="pst-sub">${F.line}</div>
    </div>
    <div class="pst-brand"><div class="logo-tile">${logoMark()}</div><b>AskLocker</b><span>asklocker.com</span></div>
    <div class="pst-halo" id="pst-halo"></div><div class="pst-ring" id="pst-ring1"></div><div class="pst-ring r2" id="pst-ring2"></div>`;
}

function shortText() {
  const end = BIZ
    ? brand('endcard', BUS.BIZ.tagline, { badge: 'For business', cta: BUS.BIZ.cta, ctaNote: 'Free to start', url: 'asklocker.com', end: true })
    : brand('endcard', 'Every family document. One question away.', { cta: STORY.cta, ctaNote: 'Free to start', url: 'asklocker.com', end: true });
  // No paragraph under the how: the callout takes its place.
  return `${whyHow('t-f', F.kicker, F.icon, F.why, F.how, '', { plus: F.plus || '' })}${end}`;
}

// The phone: centred under the words in a short, on the right on a poster.
const PHONE = PORTRAIT ? [540, 1172, 1.04] : SQUARE ? [800, 556, 0.94] : [1450, 545, 1.0];
const callout = CALLOUTS[F.callout || NAME]().replace('class="callout"', `class="callout${PORTRAIT ? '' : ' pst-callout'}"`);

await build({
  cards: '', texts: PORTRAIT ? shortText() : posterText(), phone: phoneShell(F.screens(), F.time), callouts: callout,
  subs: PORTRAIT && F.subs ? F.subs() : '', look: `${BIZ ? 'formal biz-look ' : ''}feature`, fontText: F.fontText || '',
});

// ─── Layout passes, then the taps, measured before anything moves ───────
const C = F.setup();

// ─── Initial state ───────────────────────────────────────────────────────
initialState();
// Daylight from the first frame, in the vault's colours.
gsap.set('#bg-day', { autoAlpha: 1, clipPath: 'none' });
gsap.set('#vignette', { autoAlpha: 0 });
gsap.set(`#${F.first}`, { autoAlpha: 1, zIndex: nextZ() });
gsap.set('#hb-dark', { autoAlpha: F.os ? 0 : 1 });
gsap.set('#hb-light', { autoAlpha: F.os ? 1 : 0 });

function stageTop(el) {
  let y = 0;
  for (let n = el; n && n.id !== 'stage'; n = n.offsetParent) y += n.offsetTop;
  return y;
}
const L = { dayPhone: PHONE };
if (PORTRAIT) {
  // Once the how has been read, the callout takes its place above the phone,
  // as large as that room allows.
  const co = $('#co-f');
  const top = stageTop($('#t-f .wh-how'));
  const bottom = PHONE[1] - (868 * PHONE[2]) / 2 - 36;
  const s = Math.min(1.75, (bottom - top) / co.offsetHeight, 920 / co.offsetWidth);
  L.coF = [W / 2, top + (co.offsetHeight * s) / 2, s];
} else {
  // Beside the phone, over its edge but short of anything on its screen: at
  // the feature's height in 16:9, under the words in 1:1.
  const s = SQUARE ? 0.84 : 1;
  const edge = PHONE[0] - (414 / 2 - 12) * PHONE[2] + (SQUARE ? 14 : 22);
  L.coF = [edge - ($('#co-f').offsetWidth * s) / 2, SQUARE ? 818 : F.coY, s];
}
if (!PORTRAIT) {
  gsap.set('#fade', { autoAlpha: 0 });
  gsap.set($$('#texts > *'), { autoAlpha: 1 });
  // A glow behind the phone, and two rings around it.
  const [x, y, s] = PHONE;
  const d = 868 * s;
  [['#pst-halo', 1.45], ['#pst-ring1', 1.06], ['#pst-ring2', 1.32]].forEach(([el, k]) => {
    gsap.set(el, { width: d * k, height: d * k });
    place(el, [x, y]);
  });
}
place('#phone', PHONE, { autoAlpha: PORTRAIT ? 0 : 1 });
setLayout(L, { 'co-f': 'coF' });

/** The callout, then what it lists, one by one. */
function calloutIn(t) {
  if (PORTRAIT) {
    tl.fromTo('#co-f', { autoAlpha: 0, y: '+=30' }, { autoAlpha: 1, y: '-=30', duration: 0.7, ...IR }, t);
    cue(t + 0.05, 'pop');
  } else showCallout('#co-f', t);
  const co = $('#co-f');
  const items = $$(':scope > *:not(.co-label)', co);
  const steps = $('.co-steps', co);
  const langs = $$('.co-lang', co);
  if (steps) {
    tl.fromTo($('.track', steps), { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.inOut', ...IR }, t + 0.2);
    tl.fromTo($$('.co-step', steps), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.16, ...IR }, t + 0.2);
  }
  if (langs.length) tl.fromTo(langs, { autoAlpha: 0, y: 10, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.05, ease: 'back.out(1.6)', ...IR }, t + 0.2);
  const rest = items.filter((el) => el !== steps && !el.classList.contains('co-lgrid'));
  tl.fromTo(rest, { autoAlpha: 0, x: 14 }, { autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.12, ...IR }, t + (steps || langs.length ? 0.85 : 0.2));
}

// ═════════════════════════════════════════════════════════════════════════
const S = {};
if (PORTRAIT) {
  // ─── The short: why, then how while the phone does it, then the end card
  cue(0, 'section', { name: 'feature', look: F.theme });
  tl.to('#fade', { autoAlpha: 0, duration: 0.6, ease: 'power1.inOut' }, 0);
  showWhy('t-f', 0.3);
  phoneIn(0.45);
  chrome(0, F.os ? 'os' : 'app', F.time);
  // The phone's work starts once the why has been read.
  const r = F.play(2.6, C);
  showHow('t-f', r.how);
  cue(r.how, 'section', { name: 'how' });
  // The how stays long enough to be read, then the callout takes its place.
  const c = Math.max(r.callout, r.how + 2.8);
  tl.to('#t-f .wh-how', { autoAlpha: 0, y: -20, duration: 0.35, ease: 'power2.in' }, c - 0.4);
  calloutIn(c);
  // Off it goes, and the end card.
  const e = r.end;
  hide('#t-f', e - 0.5);
  hide('#co-f', e - 0.6, { y: '-=20' });
  tl.to('#phone', { autoAlpha: 0, y: '+=60', duration: 0.55, ease: 'power2.in' }, e - 0.4);
  const t0 = e + 0.3;
  cue(t0, 'section', { name: 'end' });
  cue(t0, 'whoosh');
  tl.set('#endcard', { autoAlpha: 1 }, t0);
  tl.fromTo('#end-logo', { scale: 0.4, rotation: -14, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 1.0, ease: 'back.out(1.7)', ...IR }, t0 + 0.05);
  cue(t0 + 0.1, 'pop');
  bubblePop('#end-logo', t0 + 0.6);
  tl.fromTo('#end-word', { clipPath: 'inset(0% 100% 0% 0%)', y: 12 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.8, ...IR }, t0 + 0.55);
  let k = t0 + 1.15;
  if ($('#end-badge')) {
    tl.fromTo('#end-badge', { autoAlpha: 0, scale: 0.9, y: 8 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.6)', ...IR }, k);
    cue(k + 0.05, 'pop-soft');
    k += 0.45;
  }
  fadeIn('#end-tag', k, { from: 16, duration: 0.7 });
  tl.fromTo('#end-cta', { autoAlpha: 0, scale: 0.9, y: 16 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.7, ease: 'back.out(1.6)', ...IR }, k + 0.6);
  cue(k + 0.65, 'pop-soft');
  fadeIn('#end-note', k + 1.0, { from: 10, duration: 0.6 });
  fadeIn('#end-url', k + 1.2, { from: 8 });
  Object.assign(S, { how: r.how, callout: c, end: e, card: t0, hero: r.hero });
  S.total = k + 3.4;
} else {
  // ─── The poster: everything in place; the phone does its work, and the
  // still is taken at its moment.
  chrome(0, F.os ? 'os' : 'app', F.time);
  const r = F.play(0.4, C);
  calloutIn(r.callout);
  S.hero = r.hero;
  S.total = r.end + 0.5;
}

finish(S);
