// The launch film: what AskLocker does once end-to-end encryption ships, in
// the encryption brief's words (3 November 2026). It exists only in the
// launch set (?claims=launch, src/claims.js): nothing of it is posted before
// the owner confirms the launch. Built on src/engine.js with the family
// film's screens and its own (src/locked-screens.js, which says where each
// claim comes from).
//
//   ?film=locked&claims=launch                              the full film, 16:9
//   ?film=locked&claims=launch&orientation=portrait         the full film, 9:16
//   ?film=locked&claims=launch&reel=locker&orientation=portrait   one reel:
//       locker (adding a document), who (who can open it), asking (asking
//       without handing it over), key (your way back), family (adding
//       family), emergency (the emergency card)
//   ?film=locked-business&claims=launch                     the same film for a
//       business (Arora Electric, its team, teal and gold), with the same
//       &orientation= and &reel=, its reels locker, who, asking, key, share
//       (sending one record) and team (adding your team)
//
// Every scene asks what people ask (Question), then answers it plainly
// (Answer), while a diagram or the phone shows it.
import {
  gsap, PORTRAIT, W, $, $$, build, at, place, initialState, setLayout, tl, cue, IR, showWhy, showHow, hide, fadeIn,
  nextZ, chrome, tap, type, phoneIn, bubblePop, finish,
} from './engine.js';
import { phoneShell } from './parts.js';
import * as FAM from './family-screens.js';
import { documentScreen, DOCS } from './feature-screens.js';
import * as BUS from './business-screens.js';
import { askSetup, askTurn, pulse, glow, shareSetup, sharePlay } from './kit.js';
import { qa } from './privacy-screens.js';
import * as LK from './locked-screens.js';
import { LAUNCH } from './claims.js';

if (!LAUNCH) throw new Error('The launch film is only rendered with ?claims=launch (render.mjs --launch): it says what is true once end-to-end encryption ships');

const BUSINESS = LK.BUSINESS;
// The vault's colour, and its accent as r,g,b for a pulse.
const NAVY = BUSINESS ? '#0F5C57' : '#2A3D66';
const ACCENT_RGB = BUSINESS ? '183,121,31' : '212,128,123';
const REEL = new URLSearchParams(location.search).get('reel') || '';
const FULL = !REEL;

// ─── The scenes: words, and what shows them ──────────────────────────────
const FAMILY_SCENES = {
  locker: {
    kicker: 'Adding a document', icon: 'lock', visual: '#dg-lock',
    q: 'What happens when I *add a document?*', a: "It's locked on your phone before it leaves.",
    sub: 'AskLocker stores only scrambled copies.',
  },
  who: {
    kicker: 'Who can open it', icon: 'key', visual: '#dg-who',
    q: 'Who can *open it?*', a: "Your family holds the key. We don't.",
    sub: 'And here is everyone.',
  },
  asking: {
    kicker: 'Asking a question', icon: 'message-circle', screen: 'scr-ask', visual: '#dg-flow',
    q: 'Can it still *answer my questions?*', a: 'Your phone finds the page. Only that part goes to the AI.',
    sub: "We don't keep your questions.",
  },
  sees: {
    kicker: 'What we can see', icon: 'eye', visual: '#dg-sees',
    q: 'What can *AskLocker see?*', a: 'Only what it needs to run the service.',
    sub: 'Here is the whole list.',
  },
  key: {
    kicker: 'A new phone', icon: 'rotate-ccw', screen: 'scr-recovery', callout: 'co-key',
    q: 'What if I *lose my phone?*', a: 'Your Recovery Key gets you back in.',
    sub: 'Keep it safe. A family member you chose can let you back in too.',
  },
  share: {
    kicker: 'Sending one document', icon: 'link', screen: 'scr-doc', callout: 'co-share',
    q: 'Your CA needs *one paper?*', a: 'Send that one file. The vault stays locked.',
    sub: "The link carries that one file's key.",
  },
  family: {
    kicker: 'Adding family', icon: 'user-plus', screen: 'scr-invite', callout: 'co-family',
    q: 'Adding someone *to your vault?*', a: "They tap Accept. They're in.",
    sub: "The app hands them the vault's key.",
  },
  emergency: {
    kicker: 'The emergency card', icon: 'plus-square', screen: 'scr-emerg', callout: 'co-emergency',
    q: "At the hospital, *who has Papa's card?*", a: 'Your family has it. Nobody else does.',
    sub: 'Not even AskLocker.',
  },
};
// A business: the same answers for its team, a bill instead of a passport,
// and nothing a business vault doesn't have (no emergency cards).
const BUSINESS_SCENES = {
  ...FAMILY_SCENES,
  locker: { ...FAMILY_SCENES.locker, kicker: 'Adding a record', q: 'What happens when I *add a bill?*' },
  who: { ...FAMILY_SCENES.who, a: "Your team holds the key. We don't." },
  key: { ...FAMILY_SCENES.key, sub: 'Keep it safe. Someone in your team you chose can let you back in too.' },
  share: { ...FAMILY_SCENES.share, kicker: 'Sending one record', q: 'Your CA needs *one bill?*' },
  team: {
    kicker: 'Adding your team', icon: 'user-plus', screen: 'scr-invite', callout: 'co-team',
    q: 'Adding someone *to your business?*', a: "They tap Accept. They're in.",
    sub: "The app hands them the vault's key.",
  },
};
const SCENES = BUSINESS ? BUSINESS_SCENES : FAMILY_SCENES;
const FILM_ORDER = BUSINESS ? ['locker', 'who', 'asking', 'sees', 'key', 'share', 'team']
  : ['locker', 'who', 'asking', 'sees', 'key', 'share', 'family', 'emergency'];
// The brief's six ideas, one reel each (a business sends one record instead
// of showing an emergency card).
const REELS = Object.fromEntries((BUSINESS ? ['locker', 'who', 'asking', 'key', 'share', 'team']
  : ['locker', 'who', 'asking', 'key', 'family', 'emergency']).map((k) => [k, [k]]));
if (REEL && !REELS[REEL]) throw new Error(`No reel "${REEL}": one of ${Object.keys(REELS).join(', ')}`);
const ORDER = FULL ? FILM_ORDER : REELS[REEL];
const uses = (k) => ORDER.includes(k);
const kicker = (k) => (FULL ? `${String(FILM_ORDER.indexOf(k) + 1).padStart(2, '0')} · ` : '') + SCENES[k].kicker;

// ─── The stage ───────────────────────────────────────────────────────────
const texts = (FULL ? LK.openLines() + LK.titleCard() : '')
  + ORDER.map((k) => qa(`t-${k}`, kicker(k), SCENES[k].icon, SCENES[k].q, SCENES[k].a, SCENES[k].sub)).join('')
  + (FULL ? LK.closeBlock() : '') + LK.endCard();
const cards = (FULL ? LK.openCards() : '') + (uses('locker') ? LK.lockDiagram() : '') + (uses('who') ? LK.whoDiagram() : '')
  + (uses('asking') ? LK.askFlow() : '') + (uses('sees') ? LK.seesTable() : '');
// The paper a share link is made for: Papa's policy, or the supplier's bill.
const SHARED = BUSINESS ? 'bill' : 'policy';
const screens = [
  uses('asking') && (BUSINESS ? BUS.askScreen() : FAM.askScreen()), uses('key') && `${LK.recoveryScreen()}${LK.newPhoneScreen()}`,
  uses('share') && documentScreen({ doc: SHARED, share: true }), (uses('family') || uses('team')) && LK.inviteScreen(),
  uses('emergency') && FAM.emergencyScreen(),
].filter(Boolean).join('');
const callouts = ['key', 'share', 'family', 'team', 'emergency'].filter(uses).map((k) => LK.LK_CALLOUTS[k]()).join('');

// A business wears the business film's daylight and colours (styles.css
// .formal, features.css .biz-look) and its own night (launch.css .locked-biz).
await build({ cards, texts, phone: phoneShell(screens, '9:41'), callouts, subs: '', look: BUSINESS ? 'privacy formal biz-look locked-biz' : 'privacy' });

// ─── Layout passes, and the taps, measured before anything moves ────────
const C = {};
if (uses('asking')) C.ask = askSetup('ask', 'scr-ask', LK.ASK_Q);
if (uses('share')) C.share = shareSetup();
if (uses('key')) C.key = { save: at('#lk-save'), opt: at('#lk-o1') };
if (uses('family') || uses('team')) C.join = { accept: at('#lk-accept') };

// ─── Initial state ───────────────────────────────────────────────────────
initialState();
// Whatever comes in later on a card or a screen starts hidden; a reel sets
// only what it has.
const hidden = $$('.pv-dg, .pv-doc, #t-open, #t-before, #t-close, #lk-title, #lk-close-sub, #lk-saved, #lk-picked, #lk-field, #lk-open, #lk-news, #lk-recent, #lk-padlock, #lk-packet');
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
    const top = stageTop($(`#t-${key} .wh-how`)) + $(`#t-${key} .wh-how`).offsetHeight + 40;
    // The wide diagrams stand up in 9:16 (launch.css), so they may grow more.
    const s = Math.min(1.5, (SAFE_BOTTOM - top) / h, 1000 / w);
    place(el, [W / 2, (top + SAFE_BOTTOM) / 2, s]);
  } else {
    const s = Math.min(1, 900 / h, 880 / w);
    place(el, [1420, 540, s]);
  }
}
for (const k of ORDER) if (SCENES[k].visual) placeVisual(SCENES[k].visual, k);

// ─── Helpers ─────────────────────────────────────────────────────────────
const SHOWN = { immediateRender: true };
// Lines and arrows run across in 16:9 and down in 9:16 (launch.css).
const GROW = PORTRAIT ? 'scaleY' : 'scaleX';
const ALONG = PORTRAIT ? 'top' : 'left';
const pop = (sel, t, from = 0.86) => tl.fromTo(sel, { autoAlpha: 0, scale: from }, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(1.6)', ...SHOWN }, t);
// A card's parts are there, faded, from the moment it comes in, and light up one by one.
const light = (sel, t) => tl.fromTo(sel, { opacity: 0.16 }, { opacity: 1, duration: 0.5, ease: 'power1.out', ...SHOWN }, t);
// A diagram placed on the stage (place() owns its x, y and scale) only fades.
const fade = (sel, t) => tl.fromTo(sel, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ...SHOWN }, t);

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
  locker(t) {
    const how = t + 2.6;
    // Each light() fades its part from the start and lights it once, at its moment.
    fade('#dg-lock', t + 0.5);
    tl.fromTo('#lk-line', { [GROW]: 0 }, { [GROW]: 1, duration: 0.9, ease: 'power2.inOut', ...SHOWN }, t + 0.9);
    // Read on the phone, then locked with its own key.
    light('#lk-s1', how + 0.3);
    tl.fromTo('#lk-doc', { borderColor: BUSINESS ? '#DCEBE8' : '#E8ECF4' }, { borderColor: BUSINESS ? '#B7791F' : '#D4807B', duration: 0.4, ...IR }, how + 0.3);
    cue(how + 0.35, 'pop-soft');
    light('#lk-s2', how + 1.5);
    pop('#lk-padlock', how + 1.8, 0.4);
    cue(how + 1.85, 'ding');
    // Only scrambled data leaves; on the servers it stays scrambled.
    const go = how + 2.8;
    tl.fromTo('#lk-packet', { [ALONG]: '0%', autoAlpha: 0 }, { [ALONG]: '0%', autoAlpha: 1, duration: 0.3, ...SHOWN }, go);
    tl.to('#lk-packet', { [ALONG]: '100%', duration: 1.8, ease: 'power1.inOut' }, go + 0.3);
    tl.to('#lk-packet', { autoAlpha: 0, duration: 0.3 }, go + 2.1);
    cue(go + 0.3, 'send');
    light('#lk-server', go + 2.0);
    tl.fromTo('#lk-bytes code', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, stagger: 0.08, ...SHOWN }, go + 2.1);
    cue(go + 2.2, 'process', { dur: 0.6 });
    return { how, end: go + 7.4 };
  },
  who(t) {
    const how = t + 2.6;
    fade('#dg-who', t + 0.6);
    const rows = [['#lw-vault', t + 0.9], ['#lw-link', how + 1.0], ['#lw-team', how + 2.4], ['#lw-break', how + 3.8], ['#lw-ai', how + 5.4]];
    for (const [sel, at] of rows) { light(sel, at); cue(at, 'pop-soft'); }
    tl.fromTo('#lw-ai', { backgroundColor: 'rgba(254,243,199,0)' }, { backgroundColor: 'rgba(254,243,199,1)', duration: 0.6, ...IR }, how + 6.0);
    light('#lw-foot', how + 7.2);
    return { how, end: how + 10.8 };
  },
  asking(t) {
    // The question is typed and sent; the phone steps aside while the way it
    // travels is laid out; the answer comes back with the document it came from.
    phoneShow(t + 0.3, 'scr-ask');
    const how = t + 2.6;
    const ans = askTurn('ask', t + 1.0, C.ask, { type: 1.8, think: 8.95 });
    const sent = t + 1.0 + 0.15 + 1.8 + 0.3;
    const v = sent + 1.0;
    tl.to('#phone', { autoAlpha: 0, x: PHONE[0] + (PORTRAIT ? 0 : 240), y: PHONE[1] + (PORTRAIT ? 120 : 0), duration: 0.6, ease: 'power2.in' }, v - 0.6);
    fade('#dg-flow', v);
    cue(v, 'whoosh-soft');
    light('#lf-phone', v + 0.4);
    cue(v + 0.45, 'pop-soft');
    tl.fromTo('#lf-a1 i', { [GROW]: 0 }, { [GROW]: 1, duration: 0.6, ease: 'power2.inOut', ...SHOWN }, v + 1.3);
    tl.fromTo('#lf-a1 span', { opacity: 0 }, { opacity: 1, duration: 0.4, ...SHOWN }, v + 1.5);
    light('#lf-server', v + 2.0);
    cue(v + 2.05, 'pop-soft');
    tl.fromTo('#lf-a2 i', { [GROW]: 0 }, { [GROW]: 1, duration: 0.6, ease: 'power2.inOut', ...SHOWN }, v + 2.9);
    tl.fromTo('#lf-a2 span', { opacity: 0 }, { opacity: 1, duration: 0.4, ...SHOWN }, v + 3.1);
    light('#lf-ai', v + 3.6);
    cue(v + 3.65, 'pop');
    light('#lf-foot', v + 4.7);
    const back = v + 7.6;
    tl.to('#dg-flow', { autoAlpha: 0, duration: 0.45 }, back - 0.5);
    tl.to('#phone', { autoAlpha: 1, x: PHONE[0], y: PHONE[1], duration: 0.8, ease: 'power3.out' }, back);
    if (Math.abs(ans - (back + 0.6)) > 0.05) console.warn(`[locked] answer at ${ans.toFixed(2)}s, phone back at ${back.toFixed(2)}s`);
    return { how, end: ans + 4.4 };
  },
  sees(t) {
    const how = t + 2.6;
    fade('#dg-sees', t + 0.5);
    const rows = $$('#dg-sees .lk-sees-row');
    rows.forEach((row, i) => { light(row, how + 0.3 + i * 0.7); cue(how + 0.3 + i * 0.7, 'pop-soft'); });
    const f = how + 0.3 + rows.length * 0.7 + 0.3;
    light('#ls-foot', f);
    return { how, end: f + 4.8 };
  },
  key(t) {
    phoneShow(t + 0.3, 'scr-recovery');
    const how = t + 2.6;
    tl.fromTo('#lk-key span', { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.3, stagger: 0.08, ease: 'back.out(1.6)', ...SHOWN }, t + 1.0);
    cue(t + 1.1, 'process', { dur: 0.5 });
    // Saved to the password manager; Papa picked as the recovery contact.
    tap(how + 0.5, C.key.save, { press: '#lk-save' });
    fadeIn('#lk-saved', how + 0.8, { from: 6 });
    cue(how + 0.85, 'ding');
    pop('#lk-picked', how + 1.7, 0.5);
    cue(how + 1.75, 'pop-soft');
    // Later, a new phone: signed in with Google, the vaults still locked.
    const n = how + 3.0;
    tl.to('#phone', { autoAlpha: 0, x: PHONE[0] - 80, duration: 0.45, ease: 'power2.in' }, n);
    tl.set('#scr-newphone', { autoAlpha: 1, zIndex: nextZ() }, n + 0.45);
    tl.fromTo('#phone', { autoAlpha: 0, x: PHONE[0] + 80 }, { autoAlpha: 1, x: PHONE[0], duration: 0.6, ease: 'power3.out', ...IR }, n + 0.5);
    cue(n + 0.5, 'whoosh-soft');
    tap(n + 1.7, C.key.opt, { press: '#lk-o1' });
    fadeIn('#lk-field', n + 1.9, { from: 6, duration: 0.3 });
    tl.set('#lk-caret', { autoAlpha: 1 }, n + 2.0);
    type('#lk-typed', LK.RECOVERY_KEY.join('-'), n + 2.1, 1.4);
    tl.set('#lk-caret', { autoAlpha: 0 }, n + 3.6);
    pop('#lk-open', n + 3.8, 0.8);
    cue(n + 3.85, 'success');
    return { how, callout: n + 4.6, end: n + 9.6 };
  },
  share(t) {
    phoneShow(t + 0.3, 'scr-doc');
    const r = sharePlay(t + 2.2, C.share, DOCS[SHARED].share.note, NAVY);
    return { how: t + 2.6, callout: Math.max(r.callout, t + 5.4), end: r.end + 2.6 };
  },
  family(t) {
    phoneShow(t + 0.3, 'scr-invite');
    const how = t + 2.6;
    pulse('#lk-inv', t + 1.4, ACCENT_RGB);
    tap(how + 0.8, C.join.accept, { press: '#lk-accept' });
    const inv = $('#lk-inv');
    tl.to(inv, { autoAlpha: 0, height: 0, marginBottom: -12, paddingTop: 0, paddingBottom: 0, duration: 0.4, ease: 'power2.inOut' }, how + 1.1);
    fadeIn('#lk-news', how + 1.4, { from: 8 });
    cue(how + 1.45, 'success');
    tl.fromTo('#lk-recent', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5, ...SHOWN }, how + 2.0);
    return { how, callout: how + 3.2, end: how + 8.4 };
  },
  team(t) { return PLAY.family(t); },
  emergency(t) {
    phoneShow(t + 0.3, 'scr-emerg');
    const how = t + 2.6;
    glow('.em-allergy', how + 0.4, '185,28,28', 0.12);
    return { how, callout: how + 1.8, end: how + 7.4 };
  },
};

// ─── The film ────────────────────────────────────────────────────────────
const S = {};
let t = 0;
// The score (audio/score.py): the privacy film's music for a family, the
// business film's formal piece for a business (calm, then its groove from the
// first question, calm again for the close); a reel scores as its feature shorts.
if (FULL) cue(0, 'section', { name: BUSINESS ? 'formal' : 'privacy' });
else cue(0, 'section', { name: 'feature', look: BUSINESS ? 'business' : 'family' });

if (FULL) {
  // The cold open: three papers, at night, and what happens before they leave the phone.
  tl.to('#fade', { autoAlpha: 0, duration: 1.0, ease: 'power1.inOut' }, 0);
  tl.set('#t-open', { autoAlpha: 1 }, 0.3);
  const lines = [['#pv-l1', '#pv-d1', 0.5], ['#pv-l2', '#pv-d2', 1.9], ['#pv-l3', '#pv-d3', 3.3]];
  for (const [line, doc, a] of lines) {
    tl.fromTo(`${line} .wi`, { yPercent: 118 }, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.05, ...IR }, a);
    tl.fromTo(doc, { autoAlpha: 0, y: 80 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', ...IR }, a + 0.1);
    cue(a + 0.1, 'whoosh-soft');
  }
  tl.to('#pv-docs .pv-doc', { y: -12, duration: 3, ease: 'sine.inOut', stagger: 0.3 }, 4.2);
  hide('#t-open', 5.6);
  tl.to('#pv-docs .pv-doc', { autoAlpha: 0, y: -60, duration: 0.6, stagger: 0.08, ease: 'power2.in' }, 5.6);
  tl.set('#t-before', { autoAlpha: 1 }, 6.2);
  tl.fromTo('#t-before .big .wi', { yPercent: 118 }, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.05, ...IR }, 6.3);
  tl.fromTo('#t-before .big-em .wi', { yPercent: 118 }, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.06, ...IR }, 7.1);
  cue(7.2, 'pop-soft');
  hide('#t-before', 9.6);

  // Daylight, and the title: the launch's one line.
  const r = 10.1;
  cue(r, 'section', { name: 'title' });
  tl.to('#bg-day', { autoAlpha: 1, duration: 0.01 }, r);
  tl.fromTo('#bg-day', { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(150% at 50% 50%)', duration: 1.3, ease: 'power3.inOut', ...IR }, r);
  tl.to('#vignette', { autoAlpha: 0, duration: 1.0 }, r + 0.3);
  cue(r, 'whoosh');
  tl.set('#lk-title', { autoAlpha: 1 }, r + 0.5);
  tl.fromTo('#logo', { scale: 0.4, rotation: -14, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 1.0, ease: 'back.out(1.7)', ...IR }, r + 0.6);
  cue(r + 0.7, 'pop');
  bubblePop('#logo', r + 1.2);
  tl.fromTo('#wordmark', { clipPath: 'inset(0% 100% 0% 0%)', y: 12 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.8, ...IR }, r + 1.1);
  if (BUSINESS) tl.fromTo('#badge', { autoAlpha: 0, scale: 0.9, y: 8 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.6)', ...IR }, r + 1.45);
  fadeIn('#tagline', r + (BUSINESS ? 1.9 : 1.8), { from: 16, duration: 0.7 });
  hide('#lk-title', r + 4.8);
  t = r + 5.3;
  S.title = r;
  cue(t, 'section', { name: 'day' });
}

for (const k of ORDER) {
  const sc = SCENES[k];
  S[k] = t;
  cue(t, 'section', { name: k });
  if (FULL && BUSINESS && k === ORDER[0]) cue(t, 'section', { name: 'solution' });
  showWhy(`t-${k}`, t);
  const r = PLAY[k](t);
  showHow(`t-${k}`, r.how);
  if (!FULL && k === ORDER[0]) cue(r.how, 'section', { name: 'how' });
  if (sc.callout) calloutIn(k, r.callout);
  // Off it goes: the words, the callout, a diagram; the phone, if the next
  // scene has none.
  const e = r.end;
  hide(`#t-${k}`, e - 0.5);
  if (sc.callout) hide(`#${sc.callout}`, e - 0.6, { y: '-=20' });
  if (sc.visual && k !== 'asking') tl.to(sc.visual, { autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, e - 0.5);
  const next = ORDER[ORDER.indexOf(k) + 1];
  if (!next || !SCENES[next].screen) phoneHide(e - 0.45);
  t = e + 0.4;
}

if (FULL) {
  // Your family holds the key. We don't.
  const c = t;
  S.close = c;
  cue(c, 'section', { name: 'close' });
  if (BUSINESS) cue(c, 'section', { name: 'trust' });
  tl.set('#t-close', { autoAlpha: 1 }, c);
  tl.fromTo('#t-close .big .wi', { yPercent: 118 }, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.06, ...IR }, c + 0.1);
  tl.fromTo('#t-close .big-em .wi', { yPercent: 118 }, { yPercent: 0, duration: 0.9, ease: 'power4.out', stagger: 0.06, ...IR }, c + 0.9);
  cue(c + 1.0, 'pop-soft');
  fadeIn('#lk-close-sub', c + 1.9, { from: 14, duration: 0.6 });
  hide('#t-close', c + 6.0);
  t = c + 6.5;
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
if (BUSINESS) tl.fromTo('#end-badge', { autoAlpha: 0, scale: 0.9, y: 8 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.6)', ...IR }, t0 + 0.95);
fadeIn('#end-tag', t0 + 1.15, { from: 16, duration: 0.7 });
tl.fromTo('#end-cta', { autoAlpha: 0, scale: 0.9, y: 16 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.7, ease: 'back.out(1.6)', ...IR }, t0 + 1.75);
cue(t0 + 1.8, 'pop-soft');
fadeIn('#end-note', t0 + 2.15, { from: 10, duration: 0.6 });
fadeIn('#end-url', t0 + 2.35, { from: 8 });
S.end = t0;
// The cover (tools/render.mjs --stills hero): the moment that says the most,
// counted from its scene's start. A reel's cover leads with its headline.
const COVER = { locker: ['locker', 10.4], who: ['who', 11.6], asking: ['asking', 10.6], key: ['key', 4.4],
  share: ['share', 4.3], family: ['family', 5.0], team: ['team', 5.0], emergency: ['emergency', 4.0] };
const [coverScene, coverAt] = REEL ? COVER[REEL] : COVER.locker;
S.hero = S[coverScene] + coverAt;
S.total = t0 + 5.0;

finish(S);
