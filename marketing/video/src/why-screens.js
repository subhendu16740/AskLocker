// The why films (src/why.js): why AskLocker was made, in its founder's own
// words (3 November 2026), for anyone who will use it. Three films:
//   founder   the story: the one person in a family who handles everything,
//             parents who said "keep a record of everything you do online",
//             copies everywhere, and the question of who finds them if he is
//             not there. So: one place where you just ask.
//   family    what a family would not know without you (insurance,
//             investments, the nominee), the money left unclaimed in India,
//             and parents who read Hindi and English but find writing hard:
//             so they tap, speak in their own language, and hear the answer.
//   business  a business owner whom everyone asks for a paper (accounts,
//             the godown, the CA), the GST certificate, monthly returns,
//             advance tax, contracts and leases, and one vault the whole
//             team shares, where anyone asks and one question finds it.
//
// They make no claim about encryption, so they can be posted today; the end
// cards are today's. The numbers are sourced on screen: ₹1.84 lakh crore,
// the Finance Minister on 4 October 2025 (The Hindu / PTI); the breakdown and
// the quote, the Press Information Bureau's "Your Money, Your Right" release
// of 26 December 2025. The people are the films' fictional families: the
// Sharmas (family-screens.js) and Arora Electric (business-screens.js).
import { icon, sbFill, words, rich, brand, tabBar, askMessages, askHeader, saveBar, askInput } from './parts.js';
import { STORY } from './family-screens.js';
import { BIZ } from './business-screens.js';

/** Which of the three: ?reel=founder|family|business (render.mjs --reel). */
export const STORY_OF = new URLSearchParams(location.search).get('reel') || 'founder';
export const BUSINESS = STORY_OF === 'business';

const NAVY = '#2A3D66';
const CORAL = '#D4807B';
const TEAL = '#0F5C57';
const GOLD = '#B7791F';

// ─── Words on their own, at night ────────────────────────────────────────

/** Lines read one by one: plain, or em (the serif italic). top: under the
 * top edge, for something below them; day: dark words, for daylight. */
export function lines(id, list, { top = false, day = false } = {}) {
  return `<div class="wy-lines${day ? '' : ' on-dark'}${top ? ' top' : ''}" id="${id}">${list.map(([text, em], i) =>
    `<div class="${em ? 'big-em' : 'big'} wy-l" id="${id}-${i}">${words(text)}</div>`).join('')}</div>`;
}

/** Papers a family keeps, as chips that drift around the words. */
export function chips(id, list) {
  return `<div class="wy-chips" id="${id}">${list.map(([ic, label], i) =>
    `<span class="wy-chip" id="${id}-${i}">${icon(ic, 22, BUSINESS ? TEAL : NAVY, 2.2)}<span>${label}</span></span>`).join('')}</div>`;
}

/** Where the copies ended up. */
export function places(id, list) {
  return `<div class="wy-places" id="${id}">${list.map(([ic, title, line], i) =>
    `<div class="wy-place" id="${id}-${i}"><span class="wy-place-ic">${icon(ic, 30, '#fff', 2.2)}</span><b>${title}</b><span>${line}</span></div>`).join('')}</div>`;
}

/** What a family might not know: a question and its list. */
export function checklist(id, lead, em, list) {
  return `<div class="wy-check on-dark" id="${id}">
      <div class="big wy-l" id="${id}-lead">${words(lead)}</div>
      <div class="big-em wy-l" id="${id}-em">${words(em)}</div>
      <div class="wy-items">${list.map(([ic, text], i) =>
    `<div class="wy-item" id="${id}-${i}"><span class="wy-item-ic">${icon(ic, 26, '#fff', 2.2)}</span><span>${text}</span><b>?</b></div>`).join('')}</div>
    </div>`;
}

/** The money left unclaimed, where it is, and why (the Government's own words). */
export function unclaimed(id) {
  const part = ([ic, what, amount], i) => `<div class="wy-part" id="${id}-p${i}">${icon(ic, 22, CORAL, 2.2)}<span>${what}</span><b>${amount}</b></div>`;
  return `<div class="wy-stat on-dark" id="${id}">
      <div class="wy-stat-k">Across India</div>
      <div class="wy-num" id="${id}-num">₹0.00 lakh crore</div>
      <div class="wy-stat-line" id="${id}-line">lies unclaimed in bank accounts, insurance and investments.</div>
      <div class="wy-src" id="${id}-src1">Finance Minister of India, 4 October 2025</div>
      <div class="wy-parts" id="${id}-parts">${[
    ['credit-card', 'Bank deposits', 'about ₹78,000 cr'],
    ['shield', 'Insurance', 'about ₹14,000 cr'],
    ['percent', 'Dividends', 'about ₹9,000 cr'],
    ['bar-chart-2', 'Mutual funds', 'about ₹3,000 cr'],
  ].map(part).join('')}</div>
      <div class="wy-quote" id="${id}-quote">“In many cases, families are simply unaware that such assets exist.”</div>
      <div class="wy-src" id="${id}-src2">Government of India, Press Information Bureau, 26 December 2025</div>
    </div>`;
}

/** The team's group chat: everyone, all day, asking the owner for a paper
 * (the business film's team: Ravi in accounts, Sunil at the godown, and
 * Pooja, the CA). */
export function chat(id) {
  const msg = (i, who, text, time, from = '', colour = '') => `<div class="wy-msg ${who}" id="${id}-${i}">${from ? `<b class="wy-from" style="color:${colour}">${from}</b>` : ''}<span>${text}</span><i>${time}</i></div>`;
  return `<div class="wy-chat" id="${id}">
      <div class="wy-chat-h"><span class="wy-chat-av">${icon('users', 26, '#fff', 2.2)}</span><div><b>${BIZ.name} team</b><span>Ravi, Pooja, Sunil, You</span></div></div>
      <div class="wy-chat-b">
        ${msg(0, 'them', `Where's the ${BIZ.supplier} bill? Payment is due Friday.`, '10:12 AM', 'Ravi · Accounts', '#0F5C57')}
        ${msg(1, 'them', "Need September's purchase bills for the GST return.", '1:40 PM', 'Pooja · CA', '#B7791F')}
        ${msg(2, 'them', 'Is the godown lease renewed? The owner is asking.', '4:05 PM', 'Sunil · Godown', '#6D28D9')}
        ${msg(3, 'me', 'Let me look… which email was it in?', '9:52 PM')}
      </div>
    </div>`;
}

/** The papers a business keeps, as the business film's tiles. */
export function tiles(id, lead, list, foot) {
  return `<div class="wy-tiles on-dark" id="${id}">
      <div class="big wy-l" id="${id}-lead">${words(lead)}</div>
      <div class="fm-grid wy-grid">${list.map(([ic, label], i) =>
    `<div class="fm-tile" id="${id}-${i}"><span class="fm-ti">${icon(ic, 22, TEAL, 2.2)}</span><span>${label}</span></div>`).join('')}</div>
      <div class="wy-foot" id="${id}-foot">${foot}</div>
    </div>`;
}

/** Beside the phone: a label, a heading (*stars* in the serif) and a line. */
export function scene(id, kicker, ic, head, sub) {
  return `<div class="tblock wy-scene" id="${id}">
      <div class="kicker">${icon(ic, 22, 'currentColor', 2.4)}<span>${kicker}</span></div>
      <div class="h1">${rich(head)}</div>
      <div class="sub">${sub}</div>
    </div>`;
}

/** For your family, and for your business: the founder film's last word. */
export function both(id) {
  const card = (i, ic, title, line, biz) => `<div class="wy-for${biz ? ' biz' : ''}" id="${id}-${i}">
      <span class="wy-for-ic">${icon(ic, 30, '#fff', 2.2)}</span><b>${title}</b><span>${line}</span></div>`;
  return `<div class="wy-both" id="${id}">
      <div class="wy-both-h" id="${id}-h">${words('Built for the people who count on you.')}</div>
      <div class="wy-fors">
        ${card(0, 'users', 'For your family', 'Your parents ask in their own language, and hear the answer.')}
        ${card(1, 'briefcase', 'For your business', 'Partners, staff and your CA in one vault. One question finds any paper.', true)}
      </div>
    </div>`;
}

export const titleCard = (tagline) => (BUSINESS ? brand('title', tagline, { badge: 'for Business' }) : brand('title', tagline));
export function endCard() {
  if (BUSINESS) return brand('endcard', BIZ.tagline, { badge: 'for Business', cta: BIZ.cta, ctaNote: BIZ.ctaNote, url: BIZ.url, end: true });
  if (STORY_OF === 'family') return brand('endcard', 'Every family document. One question away.', { cta: STORY.cta, ctaNote: 'Free to start', url: 'asklocker.com', end: true });
  return brand('endcard', 'Every document. One question away.', { cta: 'Start your vault', ctaNote: 'Free to start', url: 'asklocker.com', end: true });
}

// ─── The phone: Ask, in a business, for the month's GST return ───────────
// The business film's Ask (business-screens.js), asked for what a CA files:
// a GSTR-3B, with its filing date and the tax paid. Fictional, as every
// number in the films is.
export const GST_Q = 'Where is our GSTR-3B for September?';
export function gstAskScreen() {
  const cats = ['Sales Invoices', 'Purchase Bills', 'GST Returns', 'Contracts & Agreements', 'Licences & Registrations', 'Bank & Loans',
    'Business Insurance', 'Employee Records'];
  const turns = [{
    q: GST_Q, loading: 'Searching documents...',
    a: `Your GSTR-3B for September 2026 was filed on <mark class="hl" id="ask-hl">20 October 2026</mark>, with ₹42,350 of tax paid. It's in your GST Returns.`,
    src: 'GSTR-3B Sep 2026.pdf',
  }];
  return `<section class="scr biz" id="scr-ask">${sbFill}
    ${askHeader('ask', 'business')}
    <div class="ask-area" id="ask-area">
      <div class="ask-empty" id="ask-empty">
        <div class="ask-hero"><div class="ic grad">${icon('cpu', 32, '#fff')}</div>
          <div class="t">Ask anything about your documents</div><div class="s">I'll search all your documents.</div></div>
        <div class="ask-cats">${cats.map((c) => `<span class="ask-cat">${c}</span>`).join('')}</div>
      </div>
      <div class="chat-stack" id="ask-stack">${askMessages('ask', turns, false)}</div>
    </div>
    <div class="ask-bottom">${saveBar('ask')}${askInput('ask')}</div>
    ${tabBar('search', 'ask', 'business')}
  </section>`;
}

// ─── Callouts beside the phone ───────────────────────────────────────────

const label = (ic, text) => `<div class="co-label">${icon(ic, 14, 'currentColor', 2.6)}<span>${text}</span></div>`;
const ask = (q) => `<div class="co-ask"><span class="q">${q}</span></div>`;
export const WY_CALLOUTS = {
  // What else a parent might ask: the nominee first.
  family: () => `<div class="callout" id="co-asks" style="width:400px">${label('message-circle', 'Or ask')}
    ${ask('“Who is the nominee?”')}${ask('“When does the FD mature?”')}${ask('“Where is the house paper?”')}</div>`,
  // What the rest of the team asks: accounts, the godown, anyone.
  business: () => `<div class="callout" id="co-asks" style="width:400px">${label('users', 'Your team asks too')}
    ${ask(`“When is the ${BIZ.supplier} bill due?”`)}${ask('“Is the godown lease renewed?”')}${ask('“Where is the GST certificate?”')}</div>`,
};
