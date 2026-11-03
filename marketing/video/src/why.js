// The why films: why AskLocker was made, in its founder's own words, for
// everyone, for families and for businesses. What each says, and where every
// number comes from, is in src/why-screens.js. They make no claim about
// encryption, so they can be posted today.
//   ?film=why&reel=founder                       the founder's story, 16:9
//   ?film=why&reel=family&orientation=portrait   why a family vault, 9:16
//   ?film=why&reel=business                      why a business vault
// Each opens at night, on the feeling (the one person who handles
// everything, what a family wouldn't know, the CA asking at 10 PM), turns to
// day on AskLocker's name, and shows the app doing what the story asked for.
import {
  gsap, PORTRAIT, $, $$, build, at, place, initialState, setLayout, tl, cue, IR, showCallout, hide, fadeIn, swap,
  nextZ, nav, chrome, tap, type, phoneIn, bubblePop, sub, askArea, inputOverflow, layoutChat, count, finish,
} from './engine.js';
import { phoneShell } from './parts.js';
import * as FAM from './family-screens.js';
import * as BUS from './business-screens.js';
import { askSetup, askTurn, pulse } from './kit.js';
import { AI_Q } from './privacy-screens.js';
import { VOICE_LINES, voiceSubtitles } from './voice-lines.js';
import { VOICES } from './voices.js';
import * as WY from './why-screens.js';

const KIND = WY.STORY_OF;
if (!['founder', 'family', 'business'].includes(KIND)) throw new Error(`No why film "${KIND}": founder, family or business`);
const BUSINESS = KIND === 'business';
const FAMILY = KIND === 'family';
// The vault's accent as r,g,b, for a pulse.
const ACCENT = BUSINESS ? '183,121,31' : '212,128,123';
const TEAL = '#0F5C57';

// ─── The stage ───────────────────────────────────────────────────────────
const PAPERS = [['shield', 'Health insurance'], ['umbrella', 'Term plan'], ['credit-card', 'Bank FDs'], ['bar-chart-2', 'Shares and mutual funds'],
  ['file-text', 'PAN and Aadhaar'], ['book-open', 'Passport'], ['home', 'Property papers'], ['percent', 'Tax returns']];
let texts;
let cards = '';
let screens;
let callouts = '';
let subs = '';
if (KIND === 'founder') {
  texts = WY.lines('t-open', [['Every family has one person who handles everything.'], ["In mine, that's me.", true]])
    + WY.lines('t-parents', [['My parents always told me,'], ['“Keep a record of everything you do online.”', true]])
    + WY.lines('t-online', [['And today, everything is online.']])
    + WY.lines('t-kept', [['So I kept copies. Everywhere.']], { top: true })
    + WY.lines('t-pivot', [['Then one thought stayed with me.'], ["If I'm not there, how will they find it?", true]])
    + WY.titleCard('So we built one place where your family can just ask.')
    + WY.scene('t-ask', 'Just ask', 'message-circle', 'No folders. *No inbox search.*', 'Ask in plain words, typed or spoken, and get the answer with the document.')
    + WY.both('t-both') + WY.endCard();
  cards = WY.chips('c-papers', PAPERS) + WY.places('c-places', [['inbox', 'Email', 'Two inboxes, years of mail'],
    ['folder', 'Folders', 'On an old laptop'], ['message-circle', 'Chats', 'Sent to myself'], ['archive', 'The cupboard', "At my parents' home"]]);
  screens = FAM.askScreen();
} else if (FAMILY) {
  texts = WY.checklist('t-know', "If you weren't there tomorrow,", 'would your family know…',
    [['shield', 'Which insurance you have'], ['bar-chart-2', 'Your FDs, shares and mutual funds'], ['user-check', 'Who the nominee is'], ['phone', 'Who to call']])
    + WY.unclaimed('t-money')
    + WY.lines('t-parents', [['My parents read Hindi and English.'], ['But writing it is hard for them.', true]])
    + WY.titleCard('So we built a family vault they can talk to.')
    + WY.scene('t-voice', 'Voice', 'mic', 'Tap. Speak. *Hear the answer.*', 'In nine Indian languages and English.')
    + WY.lines('t-close', [['Add each paper once.'], ["They'll find it, even when you're not there.", true]], { day: true })
    + WY.endCard();
  screens = FAM.voiceScreen('');
  callouts = WY.WY_CALLOUTS.family();
  // The question and the answer, in Hindi on the phone; English under it.
  const v = voiceSubtitles('hi', FAM.STORY.policyNo);
  subs = `<div class="subline on-light" id="sub-q">${v.q}</div><div class="subline on-light" id="sub-a">${v.a1}</div>`;
} else {
  texts = WY.lines('t-open', [['I run a business too.'], ['Every day, someone needs a paper.', true]])
    + WY.tiles('t-papers', 'And the papers never stop.', [['award', 'GST certificate'], ['calendar', 'GST returns, every month'],
      ['percent', 'Advance tax, every quarter'], ['file-text', 'Invoices and bills'], ['edit-3', 'Contracts and leases'], ['clipboard', 'Licences']],
    'Each one in some email, some chat, some folder.')
    + WY.titleCard('So we built one vault for your whole team.')
    + WY.scene('t-team', 'Your team', 'users', 'Bring your team *into the vault.*', 'Partners, staff, your accountant and your CA. They join when they accept.')
    + WY.scene('t-ask', 'Just ask', 'message-circle', 'Then anyone *just asks.*', 'No folders. No email threads. The answer, with the document.')
    + WY.lines('t-close', [['Less chasing.'], ['More time for the business.', true]], { day: true })
    + WY.endCard();
  cards = WY.chat('c-chat');
  screens = BUS.teamScreen() + WY.gstAskScreen();
  callouts = WY.WY_CALLOUTS.business();
}

await build({
  cards, texts, phone: phoneShell(screens, BUSINESS ? '10:14' : '9:41'), callouts, subs,
  look: BUSINESS ? 'why formal biz-look why-biz' : 'why',
  fontText: FAMILY ? `${VOICE_LINES.hi.q} ${VOICE_LINES.hi.lead} ${VOICE_LINES.hi.a2}` : '',
});

// ─── Layout passes, and the taps, measured before anything moves ────────
const C = {};
if (KIND === 'founder') C.ask = askSetup('ask', 'scr-ask', AI_Q);
if (FAMILY) {
  // The Voice short's measurements (features.js): the mic is a wider ✕ Cancel
  // pill while it listens, and the question may run past the input.
  askArea('#v-area', '#scr-voice');
  const micW = $('#v-mic').offsetWidth;
  const pillW = $('#mic-listen').offsetWidth;
  $('#v-mic').style.width = `${pillW}px`;
  const VQ = VOICE_LINES.hi.q;
  const ov = inputOverflow('#v-line', VQ);
  $('#v-mic').style.width = '';
  const scroll = layoutChat('#v-area', [['v-q1'], ['v-l1', 'v-a1']]);
  C.voice = { micW, pillW, VQ, ov, P: { mic: at('#v-mic') }, scroll };
}
if (BUSINESS) {
  // Manage team: the banner and the pending invitation open once it is sent.
  const banner = $('#tm-banner');
  const pending = $('#tm-pending');
  C.team = {
    bannerH: banner.offsetHeight, pendingH: pending.offsetHeight,
    P: { add: at('#tm-add'), email: at('#tm-email'), shown: at('#tm-shown'), send: at('#tm-send') },
  };
  banner.style.height = '0px';
  pending.style.height = '0px';
  C.ask = askSetup('ask', 'scr-ask', WY.GST_Q);
}

// Where the chips and the places sit (stage pixels, before anything moves).
function centre(el) {
  let x = 0;
  let y = 0;
  for (let n = el; n && n.id !== 'stage'; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  return [x + el.offsetWidth / 2, y + el.offsetHeight / 2];
}
const placeAt = KIND === 'founder' ? $$('#c-places .wy-place').map(centre) : [];

// ─── Initial state ───────────────────────────────────────────────────────
initialState();
const cardEls = $$('#cards > *');
if (cardEls.length) gsap.set(cardEls, { autoAlpha: 0 });
gsap.set('#hb-dark', { autoAlpha: 1 });
gsap.set('#hb-light', { autoAlpha: 0 });
if (BUSINESS) {
  gsap.set('#tm-dim', { autoAlpha: 0 });
  gsap.set('#tm-sheet', { yPercent: 105 });
  gsap.set($$('#c-chat .wy-msg'), { autoAlpha: 0 });
}
// What comes in one by one starts hidden, so nothing shows before its turn.
const later = $$('#t-know .wy-item, #t-money > *:not(.wy-num), #t-money .wy-part, #c-papers .wy-chip, #c-places .wy-place, #t-both .wy-for, #t-papers .fm-tile, #t-papers .wy-foot');
if (later.length) gsap.set(later, { autoAlpha: 0 });

// The phone, and where the callout sits: beside it in 16:9; in 9:16, in the
// place of the scene's paragraph once it has been read.
const PHONE = PORTRAIT ? [540, 1176, 0.94] : [1270, 548, 0.94];
place('#phone', PHONE, { autoAlpha: 0 });
// In 9:16 the callout fills the room between the heading and the phone.
setLayout({ dayPhone: PHONE, coAsks: PORTRAIT ? (BUSINESS ? 't-ask' : 't-voice') : [1640, 650], coScale: 1.5 },
  FAMILY || BUSINESS ? { 'co-asks': 'coAsks' } : {});

// The papers, scattered around the words: above and below them.
const CHIPS = PORTRAIT
  ? [[300, 420, -5], [770, 500, 3], [330, 640, 4], [770, 720, -3], [310, 1220, -4], [770, 1300, 3], [330, 1440, 4], [770, 1520, -3]]
  : [[360, 230, -5], [820, 170, 3], [1220, 215, -3], [1600, 260, 4], [330, 850, 4], [760, 905, -3], [1180, 860, 3], [1610, 820, -4]];
$$('#c-papers .wy-chip').forEach((el, i) => place(el, [CHIPS[i][0], CHIPS[i][1], 1], { rotation: CHIPS[i][2] }));

// ─── Helpers ─────────────────────────────────────────────────────────────
const S = {};
/** A block of lines, read one after another. */
function say(id, t, gap = 1.0) {
  tl.set(`#${id}`, { autoAlpha: 1, y: 0 }, t);
  $$(`#${id} .wy-l`).forEach((el, i) => {
    const em = el.classList.contains('big-em');
    tl.fromTo($$('.wi', el), { yPercent: 118 }, { yPercent: 0, duration: em ? 1.05 : 0.95, ease: 'power4.out', stagger: em ? 0.06 : 0.045, ...IR }, t + i * gap);
    if (i > 0) cue(t + i * gap + 0.1, 'pop-soft');
  });
}
/** A scene beside the phone: its label, its heading, then its line. */
function sceneIn(id, t) {
  const b = $(`#${id}`);
  tl.set(b, { autoAlpha: 1, y: 0 }, t);
  tl.fromTo($('.kicker', b), { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.5, ...IR }, t);
  tl.fromTo($$('.h1 .wi', b), { yPercent: 118 }, { yPercent: 0, duration: 0.95, ease: 'power4.out', stagger: 0.05, ...IR }, t + 0.1);
  tl.fromTo($('.sub', b), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, ...IR }, t + 0.6);
  cue(t + 0.1, 'pop-soft');
}
/** Night turns to day on AskLocker's name. */
function title(r) {
  cue(r, 'section', { name: 'title' });
  if (BUSINESS) cue(r, 'section', { name: 'solution' });
  tl.to('#bg-day', { autoAlpha: 1, duration: 0.01 }, r);
  tl.fromTo('#bg-day', { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(150% at 50% 50%)', duration: 1.3, ease: 'power3.inOut', ...IR }, r);
  tl.to('#vignette', { autoAlpha: 0, duration: 1.0 }, r + 0.3);
  cue(r, 'whoosh');
  tl.set('#title', { autoAlpha: 1 }, r + 0.5);
  tl.fromTo('#logo', { scale: 0.4, rotation: -14, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 1.0, ease: 'back.out(1.7)', ...IR }, r + 0.6);
  cue(r + 0.7, 'pop');
  bubblePop('#logo', r + 1.2);
  tl.fromTo('#wordmark', { clipPath: 'inset(0% 100% 0% 0%)', y: 12 }, { clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 0.8, ...IR }, r + 1.1);
  if (BUSINESS) tl.fromTo('#badge', { autoAlpha: 0, scale: 0.9, y: 8 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.6)', ...IR }, r + 1.45);
  fadeIn('#tagline', r + (BUSINESS ? 1.95 : 1.8), { from: 16, duration: 0.7 });
  hide('#title', r + 5.0);
  const day = r + 5.5;
  cue(day, 'section', { name: 'day' });
  return day;
}
/** The phone comes in, showing a screen. */
function phoneShow(t, screen) {
  phoneIn(t);
  tl.set(`#${screen}`, { autoAlpha: 1, zIndex: nextZ() }, t);
  chrome(t, 'app', BUSINESS ? '10:14' : '9:41');
}
const phoneOut = (t) => tl.to('#phone', { autoAlpha: 0, y: '+=60', duration: 0.55, ease: 'power2.in' }, t);
/** The end card, piece by piece. */
function endCard(t0) {
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
  S.total = t0 + 5.2;
}

// ─── The films ───────────────────────────────────────────────────────────
// The score (audio/score.py): the privacy film's music for the founder and a
// family, a quiet minor pad at night, the day's major from AskLocker's name,
// percussion once the app is shown; for a business, its film's formal piece,
// calm at night, its groove from the name, calm again for the last words.
cue(0, 'section', { name: BUSINESS ? 'formal' : 'privacy' });
tl.to('#fade', { autoAlpha: 0, duration: 1.0, ease: 'power1.inOut' }, 0);

if (KIND === 'founder') {
  // The one person who handles everything.
  say('t-open', 0.5, 2.3);
  hide('#t-open', 6.6);
  // What his parents always said.
  say('t-parents', 7.2, 1.7);
  hide('#t-parents', 13.2);
  // Everything is online: the papers, all around.
  say('t-online', 13.8);
  tl.set('#c-papers', { autoAlpha: 1 }, 14.3);
  $$('#c-papers .wy-chip').forEach((el, i) => {
    const t = 14.4 + i * 0.17;
    tl.fromTo(el, { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)', ...IR }, t);
    tl.to(el, { y: `-=${8 + (i % 3) * 5}`, duration: 4.5, ease: 'sine.inOut' }, t + 0.5);
    if (i % 2 === 0) cue(t, 'pop-soft');
  });
  hide('#t-online', 19.0);
  // So he kept copies, everywhere: each paper falls into one of four places,
  // then the words come in above them, clear of the papers' flight.
  tl.set('#c-places', { autoAlpha: 1 }, 19.4);
  tl.fromTo($$('#c-places .wy-place'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.18, ...IR }, 19.4);
  cue(19.4, 'whoosh-soft');
  $$('#c-papers .wy-chip').forEach((el, i) => {
    const [x, y] = placeAt[i % 4];
    tl.to(el, { x, y, scale: 0.35, rotation: 0, autoAlpha: 0, duration: 0.75, ease: 'power2.in' }, 19.9 + i * 0.1);
  });
  cue(20.5, 'process', { dur: 0.8 });
  say('t-kept', 21.4);
  hide(['#t-kept', '#c-places'], 25.4);
  // The thought that stayed.
  say('t-pivot', 26.0, 2.0);
  hide('#t-pivot', 32.2);
  S.hero = 30.6;
  // So we built AskLocker: one place, where you just ask.
  const day = title(32.8);
  sceneIn('t-ask', day);
  phoneShow(day + 0.2, 'scr-ask');
  const ans = askTurn('ask', day + 1.3, C.ask, { type: 1.8, think: 1.6 });
  cue(ans + 0.6, 'section', { name: 'vault' });
  hide('#t-ask', ans + 4.0);
  phoneOut(ans + 4.0);
  // For your family, and for your business.
  const b = ans + 4.7;
  tl.set('#t-both', { autoAlpha: 1, y: 0 }, b);
  tl.fromTo($$('#t-both-h .wi'), { yPercent: 118 }, { yPercent: 0, duration: 0.95, ease: 'power4.out', stagger: 0.045, ...IR }, b);
  tl.fromTo($$('#t-both .wy-for'), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.35, ease: 'back.out(1.4)', ...IR }, b + 0.9);
  cue(b + 0.95, 'pop');
  cue(b + 1.3, 'pop');
  hide('#t-both', b + 6.0);
  endCard(b + 6.6);
}

if (FAMILY) {
  // What a family would need to know, if you weren't there.
  say('t-know', 0.5, 1.6);
  $$('#t-know .wy-item').forEach((el, i) => {
    tl.fromTo(el, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.55, ...IR }, 3.8 + i * 0.85);
    cue(3.8 + i * 0.85, 'pop-soft');
  });
  hide('#t-know', 10.0);
  // The money left unclaimed: how much, where, and why.
  const m = 10.6;
  tl.set('#t-money', { autoAlpha: 1, y: 0 }, m);
  fadeIn('#t-money .wy-stat-k', m, { from: 10 });
  count(m + 0.2, 1.6, (v) => { $('#t-money-num').textContent = `₹${(1.84 * v).toFixed(2)} lakh crore`; }, 'power2.out');
  cue(m + 0.2, 'process', { dur: 1.4 });
  fadeIn('#t-money-line', m + 1.9, { from: 14, duration: 0.6 });
  fadeIn('#t-money-src1', m + 2.4, { from: 8 });
  tl.fromTo($$('#t-money .wy-part'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.3, ...IR }, m + 3.4);
  cue(m + 3.4, 'pop-soft');
  fadeIn('#t-money-parts', m + 3.4, { from: 0, duration: 0.01 });
  fadeIn('#t-money-quote', m + 5.9, { from: 16, duration: 0.8 });
  cue(m + 6.0, 'pop-soft');
  fadeIn('#t-money-src2', m + 6.7, { from: 8 });
  S.hero = m + 9.0;
  hide('#t-money', m + 11.0);
  // My parents read Hindi and English. Writing it is hard.
  say('t-parents', m + 11.6, 1.7);
  hide('#t-parents', m + 17.2);
  // So we built a family vault they can talk to.
  const day = title(m + 17.8);
  sceneIn('t-voice', day);
  phoneShow(day + 0.2, 'scr-voice');
  // Maa taps the mic and asks in Hindi; the answer comes back, aloud.
  const c = C.voice;
  const t = day + 1.5;
  tap(t, c.P.mic);
  cue(t, 'mic-on');
  tl.to('#v-mic', { width: c.pillW, duration: 0.2, ease: 'power2.out' }, t + 0.02);
  swap('#mic-idle', '#mic-listen', t + 0.02, 0.15);
  swap('#v-ph-idle', '#v-ph-listen', t + 0.02, 0.15);
  tl.to('#v-icon-on', { autoAlpha: 1, duration: 0.15 }, t + 0.02);
  const q0 = t + 0.3;
  const q1 = q0 + VOICES.ask.dur;
  cue(q0, 'voice', { line: 'ask', wav: 'ask-hi.wav' });
  sub('sub-q', q0, q1 + 0.5);
  const typing = q1 - q0 - 0.2;
  tl.set('#v-ph-listen', { autoAlpha: 0 }, q0 + 0.3);
  type('#v-typed', c.VQ, q0 + 0.3, typing, ' ');
  if (c.ov.over) tl.to('#v-line', { x: -c.ov.over, duration: typing * (1 - c.ov.frac), ease: 'none' }, q0 + 0.3 + typing * c.ov.frac);
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
  const a0 = ans + 0.35;
  const a1 = a0 + VOICES.answer.sentence2;
  cue(a0, 'voice', { line: 'answer', wav: 'answer-hi.wav', to: VOICES.answer.sentence2 });
  sub('sub-a', a0 + 0.1, a1 + 0.1);
  tl.to('#v-hl', { backgroundSize: '100% 100%', duration: 0.6, ease: 'power2.inOut' }, a0 + VOICES.answer.number);
  swap('#mic-speak', '#mic-idle', a1 + 0.2, 0.2);
  swap('#v-stop1', '#v-again1', a1 + 0.2, 0.2);
  // What else they might ask: the nominee first. Percussion once the voice is done.
  showCallout('#co-asks', a1 + 0.3);
  cue(a1 + 0.6, 'section', { name: 'vault' });
  const out = a1 + 4.2;
  hide(['#t-voice', '#co-asks'], out);
  phoneOut(out);
  // Add each paper once.
  say('t-close', out + 0.7, 1.4);
  hide('#t-close', out + 5.6);
  endCard(out + 6.2);
}

if (BUSINESS) {
  // I run a business too, and every day someone needs a paper.
  say('t-open', 0.5, 1.6);
  hide('#t-open', 5.4);
  // The team's chat, all day: accounts, the CA, the godown, and the owner at night.
  const ch = 6.0;
  tl.fromTo('#c-chat', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.7, ...IR }, ch);
  cue(ch, 'whoosh-soft');
  $$('#c-chat .wy-msg').forEach((el, i) => {
    const t = ch + 0.9 + i * 1.65;
    tl.fromTo(el, { autoAlpha: 0, y: 16, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.5)', ...IR }, t);
    cue(t, el.classList.contains('me') ? 'send' : 'notif');
  });
  S.hero = ch + 7.6;
  hide('#c-chat', ch + 8.8);
  // The papers a business runs on.
  const p = ch + 9.4;
  say('t-papers', p);
  tl.fromTo($$('#t-papers .fm-tile'), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.16, ...IR }, p + 0.8);
  cue(p + 0.8, 'pop-soft');
  fadeIn('#t-papers-foot', p + 2.4, { from: 12, duration: 0.6 });
  hide('#t-papers', p + 6.2);
  // So we built one vault for your whole team.
  const day = title(p + 6.8);
  // Manage team: the team already in it, and the CA invited by the email they sign in with.
  const t = day;
  sceneIn('t-team', t);
  phoneShow(t + 0.2, 'scr-team');
  const P = C.team.P;
  tap(t + 1.6, P.add, { press: '#tm-add' });
  tl.to('#tm-dim', { autoAlpha: 1, duration: 0.25, ease: 'none' }, t + 1.7);
  tl.to('#tm-sheet', { yPercent: 0, duration: 0.4, ease: 'power3.out' }, t + 1.7);
  cue(t + 1.7, 'whoosh-soft');
  tap(t + 2.45, P.email);
  tl.to('#tm-email', { borderColor: TEAL, duration: 0.1, ease: 'none' }, t + 2.47);
  tl.set('#tm-email-ph', { autoAlpha: 0 }, t + 2.55);
  type('#tm-email-typed', BUS.BIZ.caEmail, t + 2.55, 0.95);
  tap(t + 3.75, P.shown);
  tl.to('#tm-email', { borderColor: '#D1D5DB', duration: 0.1, ease: 'none' }, t + 3.77);
  tl.to('#tm-shown', { borderColor: TEAL, duration: 0.1, ease: 'none' }, t + 3.77);
  tl.set('#tm-shown-ph', { autoAlpha: 0 }, t + 3.85);
  type('#tm-shown-typed', BUS.BIZ.caShown, t + 3.85, 0.8);
  tap(t + 5.0, P.send, { press: '#tm-send' });
  tl.to('#tm-sheet', { yPercent: 105, duration: 0.35, ease: 'power3.in' }, t + 5.1);
  tl.to('#tm-dim', { autoAlpha: 0, duration: 0.3, ease: 'none' }, t + 5.15);
  tl.to('#tm-banner', { height: C.team.bannerH, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, t + 5.4);
  tl.to('#tm-pending', { height: C.team.pendingH, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, t + 5.5);
  cue(t + 5.45, 'success');
  pulse('#tm-pending .tm-card', t + 6.1, ACCENT);
  hide('#t-team', t + 7.4);
  // Then anyone just asks: the September return, and its document; and what
  // the rest of the team asks.
  const a = t + 7.9;
  sceneIn('t-ask', a);
  nav('scr-team', 'scr-ask', a, 'push');
  const ans = askTurn('ask', a + 1.0, C.ask, { type: 1.6, think: 1.5 });
  showCallout('#co-asks', ans + 0.8);
  hide(['#t-ask', '#co-asks'], ans + 5.4);
  phoneOut(ans + 5.4);
  // Less chasing. More time for the business.
  const cl = ans + 6.1;
  cue(cl, 'section', { name: 'trust' });
  say('t-close', cl, 1.3);
  hide('#t-close', cl + 4.8);
  endCard(cl + 5.4);
}

finish(S);
