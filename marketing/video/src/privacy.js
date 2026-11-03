// What AskLocker does with a family's documents, in plain words: where they
// are kept, who can open them, what the AI is sent to answer a question, what
// stays on the phone, every outside service, and how to take it all back.
// Built on src/engine.js with the family film's screens and its own
// (src/privacy-screens.js, which says where each claim comes from).
//
//   ?film=privacy                               the full film, 16:9
//   ?film=privacy&orientation=portrait          the full film, 9:16
//   ?film=privacy&reel=ai&orientation=portrait  one Instagram reel, 9:16:
//       ai (what the AI sees), who (who can open them), where (where they
//       go), control (taking it back)
//
// Every scene asks what people ask (Question), then answers it plainly
// (Answer), while a diagram or the phone shows it.
import {
  gsap, PORTRAIT, W, $, $$, build, at, place, initialState, setLayout, tl, cue, IR, showWhy, showHow, hide, fadeIn,
  nextZ, chrome, tap, type, phoneIn, bubblePop, finish,
} from './engine.js';
import { phoneShell, cameraScreen } from './parts.js';
import * as FAM from './family-screens.js';
import { documentScreen, DOCS } from './feature-screens.js';
import { askSetup, askTurn, fitScroll, pulse, snapPhoto, shareSetup, sharePlay } from './kit.js';
import * as PV from './privacy-screens.js';

const NAVY = '#2A3D66';
const REEL = new URLSearchParams(location.search).get('reel') || '';
const FULL = !REEL;

// ─── The scenes: words, and what shows them ──────────────────────────────
const SCENES = {
  kept: {
    kicker: "Where they're kept", icon: 'database', visual: '#dg-path',
    q: 'Where do my documents *actually go?*', a: "Encrypted on the way, and where they're kept.",
    sub: "They're stored in Mumbai, India.",
  },
  who: {
    kicker: 'Who can open them', icon: 'eye', visual: '#dg-who',
    q: 'Who can *open them?*', a: 'People in your vault. Nobody else on AskLocker.',
    sub: 'And here is the whole list.',
  },
  vault: {
    kicker: 'Your vault', icon: 'users', screen: 'scr-members', callout: 'co-vault',
    q: 'Can anyone *join my vault?*', a: 'Only people you invite, once they say yes.',
    sub: 'Your personal vault is yours alone.',
  },
  share: {
    kicker: 'Sending one document', icon: 'link', screen: 'scr-doc', callout: 'co-share',
    q: 'Your CA needs *one paper?*', a: 'Send that one document, not your vault.',
    sub: 'A link that stops when you say.',
  },
  ai: {
    kicker: 'What the AI sees', icon: 'cpu', screen: 'scr-ask', visual: '#dg-ai',
    q: 'What does the AI *actually see?*', a: 'Your question, and the passages that match.',
    sub: 'Never your files. Never your whole vault.',
  },
  device: {
    kicker: 'On your phone', icon: 'smartphone', screen: 'scr-camera', callout: 'co-device',
    q: 'What happens *on my phone?*', a: 'Photos are read right here.',
    sub: "If your phone can't read one, OCR.space tries.",
  },
  others: {
    kicker: 'Every service', icon: 'list', visual: '#dg-ledger',
    q: 'Who else *gets anything?*', a: 'Every service, and what it gets.',
    sub: 'Each keeps it under its own privacy policy.',
  },
  control: {
    kicker: "You're in control", icon: 'sliders', screen: 'scr-delete', callout: 'co-control',
    q: 'Can I take it *all back?*', a: 'Delete your account, and it goes at once.',
    sub: 'Copies in backups and logs expire on their own.',
  },
};
const FILM_ORDER = ['kept', 'who', 'vault', 'share', 'ai', 'device', 'others', 'control'];
// One reel a week for a month.
const REELS = { ai: ['ai'], who: ['who', 'vault'], where: ['kept', 'device'], control: ['share', 'control'] };
if (REEL && !REELS[REEL]) throw new Error(`No reel "${REEL}": one of ${Object.keys(REELS).join(', ')}`);
const ORDER = FULL ? FILM_ORDER : REELS[REEL];
const uses = (k) => ORDER.includes(k);
const kicker = (k) => (FULL ? `${String(FILM_ORDER.indexOf(k) + 1).padStart(2, '0')} · ` : '') + SCENES[k].kicker;

// ─── The stage ───────────────────────────────────────────────────────────
const texts = (FULL ? PV.openLines() + PV.titleCard() : '')
  + ORDER.map((k) => PV.qa(`t-${k}`, kicker(k), SCENES[k].icon, SCENES[k].q, SCENES[k].a, SCENES[k].sub)).join('')
  + (FULL ? PV.closeBlock() : '') + PV.endCard();
const cards = (FULL ? PV.openCards() : '') + (uses('kept') ? PV.pathDiagram() : '') + (uses('who') ? PV.whoDiagram() : '')
  + (uses('ai') ? PV.aiDiagram() : '') + (uses('others') ? PV.ledgerDiagram() : '');
const screens = [
  uses('ai') && FAM.askScreen(), uses('vault') && PV.membersScreen(), uses('share') && documentScreen({ share: true }),
  uses('device') && `${cameraScreen(FAM.policyPaper())}${FAM.tagScreen()}`, uses('control') && PV.deleteScreen(),
].filter(Boolean).join('');
const callouts = ['vault', 'share', 'device', 'control'].filter(uses).map((k) => PV.PV_CALLOUTS[k]()).join('');

await build({ cards, texts, phone: phoneShell(screens, '9:41'), callouts, subs: '', look: 'privacy' });

// ─── Layout passes, and the taps, measured before anything moves ────────
const C = {};
if (uses('ai')) C.ai = askSetup('ask', 'scr-ask', PV.AI_Q);
if (uses('share')) C.share = shareSetup();
if (uses('device')) {
  fitScroll('#tag-scroll', '#scr-tag');
  // As Upload is before a photo is read: no vault chosen, nobody's yet.
  $('#who').style.height = '0px';
  $('#scr-tag .vf-hint').style.height = `${$('#vf-hint0').offsetHeight}px`;
  gsap.set(['#vf-chosen', '#vault-menu', '#vf-hint1', '#who', '#cat-hint', '#save-l1'], { autoAlpha: 0 });
  gsap.set(`#c-${FAM.HEALTH}-sel`, { autoAlpha: 0 });
  gsap.set('#save-btn', { opacity: 0.7 });
  C.device = { slot: $('#scr-tag .ocr-slot'), shutter: at('#cam-shutter') };
}
if (uses('control')) C.control = { field: at('#del-field'), btn: at('#del-btn') };

// ─── Initial state ───────────────────────────────────────────────────────
initialState();
// Whatever fades in later on a card or a screen starts hidden; a reel sets
// only what it has.
const hidden = $$('.pv-dg, .pv-doc, #t-open, #t-before, #t-close, #pv-title, #pv-close-sub, #pv-url, #mf-notice');
if (hidden.length) gsap.set(hidden, { autoAlpha: 0 });
gsap.set('#hb-dark', { autoAlpha: 1 });
gsap.set('#hb-light', { autoAlpha: 0 });
if (!FULL) {
  // A reel is daylight from its first frame, which Instagram shows before it plays.
  gsap.set('#bg-day', { autoAlpha: 1, clipPath: 'none' });
  gsap.set(['#vignette', '#fade'], { autoAlpha: 0 });
}

function stageTop(el) {
  let y = 0;
  for (let n = el; n && n.id !== 'stage'; n = n.offsetParent) y += n.offsetTop;
  return y;
}

// The phone, and where things sit beside it. In 9:16 everything stays above
// the platforms' captions (Reels draws over the bottom 350 px).
const SAFE_BOTTOM = 1570;
const PHONE = PORTRAIT ? [540, 1150, 0.98] : [1270, 548, 0.94];
const L = { dayPhone: PHONE };
place('#phone', PHONE, { autoAlpha: 0 });
const phoneTop = PHONE[1] - (868 * PHONE[2]) / 2;

// A callout: beside the phone in 16:9; in 9:16 it takes the answer's place
// above the phone once the answer has been read, as large as the room allows.
const CO = {};
for (const k of ORDER) {
  const id = SCENES[k].callout;
  if (!id) continue;
  const co = $(`#${id}`);
  if (PORTRAIT) {
    const top = stageTop($(`#t-${k} .wh-how`));
    const s = Math.min(1.75, (phoneTop - 36 - top) / co.offsetHeight, 920 / co.offsetWidth);
    L[id] = [W / 2, top + (co.offsetHeight * s) / 2, s];
  } else {
    L[id] = [1640, 700, 1];
  }
  CO[id] = id;
}
setLayout(L, CO);

// A diagram: in the right half in 16:9; in 9:16 under the answer, as large
// as the room above the platforms' captions allows.
function placeVisual(sel, key) {
  const el = $(sel);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (PORTRAIT) {
    // Centred in the room between the answer and the captions' edge.
    const top = stageTop($(`#t-${key} .wh-how`)) + $(`#t-${key} .wh-how`).offsetHeight + 40;
    const s = Math.min(1.12, (SAFE_BOTTOM - top) / h, 960 / w);
    place(el, [W / 2, (top + SAFE_BOTTOM) / 2, s]);
  } else {
    const s = Math.min(1, 900 / h, 860 / w);
    place(el, [1420, 540, s]);
  }
}
for (const k of ORDER) if (SCENES[k].visual && k !== 'ai') placeVisual(SCENES[k].visual, k);

// ─── Helpers ─────────────────────────────────────────────────────────────
// Entrances hide what they bring in from the first frame (immediateRender),
// so nothing shows early when its diagram does.
const SHOWN = { immediateRender: true };
const pop = (sel, t, from = 0.86) => tl.fromTo(sel, { autoAlpha: 0, scale: from }, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(1.6)', ...SHOWN }, t);
const rise = (sel, t, { y = 26, ...extra } = {}) => tl.fromTo(sel, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration: 0.6, ...extra, ...SHOWN }, t);

let onScreen = null;
/** The phone comes in (or stays), showing a screen. */
function phoneShow(t, screen, mode = 'app') {
  if (onScreen === null) phoneIn(t);
  else if (onScreen === false) {
    tl.fromTo('#phone', { autoAlpha: 0, y: PHONE[1] + 60 }, { autoAlpha: 1, y: PHONE[1], duration: 0.8, ...IR }, t);
    cue(t, 'whoosh-soft');
  }
  tl.set(`#${screen}`, { autoAlpha: 1, zIndex: nextZ() }, t);
  chrome(t, mode, '9:41');
  onScreen = screen;
}
function phoneHide(t) {
  if (!onScreen) return;
  tl.to('#phone', { autoAlpha: 0, y: PHONE[1] + 60, duration: 0.5, ease: 'power2.in' }, t);
  onScreen = false;
}

/** The callout, then what it lists, one by one. */
function calloutIn(key, t) {
  const id = `#${SCENES[key].callout}`;
  if (PORTRAIT) tl.to(`#t-${key} .wh-how`, { autoAlpha: 0, y: -20, duration: 0.35, ease: 'power2.in' }, t - 0.4);
  tl.fromTo(id, { autoAlpha: 0, y: PORTRAIT ? '+=30' : '+=0', x: PORTRAIT ? '+=0' : '+=36' },
    { autoAlpha: 1, y: PORTRAIT ? '-=30' : '-=0', x: PORTRAIT ? '-=0' : '-=36', duration: 0.7, ...IR }, t);
  cue(t + 0.05, 'pop');
  tl.fromTo($$(`${id} > *:not(.co-label)`), { autoAlpha: 0, x: 14 }, { autoAlpha: 1, x: 0, duration: 0.45, stagger: 0.3, ...IR }, t + 0.25);
}

// ─── What each scene's phone or diagram does ─────────────────────────────
// Each starts at t, when the question comes in, and returns when the answer
// comes in (how), when its callout does, and when it is done (end).
const PLAY = {
  kept(t) {
    const how = t + 2.6;
    tl.set('#dg-path', { autoAlpha: 1 }, t + 0.5);
    rise('#pn-phone', t + 0.5);
    rise('#pn-store', t + 0.8);
    tl.fromTo('#pw-line', { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power2.inOut', ...IR }, t + 1.1);
    tl.fromTo('#pw-packet', { left: '0%', autoAlpha: 0 }, { left: '0%', autoAlpha: 1, duration: 0.3, ...SHOWN }, how);
    tl.to('#pw-packet', { left: '100%', duration: 2.0, ease: 'power1.inOut' }, how + 0.3);
    tl.to('#pw-packet', { autoAlpha: 0, duration: 0.3 }, how + 2.3);
    pop('#pw-badge', how + 0.9);
    cue(how + 0.9, 'pop-soft');
    pop('#pn-badge', how + 2.5);
    cue(how + 2.5, 'ding');
    tl.fromTo('#pn-store .pv-node-ic', { boxShadow: '0 0 0 0 rgba(212,128,123,0)' },
      { boxShadow: '0 0 0 14px rgba(212,128,123,0.18)', duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut', ...IR }, how + 2.4);
    return { how, end: how + 6.2 };
  },
  who(t) {
    // The card comes with its first row, never empty; the rest follow the answer.
    const how = t + 2.6;
    tl.set('#dg-who', { autoAlpha: 1 }, t + 0.6);
    rise('#dg-who .pv-card-h', t + 0.6);
    const rows = [['#pw-vault', t + 0.9], ['#pw-link', how + 1.0], ['#pw-team', how + 2.6], ['#pw-svc', how + 4.6], ['#pw-else', how + 6.4]];
    for (const [sel, at] of rows) { rise(sel, at, { y: 18 }); cue(at, 'pop-soft'); }
    for (const [sel, at] of [['#pw-team', how + 3.4], ['#pw-svc', how + 5.4]]) {
      tl.fromTo(sel, { backgroundColor: 'rgba(254,243,199,0)' }, { backgroundColor: 'rgba(254,243,199,1)', duration: 0.6, ...IR }, at);
    }
    rise('#dg-who-foot', how + 7.8, { y: 12 });
    return { how, end: how + 11.4 };
  },
  vault(t) {
    phoneShow(t + 0.3, 'scr-members');
    const how = t + 2.6;
    // Just sent: the app's own notice, then the invitation waiting for a yes.
    fadeIn('#mf-notice', how + 0.4, { from: 6 });
    pulse('#mf-pending', how + 1.2);
    const c = how + 2.8;
    return { how, callout: c, end: c + 5.2 };
  },
  share(t) {
    phoneShow(t + 0.3, 'scr-doc');
    const r = sharePlay(t + 2.2, C.share, DOCS.policy.share.note, NAVY);
    return { how: t + 2.6, callout: Math.max(r.callout, t + 5.4), end: r.end + 2.6 };
  },
  ai(t) {
    // The question is typed and sent; the phone steps aside while what the AI
    // gets is laid out; the answer comes back with the document it came from.
    phoneShow(t + 0.3, 'scr-ask');
    const how = t + 2.6;
    const ans = askTurn('ask', t + 1.0, C.ai, { type: 1.8, think: 17.75 });
    const sent = t + 1.0 + 0.15 + 1.8 + 0.3;
    const v = sent + 1.0;
    tl.to('#phone', { autoAlpha: 0, x: PHONE[0] + (PORTRAIT ? 0 : 240), y: PHONE[1] + (PORTRAIT ? 120 : 0), duration: 0.6, ease: 'power2.in' }, v - 0.6);
    tl.set('#dg-ai', { autoAlpha: 1 }, v);
    rise('#ai-vault', v, { y: 30 });
    cue(v, 'whoosh-soft');
    tl.fromTo('#ai-grid .pv-tile', { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.3, stagger: 0.025, ...SHOWN }, v + 0.3);
    // Search: passages from seven documents match; only they go to the AI.
    const s = v + 1.6;
    cue(s, 'process', { dur: 1.0 });
    tl.to('#ai-grid .pv-tile:not(.found)', { opacity: 0.32, duration: 0.5 }, s + 0.6);
    tl.to('#ai-grid .found', { borderColor: '#D4807B', backgroundColor: '#FDF1EF', boxShadow: '0 10px 24px -10px rgba(212,128,123,0.7)', duration: 0.5 }, s + 0.6);
    cue(s + 0.7, 'ding');
    rise('#ai-found', s + 1.0, { y: 10 });
    // What is sent, exactly.
    const e = s + 3.4;
    tl.to('#ai-vault', { opacity: 0.18, scale: 0.97, duration: 0.6 }, e);
    rise('#ai-env', e, { y: 40, duration: 0.7 });
    cue(e, 'whoosh-soft');
    $$('#ai-env .pv-env-sec').forEach((sec, i) => rise(sec, e + 0.5 + i * 1.3, { y: 14 }));
    rise('#ai-foot', e + 4.6, { y: 10 });
    // To the AI service, and back.
    const n = e + 8.6;
    rise('#ai-node', n, { y: 20 });
    cue(n, 'pop');
    tl.to('#ai-env', { scale: 0.3, autoAlpha: 0, x: PORTRAIT ? 0 : 280, y: PORTRAIT ? 260 : 300, duration: 0.8, ease: 'power2.in' }, n + 0.6);
    cue(n + 0.6, 'send');
    tl.fromTo('#ai-node .pv-ai-ic', { scale: 1 }, { scale: 1.14, duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut', ...IR }, n + 1.3);
    const back = n + 2.8;
    tl.to('#dg-ai', { autoAlpha: 0, duration: 0.45 }, back - 0.5);
    tl.to('#phone', { autoAlpha: 1, x: PHONE[0], y: PHONE[1], duration: 0.8, ease: 'power3.out' }, back);
    if (Math.abs(ans - (back + 0.6)) > 0.05) console.warn(`[privacy] answer at ${ans.toFixed(2)}s, phone back at ${back.toFixed(2)}s`);
    return { how, end: ans + 4.4 };
  },
  device(t) {
    phoneShow(t + 0.3, 'scr-camera', 'os');
    const read = snapPhoto(t + 2.4, { shutter: C.device.shutter, slot: C.device.slot, cat: FAM.HEALTH });
    return { how: t + 2.6, callout: read + 0.6, end: read + 6.6 };
  },
  others(t) {
    const how = t + 2.6;
    tl.set('#dg-ledger', { autoAlpha: 1 }, t + 0.5);
    rise('#dg-ledger .pv-card-h', t + 0.5);
    $$('#dg-ledger .pv-lg-row').forEach((row, i) => { rise(row, how + 0.3 + i * 0.75, { y: 14 }); cue(how + 0.3 + i * 0.75, 'pop-soft'); });
    const f = how + 0.3 + $$('#dg-ledger .pv-lg-row').length * 0.75 + 0.4;
    rise('#dg-ledger-foot', f, { y: 12 });
    return { how, end: f + 4.2 };
  },
  control(t) {
    phoneShow(t + 0.3, 'scr-delete');
    const how = t + 2.6;
    const ty = how + 0.6;
    tap(ty, C.control.field);
    tl.set('#del-caret', { autoAlpha: 1 }, ty + 0.05);
    tl.to('#del-field', { borderColor: NAVY, duration: 0.1, ease: 'none' }, ty + 0.02);
    type('#del-typed', 'DELETE', ty + 0.15, 0.8);
    tl.to('#del-btn', { opacity: 1, duration: 0.2, ease: 'none' }, ty + 1.0);
    tl.set('#del-caret', { autoAlpha: 0 }, ty + 1.2);
    pulse('#del-btn', ty + 1.4, '220,38,38', 0.35);
    return { how, callout: ty + 2.2, end: ty + 8.0 };
  },
};

// ─── The film ────────────────────────────────────────────────────────────
const S = {};
let t = 0;
cue(0, 'section', FULL ? { name: 'privacy' } : { name: 'feature', look: 'family' });

if (FULL) {
  // The cold open: three papers, at night, and what to know before uploading.
  tl.to('#fade', { autoAlpha: 0, duration: 1.0, ease: 'power1.inOut' }, 0);
  tl.set('#t-open', { autoAlpha: 1 }, 0.3);
  const lines = [['#pv-l1', '#pv-d1', 0.5], ['#pv-l2', '#pv-d2', 1.9], ['#pv-l3', '#pv-d3', 3.3]];
  for (const [line, doc, at] of lines) {
    tl.fromTo(`${line} .wi`, { yPercent: 118 }, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.05, ...IR }, at);
    tl.fromTo(doc, { autoAlpha: 0, y: 80 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', ...IR }, at + 0.1);
    cue(at + 0.1, 'whoosh-soft');
  }
  tl.to('#pv-docs .pv-doc', { y: -12, duration: 3, ease: 'sine.inOut', stagger: 0.3 }, 4.2);
  hide('#t-open', 5.6);
  tl.to('#pv-docs .pv-doc', { autoAlpha: 0, y: -60, duration: 0.6, stagger: 0.08, ease: 'power2.in' }, 5.6);
  tl.set('#t-before', { autoAlpha: 1 }, 6.2);
  tl.fromTo('#t-before .big .wi', { yPercent: 118 }, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.05, ...IR }, 6.3);
  tl.fromTo('#t-before .big-em .wi', { yPercent: 118 }, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.06, ...IR }, 7.1);
  cue(7.2, 'pop-soft');
  hide('#t-before', 9.6);

  // Daylight, and the title.
  const r = 10.1;
  cue(r, 'section', { name: 'title' });
  tl.to('#bg-day', { autoAlpha: 1, duration: 0.01 }, r);
  tl.fromTo('#bg-day', { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(150% at 50% 50%)', duration: 1.3, ease: 'power3.inOut', ...IR }, r);
  tl.to('#vignette', { autoAlpha: 0, duration: 1.0 }, r + 0.3);
  cue(r, 'whoosh');
  tl.set('#pv-title', { autoAlpha: 1 }, r + 0.5);
  tl.fromTo('#logo', { scale: 0.4, rotation: -14, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 1.0, ease: 'back.out(1.7)', ...IR }, r + 0.6);
  cue(r + 0.7, 'pop');
  bubblePop('#logo', r + 1.2);
  tl.fromTo('#wordmark', { clipPath: 'inset(0% 100% 0% 0%)', y: 12 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.8, ...IR }, r + 1.1);
  fadeIn('#tagline', r + 1.8, { from: 16, duration: 0.7 });
  hide('#pv-title', r + 4.6);
  t = r + 5.1;
  S.title = r;
  cue(t, 'section', { name: 'day' });
}

for (const k of ORDER) {
  const sc = SCENES[k];
  S[k] = t;
  cue(t, 'section', { name: k });
  showWhy(`t-${k}`, t);
  if (k === 'ai') placeVisual('#dg-ai', k);
  const r = PLAY[k](t);
  showHow(`t-${k}`, r.how);
  if (!FULL && k === ORDER[0]) cue(r.how, 'section', { name: 'how' });
  if (sc.callout) calloutIn(k, r.callout);
  // Off it goes: the words, the callout, a diagram; the phone, if the next
  // scene has none.
  const e = r.end;
  hide(`#t-${k}`, e - 0.5);
  if (sc.callout) hide(`#${sc.callout}`, e - 0.6, { y: '-=20' });
  if (sc.visual && k !== 'ai') tl.to(sc.visual, { autoAlpha: 0, y: '-=30', duration: 0.5, ease: 'power2.in' }, e - 0.5);
  const next = ORDER[ORDER.indexOf(k) + 1];
  if (!next || !SCENES[next].screen) phoneHide(e - 0.45);
  t = e + 0.4;
}

if (FULL) {
  // No fine print.
  const c = t;
  S.close = c;
  cue(c, 'section', { name: 'close' });
  tl.set('#t-close', { autoAlpha: 1 }, c);
  tl.fromTo('#t-close .big .wi', { yPercent: 118 }, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.06, ...IR }, c + 0.1);
  fadeIn('#pv-close-sub', c + 0.9, { from: 14, duration: 0.6 });
  pop('#pv-url', c + 1.5, 0.9);
  cue(c + 1.55, 'pop-soft');
  hide('#t-close', c + 5.2);
  t = c + 5.7;
}

// The end card.
const t0 = t;
cue(t0, 'section', { name: 'end' });
cue(t0, 'whoosh');
tl.set('#endcard', { autoAlpha: 1 }, t0);
tl.fromTo('#end-logo', { scale: 0.4, rotation: -14, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 1.0, ease: 'back.out(1.7)', ...IR }, t0 + 0.05);
cue(t0 + 0.1, 'pop');
bubblePop('#end-logo', t0 + 0.6);
tl.fromTo('#end-word', { clipPath: 'inset(0% 100% 0% 0%)', y: 12 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.8, ...IR }, t0 + 0.55);
fadeIn('#end-tag', t0 + 1.15, { from: 16, duration: 0.7 });
tl.fromTo('#end-cta', { autoAlpha: 0, scale: 0.9, y: 16 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.7, ease: 'back.out(1.6)', ...IR }, t0 + 1.75);
cue(t0 + 1.8, 'pop-soft');
fadeIn('#end-note', t0 + 2.15, { from: 10, duration: 0.6 });
fadeIn('#end-url', t0 + 2.35, { from: 8 });
S.end = t0;
// The cover (tools/render.mjs --stills hero): the moment that says the most,
// counted from its scene's start.
const COVER = { ai: ['ai', 15.0], who: ['who', 11.6], where: ['kept', 6.5], control: ['control', 8.6] };
const [coverScene, coverAt] = REEL ? COVER[REEL] : COVER.ai;
S.hero = S[coverScene] + coverAt;
S.total = t0 + 5.0;

finish(S);
