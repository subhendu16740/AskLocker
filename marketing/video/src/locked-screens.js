// The launch film's own pieces (src/locked.js): what AskLocker does once
// end-to-end encryption ships, in the encryption brief's words (3 November
// 2026). Like everything behind ?claims=launch (src/claims.js) it is never
// posted before the owner confirms the launch.
//
// Every claim is the brief's: documents locked on members' phones, one key
// per vault and one per file (AES-256-GCM), AskLocker storing only scrambled
// copies, the phone searching its own unlocked copy and sending only the
// passages a question needs, which the server passes to an AI service and
// does not keep, a share link carrying that one file's key, a new member
// handed the vault key when they accept, and a Recovery Key, another phone
// or a recovery contact to get back in. The Recovery Key and new-phone
// screens are drawn from the brief, in the app's style: those screens are
// still being built, so check them against the app before release.
// CLAUDE.md's rule holds: never "secure", "safe", "100% private", "only you
// can see it", "nothing is kept", "zero-knowledge" or "end-to-end encrypted".
import { icon, sbFill, header, words, brand, tabBar } from './parts.js';
import { STORY } from './family-screens.js';
import { END_LINE, LAUNCH_LINE } from './claims.js';

const NAVY = '#2A3D66';
const CORAL = '#D4807B';
const GREEN = '#16A34A';
const AMBER = '#B45309';
const RED = '#DC2626';

// ─── Words ───────────────────────────────────────────────────────────────

export function openLines() {
  return `<div class="pv-open on-dark" id="t-open">
      <div class="big pv-l" id="pv-l1">${words('Your passport.')}</div>
      <div class="big pv-l" id="pv-l2">${words("Papa's health policy.")}</div>
      <div class="big pv-l" id="pv-l3">${words('Your PAN card.')}</div>
    </div>
    <div class="center-block on-dark pv-before" id="t-before">
      <div class="big">${words('Before they leave your phone,')}</div><div class="big-em">${words("they're locked.")}</div>
    </div>`;
}
export const titleCard = () => brand('lk-title', LAUNCH_LINE);
export function closeBlock() {
  return `<div class="center-block lk-close" id="t-close">
      <div class="big">${words('Your family holds the key.')}</div>
      <div class="big-em">${words("We don't.")}</div>
      <div class="pv-close-sub" id="lk-close-sub">Keep your Recovery Key safe. We can't open your vault, and we can't recover it for you.</div>
    </div>`;
}
export const endCard = () => brand('endcard', END_LINE.family,
  { cta: STORY.cta, ctaNote: 'Free to start', url: 'asklocker.com', end: true });

// ─── 01 What happens when you add a document ────────────────────────────

// Bytes as AskLocker's servers hold them: random, so nobody can read them.
const SCRAMBLED = ['7f3a c9e1 04bd 9a52 e8c0 1f6d', 'b26e 0d94 7ac3 f15b 3e08 c7a9', '58d1 a4f2 6b0e 93c7 2d5a e140',
  'c08b 3f69 d27e 15a4 8bc2 6f3d', '91e7 4a0c b8d5 2f63 e9a1 07bc', 'd4f0 6c28 a1b9 5e73 0d4f 8a62'];

export function lockDiagram() {
  const step = (id, ic, t, s) => `<div class="lk-step" id="${id}"><span class="lk-step-ic">${icon(ic, 22, NAVY, 2.2)}</span><div><b>${t}</b><span>${s}</span></div></div>`;
  return `<div class="pv-dg lk-lock" id="dg-lock">
      <div class="lk-col lk-phone" id="lk-phone">
        <div class="lk-col-h">${icon('smartphone', 18, CORAL, 2.4)}<span>On your phone</span></div>
        <div class="lk-doc" id="lk-doc"><span class="lk-doc-ic">${icon('book-open', 26, NAVY, 2)}</span><b>Maa Passport.jpg</b><span>Passport · ${STORY.maa}</span>
          <span class="lk-padlock" id="lk-padlock">${icon('lock', 20, '#fff', 2.6)}</span></div>
        ${step('lk-s1', 'file-text', 'Read on your phone', 'Its text, search data and expiry date')}
        ${step('lk-s2', 'key', 'Locked with its own key', "And that key with your vault's key")}
      </div>
      <div class="lk-wire" id="lk-wire"><i class="lk-wire-line" id="lk-line"></i>
        <span class="lk-packet" id="lk-packet">${icon('lock', 18, '#fff', 2.6)}<span>7f3a c9e1…</span></span>
        <span class="lk-wire-t" id="lk-wire-t">Only scrambled data leaves</span></div>
      <div class="lk-col lk-server" id="lk-server">
        <div class="lk-col-h">${icon('server', 18, CORAL, 2.4)}<span>AskLocker's servers</span></div>
        <div class="lk-bytes" id="lk-bytes">${SCRAMBLED.map((l) => `<code>${l}</code>`).join('')}</div>
        <div class="lk-server-t" id="lk-server-t">${icon('eye-off', 18, NAVY, 2.4)}<span>Stored scrambled. <b>Nobody here can read it.</b></span></div>
      </div>
    </div>`;
}

// ─── 02 Who can open it ──────────────────────────────────────────────────

export function whoDiagram() {
  const row = (id, kind, ic, title, line) => `<div class="pv-who ${kind}" id="${id}">
      <span class="pv-who-ic">${icon(ic, 26, kind === 'no' ? RED : kind === 'team' ? AMBER : NAVY, 2.2)}</span>
      <div class="pv-who-t"><b>${title}</b><span>${line}</span></div>
      <span class="pv-who-mark">${icon(kind === 'no' ? 'x' : 'check', 22, kind === 'no' ? RED : kind === 'team' ? AMBER : GREEN, 3)}</span>
    </div>`;
  return `<div class="pv-dg pv-card" id="dg-who">
      <div class="pv-card-h">${icon('key', 20, CORAL, 2.4)}<span>Who can open your documents</span></div>
      ${row('lw-vault', 'yes', 'users', 'People in your vault', 'Only they have its key, on their own phones')}
      ${row('lw-link', 'yes', 'link', 'Anyone you send a link to', "That one file, with that file's key")}
      ${row('lw-team', 'no', 'server', "AskLocker's team", 'Sees only scrambled copies')}
      ${row('lw-break', 'no', 'user-x', 'Someone who breaks into our servers', 'Scrambled copies, and no key')}
      ${row('lw-ai', 'team', 'cpu', 'An AI service', 'Only the parts a question needs, while the answer is written')}
      <div class="pv-card-foot" id="lw-foot">${icon('key', 18, NAVY, 2.4)}<span>Each vault has its own key. <b>AskLocker never has it.</b></span></div>
    </div>`;
}

// ─── 03 Asking: the phone finds the page ────────────────────────────────

export function askFlow() {
  const node = (id, ic, t, s, cls = '') => `<div class="lk-node ${cls}" id="${id}"><span class="lk-node-ic">${icon(ic, 26, cls === 'ai' ? '#fff' : NAVY, 2.2)}</span><b>${t}</b><span>${s}</span></div>`;
  const arrow = (id, t) => `<div class="lk-arrow" id="${id}"><i></i><span>${t}</span></div>`;
  return `<div class="pv-dg lk-flow" id="dg-flow">
      <div class="lk-flow-h">${icon('search', 18, CORAL, 2.6)}<span>Answering “${'What is Papa\'s health insurance policy number?'}”</span></div>
      <div class="lk-flow-row">
        ${node('lf-phone', 'smartphone', 'Your phone', 'Searches its own unlocked copy and picks the parts that answer it')}
        ${arrow('lf-a1', 'The question and those parts. Never the key.')}
        ${node('lf-server', 'server', "AskLocker's server", 'Passes them on. Keeps nothing.')}
        ${arrow('lf-a2', 'Only to write the answer')}
        ${node('lf-ai', 'cpu', 'An AI service', 'Writes the answer', 'ai')}
      </div>
      <div class="lk-flow-foot" id="lf-foot">${icon('lock', 18, NAVY, 2.4)}<span>The rest of your vault stays locked on your phone. <b>We don't keep your questions.</b></span></div>
    </div>`;
}

// ─── 04 What AskLocker can and cannot see ───────────────────────────────

const SEES = [
  ['file-text', 'Documents', 'That one exists, its size, date and category', 'The file, its name, its text'],
  ['plus-square', 'Emergency cards', 'That a card exists', 'Blood group, allergies, medicines'],
  ['git-branch', 'Family tree', 'Who has an account, in which vault', 'Names, relations, birthdays'],
  ['message-circle', 'Saved chats and notes', 'That they exist', 'What they say'],
  ['users', 'Vaults', 'That a vault exists, and who is in it', 'Its name'],
  ['search', 'Questions', 'The question and its parts, while answering', 'Anything else in your vault'],
  ['bell', 'Reminders', 'Nothing: your phone works them out', 'Expiry dates, birthdays'],
];
export function seesTable() {
  return `<div class="pv-dg pv-card lk-sees" id="dg-sees">
      <div class="lk-sees-head"><span></span><b class="can">${icon('eye', 16, AMBER, 2.4)}AskLocker can see</b><b class="cant">${icon('eye-off', 16, GREEN, 2.4)}It cannot see</b></div>
      ${SEES.map(([ic, what, can, cant], i) => `<div class="lk-sees-row" id="ls-${i}">
        <span class="lk-sees-what">${icon(ic, 18, NAVY, 2.2)}<b>${what}</b></span><span class="can">${can}</span><span class="cant">${cant}</span></div>`).join('')}
      <div class="pv-card-foot" id="ls-foot">${icon('slash', 18, NAVY, 2.4)}<span>We don't sell your data. <b>AskLocker has no ads.</b></span></div>
    </div>`;
}

// ─── 05 A new phone: the Recovery Key ────────────────────────────────────
// Drawn from the brief: shown once at setup, saved to a password manager or
// printed; a recovery contact the person picks; on a new phone, the key,
// another phone, or that contact. Still being built: check before release.

export const RECOVERY_KEY = ['K7QM', '2XC4', 'D8RT', 'EW3N', 'B5HJ', 'F9LP'];

export function recoveryScreen() {
  return `<section class="scr" id="scr-recovery">${sbFill}
    ${header('Recovery Key')}
    <div class="lk-body">
      <div class="lk-card">
        <div class="lk-card-t">${icon('key', 18, NAVY)}<span>Your Recovery Key</span></div>
        <div class="lk-card-b">If you lose every phone, this gets you back in. We can't recover it for you.</div>
        <div class="lk-key" id="lk-key">${RECOVERY_KEY.map((g, i) => `<span id="lk-k${i}">${g}</span>`).join('')}</div>
        <div class="lk-btn" id="lk-save">${icon('save', 16, '#fff')}<span>Save to password manager</span></div>
        <div class="lk-btn ghost">${icon('printer', 16, NAVY)}<span>Print it</span></div>
        <div class="lk-saved" id="lk-saved">${icon('check-circle', 16, GREEN)}<span>Saved to your password manager</span></div>
      </div>
      <div class="lk-card">
        <div class="lk-card-t">${icon('life-buoy', 18, NAVY)}<span>Recovery contact</span></div>
        <div class="lk-card-b">Someone in your family who can let you back in.</div>
        <div class="lk-contact" id="lk-contact"><span class="lk-av">R</span><div><b>${STORY.papa}</b><span>Father · "Papa"</span></div>
          <span class="lk-picked" id="lk-picked">${icon('check', 16, GREEN, 3)}</span></div>
      </div>
    </div>
  </section>`;
}

export function newPhoneScreen() {
  const opt = (id, ic, t, s) => `<div class="lk-opt" id="${id}"><span class="lk-opt-ic">${icon(ic, 18, NAVY)}</span><div><b>${t}</b><span>${s}</span></div>${icon('chevron-right', 16, '#9CA3AF')}</div>`;
  return `<section class="scr" id="scr-newphone">${sbFill}
    ${header('Unlock your vaults')}
    <div class="lk-body">
      <div class="lk-note">${icon('smartphone', 16, NAVY)}<span>Signed in as ${STORY.youFull}. Your vaults are still locked on this phone.</span></div>
      ${opt('lk-o1', 'key', 'Use your Recovery Key', 'The key you saved when you set up')}
      ${opt('lk-o2', 'smartphone', 'Approve from your other phone', 'If you still have it')}
      ${opt('lk-o3', 'life-buoy', `Ask ${STORY.papa}`, 'Your recovery contact')}
      <div class="lk-field" id="lk-field"><span id="lk-typed"></span><span class="caret" id="lk-caret" style="opacity:0"></span></div>
      <div class="lk-open" id="lk-open">${icon('unlock', 18, '#fff', 2.4)}<span>Your vaults are open on this phone</span></div>
    </div>
  </section>`;
}

// ─── 07 Adding family: Accept, and the vault opens ──────────────────────
// Home on Priya's phone (components/invitation-cards.tsx): the card, Accept,
// and the app's own line once she has joined.

export function inviteScreen() {
  const doc = (ic, name, kind) => `<div class="lk-rdoc"><span class="lk-rdoc-ic">${icon(ic, 16, NAVY)}</span><div><b>${name}</b><span>${kind}</span></div></div>`;
  return `<section class="scr" id="scr-invite">${sbFill}
    <div class="lk-home-h"><div><span>Good morning</span><b>Priya</b></div><span class="lk-bell">${icon('bell', 20, NAVY)}</span></div>
    <div class="lk-body">
      <div class="lk-inv" id="lk-inv">
        <div class="lk-inv-top"><span class="lk-inv-ic">${icon('mail', 16, NAVY)}</span>
          <div><span class="lk-inv-who">${STORY.youFull} invited you to join</span><b>${STORY.familyName}</b>
            <span class="lk-inv-sub">Accept to see its documents, as a viewer. You can leave any time.</span></div></div>
        <div class="lk-inv-btns"><span class="lk-inv-no">Decline</span><span class="lk-inv-yes" id="lk-accept">Accept</span></div>
      </div>
      <div class="lk-news" id="lk-news">${icon('check-circle', 16, GREEN)}<span>You joined ${STORY.familyName}. Its documents are on Home now.</span></div>
      <div class="lk-recent" id="lk-recent"><div class="overline">Recent documents</div>
        ${doc('shield', STORY.scanFile, 'Health Insurance · ' + STORY.familyName)}
        ${doc('book-open', 'Papa Passport.pdf', 'Passport · ' + STORY.familyName)}
        ${doc('truck', 'Car Insurance.pdf', 'Vehicle Insurance · ' + STORY.familyName)}</div>
    </div>
    ${tabBar('home', 'iv')}
  </section>`;
}

// ─── Callouts beside the phone ───────────────────────────────────────────

const label = (ic, text) => `<div class="co-label">${icon(ic, 14, CORAL, 2.6)}<span>${text}</span></div>`;
const check = (text, ic = 'check', c = GREEN) => `<div class="co-check">${icon(ic, 16, c, 2.6)}<span>${text}</span></div>`;

export const LK_CALLOUTS = {
  key: () => `<div class="callout" id="co-key" style="width:420px">${label('rotate-ccw', 'Your way back')}
    ${check('Your Recovery Key, shown once', 'key')}${check('Your other phone, if you still have it', 'smartphone')}
    ${check('A family member you chose', 'life-buoy')}
    <div class="co-quiet">We can't recover your documents for you. Support can help you sign in, never open your vault.</div></div>`,
  share: () => `<div class="callout" id="co-share" style="width:400px">${label('link', 'One document, one link')}
    ${check('Opens without an account')}${check('Lasts 1 or 7 days, or 30 with Family Plus')}${check('Turn it off any time')}
    <div class="co-quiet">The link carries that one file's key. The rest of your vault stays locked.</div></div>`,
  family: () => `<div class="callout" id="co-family" style="width:410px">${label('user-plus', 'One tap to join')}
    ${check('An admin invites by email')}${check('They tap Accept, and they are in')}${check("The app hands them the vault's key", 'key')}
    <div class="co-quiet">No codes to check. Checks in the background stop our own server slipping in a stranger.</div></div>`,
  emergency: () => `<div class="callout" id="co-emergency" style="width:380px">${label('plus-square', 'In an emergency')}
    ${check('Blood group, allergies, medicines')}${check('Doctor and family, one tap to call')}${check('Only your family can open it', 'lock')}
    <div class="co-quiet">Nobody at AskLocker can open your emergency cards.</div></div>`,
};
