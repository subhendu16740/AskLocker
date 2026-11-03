// The choreography the films share: Ask's question and answer, the camera's
// snap and read, saving and viewing a document, and its share sheet. Moved
// here from src/features.js unchanged, so the privacy film can use them too.
import { gsap, $, askArea, inputOverflow, at, layoutChat, tl, cue, IR, fadeIn, swap, nav, chrome, tap, type } from './engine.js';

/** Ask's chat area, the question's overflow and the taps, measured before anything moves. */
export function askSetup(p, scr, Q) {
  askArea(`#${p}-area`, `#${scr}`);
  const ov = inputOverflow(`#${p}-line`, Q);
  const P = { input: at($(`#${p}-typed`).closest('.ask-inputbox')), send: at(`#${p}-send-on`), save: at(`#${p}-save`) };
  layoutChat(`#${p}-area`, [[`${p}-q1`], [`${p}-l1`, `${p}-a1`]]);
  return { Q, ov, P };
}

/** A question typed and sent, and its answer (search.tsx). Returns when the answer shows. */
export function askTurn(p, t, { Q, ov, P }, k = { type: 1.8, think: 1.3 }) {
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
export function fitScroll(scrollSel, scrSel) {
  const scr = $(scrSel);
  $(scrollSel).style.top = `${$('.sb-fill', scr).offsetHeight + $('.v4-bar', scr).offsetHeight}px`;
  $(scrollSel).style.bottom = `${$('.tabbar', scr).offsetHeight}px`;
}

/** A row the film points at: a soft pulse in the vault's colour. */
export function pulse(sel, t, rgb = '212,128,123', a = 0.45) {
  tl.fromTo(sel, { boxShadow: `0 0 0 0px rgba(${rgb},0)` }, { boxShadow: `0 0 0 4px rgba(${rgb},${a})`, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut', ...IR }, t);
}
export function glow(sel, t, rgb = '212,128,123', a = 0.14) {
  tl.fromTo(sel, { backgroundColor: `rgba(${rgb},0)` }, { backgroundColor: `rgba(${rgb},${a})`, duration: 0.35, yoyo: true, repeat: 1, ease: 'sine.inOut', ...IR }, t);
}

/** Upload's camera: the guides, the scan line, the shutter, then the photo
 * read on the next screen, and the category its words point to. Returns when
 * it has been read. */
export function snapPhoto(t, { shutter, slot, cat }) {
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
export function saveAndView(sv, { save, view }, scroll, doc, rgb, a = 0.14) {
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
export function shareSetup() {
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
export function sharePlay(t, { madeH, rowH, P }, note, accent) {
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
