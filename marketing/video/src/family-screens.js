// HTML for the family film. The phone screens are ports of the real screens
// in src/app/** — same copy, same layout, same Feather glyphs, sized by
// src/constants/design.ts — filled with a fictional family (the Sharmas) and a
// fictional insurer. Rohan is an admin of Sharma Family, on Family Plus, and
// has the personal vault every account gets (046): two vaults in Family mode.
import {
  icon, logoMark, spinner, sbFill, plusTag, plusStar, header, tabBar, avatar, words, chip, categoryChips, ocrSlot,
  uploadedDialog, lockScreen, lockNotif, pushNotif, callScreen, cameraScreen, phoneShell, askMessages, askHeader,
  searchIn, saveBar, askInput, whyHow, trustBlock, brand,
} from './parts.js';
import { VOICE_LINES, APP_PHRASES, voiceSubtitles } from './voice-lines.js';
import { FILM } from './engine.js';

// ─── Story data (edit here to re-cast the film) ──────────────────────────
// Two stories share these scenes: the family film (Rohan in Bengaluru) and
// the NRI film (?film=nri: Rohan in Toronto, who set up his parents' policies
// and deposits from abroad, so they have to ask him for any of it).
const FAMILY_STORY = {
  you: 'Rohan',
  youFull: 'Rohan Sharma',
  email: 'rohan.sharma@gmail.com',
  familyName: 'Sharma Family',
  policyNo: 'ASH23114589',
  insurer: 'Arogya Shield',
  papa: 'Ramesh Sharma',
  maa: 'Sunita Sharma',
  dadi: 'Kamala Sharma',
  // A camera scan is saved as scan_<Date.now()>.jpg (upload.tsx): this one was
  // taken at 9:41 on Sunday 1 November 2026.
  scanFile: 'scan_1793506263481.jpg',
  // The end card. Leave ctaNote or url empty to show nothing there.
  cta: 'Start your family vault',
  ctaNote: 'Free to start · ★ Family Plus ₹100 a month',
  url: '',
  // Rohan's phone shows his own time: the night of the admission, the minute
  // after, and the morning a reminder arrives (made at 9, pushed at 9:05, India time).
  t: { lock: '2:14', lockDate: 'Tuesday, 10 November', lock2: '2:15', day: '9:05', dayDate: 'Monday, 2 November' },
  where: "Maa and Papa are in <b>Lucknow</b>.<br>You're in <b>Bengaluru</b>.",
  maaMsgs: ['Beta, Papa ko hospital laaye hain 🙏', 'Insurance ka policy number maang rahe hain. Kahan rakha hai??'],
  maaThanks: 'Mil gaya beta 🙏 Cashless approve ho gaya. Tum so jao ❤️',
  subs: ["Son, we've brought Papa to the hospital.", "They're asking for the insurance policy number. Where is it?",
    '“Found it, son. Cashless is approved. Go back to sleep.”'],
  callFrom: 'Mobile · Lucknow',
  // The scramble: what each card says, and the clock chip's place name.
  chipWhere: '',
  caps: ['Somewhere in 2,847 emails…', '…or the old office email?', 'The PDF wants a password.',
    "The OTP goes to Papa's phone.", 'The original is in the almirah back home.'],
  dead: { icon: 'mail', top: 'rohan@previous-employer.com', alert: 'lock', title: 'This account has been disabled.',
    body: 'Group health cover documents are no longer available. Contact your IT administrator.' },
  insight: ["You'll find it. Eventually.", "Your family won't."],
  question: "Now imagine you're the one who can't pick up.",
  why: {
    gmail: 'Your policies are buried somewhere in *2,847 emails.*',
    scan: ['The originals sit in an almirah, *in another city.*', 'Photograph them once.'],
    voice: ['Not every parent types, *or reads English.*', 'They ask out loud and hear the answer.'],
    alerts: ['Policies lapse quietly.|You find out *the day you need~one.*',
      '90, 30 and 7 days before a policy or passport runs out, on their phones too. Birthdays as well.'],
  },
  res: { kicker: 'The same night, with AskLocker', h1b: 'Sorted in a minute.', sub: 'No calls. No passwords. No digging through inboxes.' },
  // Gmail import: whose the documents are, and the import button's total.
  gmailOwner: 'go-me',
  gmailSize: '≈2.1 MB',
  sonPhone: '+91 91234 56789',
  // The morning's reminders, in the server's words (051's queue_family_expiry_reminders,
  // 064's set_family_plan).
  expiry: ['Car Insurance expires in 7 days', 'Expires on 9 Nov 2026 · Rohan Sharma. Renew it soon.'],
  planNote: 'Room for 10 GB of documents, until 1 Nov 2027.',
};

const NRI_STORY = {
  ...FAMILY_STORY,
  // From 066: Family Plus is ₹99 a month in India and $10 abroad. A payer
  // abroad pays in dollars only once RAZORPAY_CURRENCIES says INR,USD, so the
  // card names the rupee price, which anyone in the family in India can pay.
  ctaNote: 'Free to start · ★ Family Plus from ₹99 a month',
  // Toronto in November is UTC−5, 10½ hours behind India: 2:14 AM on Tuesday
  // 10 November in Lucknow is 3:44 PM on Monday 9 November in Toronto, and a
  // reminder pushed at 9:05 India time on 2 November reaches him at 10:35 PM
  // on 1 November (Canada's clocks went back that morning).
  t: { lock: '3:44', lockDate: 'Monday, 9 November', lock2: '3:45', day: '10:35', dayDate: 'Sunday, 1 November' },
  where: "Maa and Papa are in <b>Lucknow</b>.<br>You're in <b>Toronto</b>, 10½ hours behind.",
  maaMsgs: ['Beta, Papa ko hospital laaye hain 🙏', 'Policy number maang rahe hain. Tumne hi li thi na??'],
  maaThanks: 'Mil gaya beta 🙏 Cashless approve ho gaya. Tum aaram se kaam karo ❤️',
  subs: ["Son, we've brought Papa to the hospital.", "They want the policy number. You're the one who bought it, right?",
    '“Found it, son. Cashless is approved. Carry on with your work.”'],
  callFrom: 'Mobile · India',
  chipWhere: ' in Lucknow',
  caps: ['Somewhere in 2,847 emails…', 'The helpline opens at 8 AM.', 'The PDF wants a password.',
    "The OTP goes to Papa's phone.", 'The original is in an almirah, half a world away.'],
  dead: { icon: 'phone', top: 'Arogya Shield · Customer care', alert: 'phone-off', title: 'Our lines are closed.',
    body: 'Customer care is open 8 AM to 8 PM, India time. Please call back then.' },
  insight: ['You handle all of it, from abroad.', "They can't find any of it."],
  question: "Now imagine you're in a meeting when she calls.",
  why: {
    gmail: 'Their policies and deposits land in *your inbox,* not theirs.',
    scan: ['The originals sit in an almirah, *in Lucknow.*', 'Photograph them on your next trip home.'],
    voice: ['Maa shouldn\'t have to *call you for a number.*', 'She asks out loud and hears the answer.'],
    alerts: ['Policies lapse quietly,|*half a world away.*',
      '90, 30 and 7 days before a policy or passport runs out, on your phone and theirs. Birthdays as well.'],
  },
  res: { kicker: 'The same night in Lucknow, with AskLocker', h1b: 'Sorted before your meeting ends.',
    sub: 'No calls across time zones. No passwords. No digging through inboxes.' },
  // Everything he imports is Papa's: his policies, deposits, tax and ID.
  gmailOwner: 'go-papa',
  gmailSize: '≈2.6 MB',
  // 555-0100 to 555-0199 are North America's numbers for fiction.
  sonPhone: '+1 416 555 0142',
  // The passport's 30-day stage is due on 2 November in India: it expires on 2 December.
  expiry: ['Papa Passport expires in 30 days', 'Expires on 2 Dec 2026 · Ramesh Sharma. A good time to renew it.'],
  // 066's Family Plus holds 500 MB, which set_family_plan's notice rounds to 0.5 GB.
  planNote: 'Room for 0.5 GB of documents, until 1 Nov 2027.',
};

export const STORY = FILM === 'nri' ? NRI_STORY : FAMILY_STORY;

// Upload offers twelve categories, in this order, before More… (the family
// order in supabase/functions/_shared/doc-category.ts).
const CATEGORIES = [
  'Passport', 'National ID / Aadhaar', 'PAN Card', 'Driving License', 'Health Insurance', 'Vehicle Insurance',
  'Bank Statements', 'Tax Returns', 'Property Documents', 'Medical Records', 'Voter ID', 'Life Insurance',
];
export const HEALTH = CATEGORIES.indexOf('Health Insurance');
// Ask's empty state offers the first eight family categories by name.
const ASK_CATEGORIES = [
  'Bank Statements', 'Birth Certificate', 'Death Certificate', 'Driving License',
  'Educational Certificates', 'Employment Letters', 'Health Insurance', 'Legal Documents',
];

// The voice languages, as Settings › Accessibility › Voice language lists
// them (src/lib/voice-languages.ts). One code per language drives listening,
// the written answer and the voice that reads it.
export const VOICE_LANGUAGES = [
  ['हिन्दी', 'Hindi'], ['বাংলা', 'Bengali'], ['தமிழ்', 'Tamil'], ['తెలుగు', 'Telugu'], ['मराठी', 'Marathi'],
  ['ગુજરાતી', 'Gujarati'], ['ಕನ್ನಡ', 'Kannada'], ['മലയാളം', 'Malayalam'], ['ਪੰਜਾਬੀ', 'Punjabi'], ['English', 'India'],
];

// ─── The fictional policy document ───────────────────────────────────────
// Labels are chosen so the app's real extractor (supabase/functions/_shared/
// metadata.ts, extractMetadata) reads exactly what the "Read off the page"
// callout shows: "Policy Number" (not "Policy No.", whose full stop the regex
// rejects), "Sum insured", "Valid till". Nothing above the policy row may
// contain the word "policy", or the regex grabs the next word. The callout
// leaves out the name: the name pattern runs on into the next line's first
// word ("Ramesh Sharma Members"), so it would not read cleanly.
export function policyPaper(id = '') {
  return `<div class="paper" ${id ? `id="${id}"` : ''}>
    <div class="pp-head">
      <div class="pp-brand"><div class="pp-mark">${icon('shield', 14, '#fff', 2.4)}</div>
        <div class="pp-name">AROGYA SHIELD<small>HEALTH INSURANCE CO. LTD.</small></div></div>
      <div class="pp-kind">SCHEDULE OF<br>INSURANCE</div>
    </div>
    <div class="pp-title">FAMILY FLOATER HEALTH PLAN</div>
    <div class="pp-row"><span class="pp-k">Policy Number</span><b>${STORY.policyNo}</b></div>
    <div class="pp-row"><span class="pp-k">Insured name</span><b>${STORY.papa}</b></div>
    <div class="pp-row"><span class="pp-k">Members covered</span><span>Ramesh Sharma, Sunita Sharma</span></div>
    <div class="pp-row"><span class="pp-k">Sum insured</span><b>₹10,00,000</b></div>
    <div class="pp-row"><span class="pp-k">Policy period</span><span>15/03/2026 to 14/03/2027</span></div>
    <div class="pp-row"><span class="pp-k">Valid till</span><b>14/03/2027</b></div>
    <div class="pp-row"><span class="pp-k">Premium paid</span><span>₹24,318 (incl. GST)</span></div>
    <div class="pp-lines"><i style="width:94%"></i><i style="width:81%"></i><i style="width:88%"></i><i style="width:60%"></i></div>
    <div class="pp-foot"><span>Computer-generated schedule.<br>Keep it safe for claims.</span><span class="pp-sign">R. Iyer</span></div>
    <div class="pp-spec">SPECIMEN</div>
  </div>`;
}

// ─── Upload (src/app/(tabs)/upload.tsx) ──────────────────────────────────

function uploadScreen() {
  return `<section class="scr" id="scr-upload">${sbFill}
    ${header('Upload Document')}
    <div class="up-body">
      <div class="up-h">Choose source</div>
      <div class="up-primary">
        <div class="up-scan" id="up-scan">${icon('camera', 28, '#fff')}<span>Scan</span></div>
        <div class="up-browse">${icon('folder', 28, '#2A3D66')}<span>Browse Files</span></div>
      </div>
      <div class="up-secondary">
        <div class="up-sbtn">${icon('image', 22, '#2A3D66')}<span>Gallery</span></div>
        <div class="up-sbtn" id="up-gmail">${icon('mail', 22, '#2A3D66')}<span>From Gmail</span>${plusTag()}</div>
      </div>
      <div class="up-hint">${icon('info', 16, '#6B7280')}<span>PDF, PNG or JPG</span></div>
    </div>
    ${tabBar('upload', 'up')}
  </section>`;
}

// "Where should this go?": a field that drops the vaults down under it
// (components/vault-sheet.tsx). The hint under it says who will see the file.
function vaultField() {
  const row = (id, ic, name, sub) => `<div class="vm-row" id="${id}">
      <span class="vf-ic">${icon(ic, 16, '#2A3D66')}</span><span class="vm-t"><b>${name}</b><i>${sub}</i></span></div>`;
  return `<div class="up-h vf-h">Where should this go?</div>
    <div class="vault-field" id="vault-field">
      <div class="vf-face" id="vf-empty"><span class="vf-ic">${icon('archive', 16, '#2A3D66')}</span><span class="vf-l ph">Choose a vault</span>${icon('chevron-down', 20, '#4A6491')}</div>
      <div class="vf-face" id="vf-chosen"><span class="vf-ic on">${icon('users', 16, '#fff')}</span><span class="vf-l">${STORY.familyName}</span>${icon('chevron-down', 20, '#4A6491')}</div>
      <div class="vault-menu" id="vault-menu">
        ${row('vm-personal', 'lock', 'Personal vault', 'Yours alone')}
        ${row('vm-family', 'users', STORY.familyName, "Family · you're an admin")}
      </div>
    </div>
    <div class="vf-hint"><span id="vf-hint0">Your personal vault is yours alone. Everyone in a family or business can see what's saved there.</span>
      <span id="vf-hint1">Everyone in ${STORY.familyName} will see it.</span></div>`;
}

function tagScreen() {
  // Everyone in the family tree, you first ("(Me)"), then in the order they
  // were added: the relation in English, and the nickname the family gave,
  // if any (family-people.ts, 045).
  const people = [
    ['p-me', `${STORY.youFull} (Me)`], ['p-papa', `${STORY.papa} (Father · "Papa")`], ['p-maa', `${STORY.maa} (Mother · "Maa")`],
    ['p-priya', 'Priya Sharma (Wife)'], ['p-dadi', `${STORY.dadi} (Grandmother · "Dadi")`],
    ['p-neha', 'Neha Kapoor (Sister)'], ['p-aarav', 'Aarav Sharma (Son)'],
  ];
  return `<section class="scr" id="scr-tag">${sbFill}
    ${header('Upload Document')}
    <div class="tag-scroll" id="tag-scroll"><div class="tag-inner" id="tag-inner">
      <div class="preview"><div class="preview-photo"><div class="grain"></div><div class="preview-doc">${policyPaper()}</div></div></div>
      <div class="file-row">${icon('image', 16, '#6B7280')}<span class="n">${STORY.scanFile}</span><span class="s">1.4 MB</span></div>
      ${ocrSlot(1284)}
      <div class="change-file">${icon('refresh-cw', 16, '#2A3D66')}<span>Choose different file</span></div>
      ${vaultField()}
      <div class="who" id="who"><div class="who-in"><div class="up-h">Who does this belong to?</div>
        <div class="chips">${people.map(([id, l], i) => chip(id, l, i === 0, true)).join('')}</div></div></div>
      <div class="up-h" style="margin-top:24px">Category</div>
      <div class="cat-hint" id="cat-hint">Picked from the file. Tap another to change it.</div>
      ${categoryChips('c', CATEGORIES)}
      <div class="save-btn" id="save-btn"><span class="save-l" id="save-l0">Choose where it goes</span><span class="save-l" id="save-l1">Save to ${STORY.familyName}</span>
        <div class="busy" id="save-busy" style="opacity:0">${spinner('#fff', 20, 'save-spin')}<span>Uploading...</span></div></div>
    </div></div>
    ${uploadedDialog(STORY.familyName)}
    ${tabBar('upload', 'tag')}
  </section>`;
}

// ─── Import from Gmail (src/app/gmail-import.tsx) ────────────────────────
// The rows are what supabase/functions/_shared/gmail-rules.ts makes of these
// emails: run classifyAttachment on them and you get these reasons and
// categories. The senders are generic on purpose; no real company appears.
// In the NRI film they are Papa's papers that reach Rohan's inbox, because he
// bought, paid or asked for them from abroad.
const GMAIL_SUGGESTED = FILM === 'nri' ? [
  ['gm-r1', 'LIC_Premium_Receipt_Papa.pdf', false, 'Policy Services · 2 Oct 2026 · 210 KB', 'Premium paid, thank you', 'file name says life insurance', 'Life Insurance'],
  ['gm-r2', 'FD_Statement_Papa.pdf', false, 'Bank Alerts · 1 Oct 2026 · 142 KB', 'Fixed deposit statement', 'file name says statement', 'Bank Statements'],
  ['gm-r3', 'Property_Tax_Receipt_2026.pdf', false, 'Municipal Payments · 15 Jul 2026 · 88 KB', 'Property tax paid', 'file name says property', 'Property Documents'],
  ['gm-r4', 'PAN_Card_Papa.pdf', false, 'Ramesh Sharma · 3 Mar 2026 · 1.2 MB', 'PAN card copy', 'file name says PAN', 'PAN Card'],
  ['gm-r5', 'Papa Passport.pdf', false, 'Ramesh Sharma · 18 Aug 2026 · 980 KB', 'Passport scan for the visa', 'file name says passport', 'Passport'],
] : [
  ['gm-r1', 'Statement_Oct_2026.pdf', false, 'Card Statements · 31 Oct 2026 · 186 KB', 'Your credit card statement for October 2026', 'file name says statement', 'Bank Statements'],
  ['gm-r2', 'ETicket_PNR_4521896307.pdf', false, 'Rail Bookings · 14 Oct 2026 · 96 KB', 'Booking confirmation, PNR 4521896307', 'file name says travel', 'Visa / Travel Docs'],
  ['gm-r3', 'Form16_FY2025-26.pdf', false, 'Payroll Team · 12 Jun 2026 · 238 KB', 'Form 16 for FY 2025-26', 'file name says tax', 'Tax Returns'],
  ['gm-r4', 'PAN_Card_Rohan.pdf', false, 'Rohan Sharma · 3 Mar 2026 · 1.2 MB', 'PAN card copy', 'file name says PAN', 'PAN Card'],
  ['gm-r5', 'Car Insurance.pdf', false, 'Policy Services · 10 Nov 2025 · 386 KB', 'Your motor policy is renewed', 'file name says vehicle insurance', 'Vehicle Insurance'],
];
const GMAIL_MAYBE = [
  ['gm-m1', 'IMG_20261012_183245.jpg', true, 'Priya Sharma · 12 Oct 2026 · 1.8 MB', 'Aadhaar card photo', 'email is about Aadhaar', 'National ID / Aadhaar'],
  ['gm-m2', 'scan0042.pdf', false, 'Sunita Sharma · 18 Aug 2026 · 640 KB', 'papers', 'a PDF attachment', 'Other'],
];

function gmailRow([id, file, isImg, meta, subject, reason, cat], ticked) {
  return `<div class="gm-row" id="${id}">
    <div class="gm-check"><span class="gm-off">${icon('square', 22, '#9CA3AF')}</span>
      <span class="gm-on" style="opacity:${ticked ? 1 : 0}">${icon('check-square', 22, '#2A3D66')}</span>
      <span class="gm-ok" style="opacity:0">${icon('check-circle', 22, '#16A34A')}</span></div>
    <div class="gm-body">
      <div class="gm-name">${icon(isImg ? 'image' : 'file-text', 14, '#6B7280')}<span>${file}</span></div>
      <div class="gm-meta">${meta}</div>
      <div class="gm-subj">${subject}</div>
      <div class="gm-foot"><div class="gm-why"><span class="gm-reason">${reason}</span><span class="gm-pill"><span>${cat}</span>${icon('chevron-down', 12, '#2A3D66')}</span></div>
        <div class="gm-imported" style="opacity:0"><span>Imported</span><b>View</b></div></div>
    </div></div>`;
}

function gmailScreen() {
  const owners = [['go-me', STORY.youFull], ['go-papa', 'Papa'], ['go-maa', 'Maa'], ['go-priya', 'Priya']]
    .map(([id, l]) => [id, l, id === STORY.gmailOwner]);
  return `<section class="scr" id="scr-gmail">${sbFill}
    ${header('Import from Gmail', { right: plusTag() })}
    <div class="gm-scroll"><div class="gm-inner" id="gm-inner">
      <div class="gm-account">${icon('mail', 18, '#2A3D66')}<span class="e">${STORY.email}</span><b>Disconnect</b></div>
      <div class="gm-card">
        <div class="gm-state" id="gm-idle"><div class="gm-text">Search your Gmail for documents.</div>
          <div class="gm-btn" id="gm-find">${icon('search', 16, '#fff')}<span>Find documents</span></div></div>
        <div class="gm-state" id="gm-scanning" style="opacity:0"><div class="gm-scan">${spinner('#2A3D66', 20, 'gm-spin')}<span>Looking through your email… <span id="gm-count">0 checked, 0 found</span></span></div>
          <div class="gm-pause">Pause</div></div>
        <div class="gm-state" id="gm-done" style="opacity:0"><div class="gm-text">Checked 412 emails with attachments · 10 possible documents</div>
          <div class="gm-btn">${icon('search', 16, '#fff')}<span>Check for new emails</span></div></div>
      </div>
      <div id="gm-list" style="opacity:0">
        <div class="up-h">Who do these belong to?</div>
        <div class="chips gm-owners">${owners.map(([id, l, on]) => `<div class="chip${on ? ' on' : ''}" id="${id}">${l}</div>`).join('')}</div>
        <div class="gm-group"><div class="gm-gh">Suggested (5)</div><div class="gm-hint">These look like documents.</div>
          ${GMAIL_SUGGESTED.map((r) => gmailRow(r, true)).join('')}</div>
        <div class="gm-group"><div class="gm-gh">Maybe (2)</div><div class="gm-hint">These might be documents.</div>
          ${GMAIL_MAYBE.map((r) => gmailRow(r, false)).join('')}</div>
      </div>
    </div></div>
    <div class="gm-footer" id="gm-footer" style="opacity:0">
      <div class="gm-import" id="gm-import"><span id="gm-import-label">Import 5 documents (${STORY.gmailSize})</span>
        <div class="busy" id="gm-busy" style="opacity:0">${spinner('#fff', 20, 'gm-spin2')}<span id="gm-busy-label">Importing 1 of 5…</span></div></div>
      <div class="gm-into">Into ${STORY.familyName}</div>
    </div>
  </section>`;
}

// ─── Ask (src/app/(tabs)/search.tsx): the tab is titled just "Ask" ───────
// Two vaults in Family mode, so Ask searches in all of them and says so.

function askEmpty(id, ic, title, sub) {
  return `<div class="ask-empty" id="${id}">
    <div class="ask-hero"><div class="ic grad">${icon(ic, 32, '#fff')}</div>
      <div class="t">${title}</div><div class="s">${sub}</div></div>
    <div class="ask-cats">${ASK_CATEGORIES.map((c) => `<span class="ask-cat">${c}</span>`).join('')}</div>
  </div>`;
}

function askScreen() {
  const turns = [{
    q: "What is Papa's health insurance policy number?", loading: 'Searching documents...',
    a: `Papa's health insurance policy number is <mark class="hl" id="ask-hl">${STORY.policyNo}</mark>, with ${STORY.insurer}. It's valid till 14 March 2027, with a sum insured of ₹10,00,000.`,
    src: STORY.scanFile, vault: STORY.familyName,
  }];
  return `<section class="scr" id="scr-ask">${sbFill}
    ${askHeader('ask')}
    ${searchIn('All my vaults')}
    <div class="ask-area" id="ask-area">
      ${askEmpty('ask-empty', 'cpu', 'Ask anything about your documents', "I'll search all your vaults.")}
      <div class="chat-stack" id="ask-stack">${askMessages('ask', turns, false)}</div>
    </div>
    <div class="ask-bottom">${saveBar('ask')}${askInput('ask')}</div>
    ${tabBar('search', 'ask')}
  </section>`;
}

function voiceScreen(lang) {
  // The voice scene's language (src/voice-lines.js): the full film's Hindi
  // unless ?lang= names another. The app's own phrases come in English or Hindi.
  const V = VOICE_LINES[lang || 'hi'];
  const P = APP_PHRASES[V.app];
  const turns = [{
    q: V.q,
    loading: P.thinking,
    a: `${V.lead} <mark class="hl" id="v-hl">${STORY.policyNo}</mark>${V.tail} ${V.a2}`,
    src: STORY.scanFile, vault: STORY.familyName, stop: P.stop, again: P.again,
  }];
  const ph = (id, text, shown) => `<span class="ask-ph" id="${id}" style="opacity:${shown ? 1 : 0}">${text}</span>`;
  // While it listens, the mic is a ✕ Cancel pill that throws away what was heard.
  return `<section class="scr voice" id="scr-voice">${sbFill}
    ${askHeader('v')}
    ${searchIn('All my vaults')}
    <div class="ask-area" id="v-area">
      ${askEmpty('v-empty', 'mic', P.emptyTitle, P.emptySub)}
      <div class="chat-stack" id="v-stack">${askMessages('v', turns, true)}</div>
    </div>
    <div class="ask-bottom">${saveBar('v')}
      <div class="ask-inputbar"><div class="ask-inputbox">
        <span class="ask-lead"><span style="position:absolute;inset:0">${icon('mic', 18, '#9CA3AF')}</span>
          <span style="position:absolute;inset:0;opacity:0" id="v-icon-on">${icon('mic', 18, '#D4807B')}</span></span>
        <div class="ask-input">${ph('v-ph-idle', P.tap, true)}${ph('v-ph-listen', P.listening)}${ph('v-ph-think', P.thinking)}${ph('v-ph-again', P.another)}<span class="ask-line" id="v-line"><span id="v-typed"></span></span></div>
        <div class="mic-wrap" id="v-mic">
          <div class="mic-c grad" id="mic-idle">${icon('mic', 26, '#fff')}</div>
          <div class="mic-c listening" id="mic-listen" style="opacity:0">${icon('x', 22, '#fff')}<span>${P.cancel}</span></div>
          <div class="mic-c thinking" id="mic-think" style="opacity:0">${spinner('#6B7280', 20, 'mic-spin')}</div>
          <div class="mic-c speaking" id="mic-speak" style="opacity:0">${icon('volume-2', 26, '#fff')}</div>
        </div>
      </div></div>
    </div>
    ${tabBar('search', 'v')}
  </section>`;
}

// ─── Home and the drawer ─────────────────────────────────────────────────

function homeScreen() {
  // Category colours from home.tsx; anything it does not map is grey. Every
  // document says which vault it is in.
  const doc = (name, ic, cat, color, vault, line) => `<div class="doc-card">
      <div class="doc-icon grad">${icon(ic, 18, '#fff')}</div>
      <div class="doc-info"><div class="doc-title">${name}</div>
        <div class="doc-meta"><span class="cat-badge" style="background:${color}">${cat}</span>
          <span class="vault-tag">${icon(vault ? 'users' : 'lock', 12, '#2A3D66')}<span>${vault ? STORY.familyName : 'Personal vault'}</span></span>
          <span>${line}</span></div></div></div>`;
  return `<section class="scr" id="scr-home">${sbFill}
    <div class="home-header">
      <div class="home-top"><div class="home-left"><div class="profile-btn" id="home-avatar">R</div>
        <div><div class="greeting">Good morning</div><div class="header-title">${STORY.youFull}${plusStar}</div></div></div>
        <div class="bell-btn" id="home-bell">${icon('bell', 20, '#fff')}</div></div>
      <div class="home-search">${icon('search', 18, 'rgba(255,255,255,0.8)')}<span class="ph">Search documents...</span>${icon('mic', 18, 'rgba(255,255,255,0.8)')}</div>
    </div>
    <div class="section"><div class="stats-bar">${['33 Documents', '4 Members', '11 Categories']
      .map((l) => `<span class="stat-link"><u>${l}</u>${icon('chevron-right', 14, '#2A3D66')}</span>`).join('<span class="div">|</span>')}</div></div>
    <div class="section"><div class="section-head"><div class="section-title">Recent Documents</div><span class="see-all">See all</span></div><div class="doc-list">
      ${doc(STORY.scanFile, 'image', 'Health Insurance', '#22C55E', true, `Father · ${STORY.papa} · Today`)}
      ${FILM === 'nri' ? `
      ${doc('Papa Passport.pdf', 'file-text', 'Passport', '#3B82F6', true, `Father · ${STORY.papa} · Today`)}
      ${doc('PAN_Card_Papa.pdf', 'file-text', 'PAN Card', '#6B7280', true, `Father · ${STORY.papa} · Today`)}
      ${doc('FD_Statement_Papa.pdf', 'file-text', 'Bank Statements', '#A855F7', true, `Father · ${STORY.papa} · Today`)}
      ${doc('LIC_Premium_Receipt_Papa.pdf', 'file-text', 'Life Insurance', '#22C55E', true, `Father · ${STORY.papa} · Today`)}` : `
      ${doc('Car Insurance.pdf', 'file-text', 'Vehicle Insurance', '#6B7280', true, `${STORY.youFull} · Today`)}
      ${doc('PAN_Card_Rohan.pdf', 'file-text', 'PAN Card', '#6B7280', false, `${STORY.youFull} · Today`)}
      ${doc('Form16_FY2025-26.pdf', 'file-text', 'Tax Returns', '#6B7280', false, `${STORY.youFull} · Today`)}
      ${doc('ETicket_PNR_4521896307.pdf', 'file-text', 'Visa / Travel Docs', '#6B7280', false, `${STORY.youFull} · Today`)}`}
    </div></div>
    ${tabBar('home', 'home')}
    <div class="drawer" id="drawer">
      <div class="drawer-dim"></div>
      <div class="drawer-panel">
        <div class="dr-head">
          <div class="dr-top"><div class="dr-av">R</div><span class="dr-x">${icon('x', 24, '#fff')}</span></div>
          <div class="dr-name">${STORY.youFull}${plusStar}</div><div class="dr-line">${STORY.email}</div><div class="dr-line">${STORY.familyName} · Admin</div>
        </div>
        <div class="dr-menu">
          ${[['dr-home', 'home', 'Home'], ['dr-tree', 'git-branch', 'Family tree'], ['dr-emerg', 'plus-square', 'Emergency cards'],
            ['dr-manage', 'users', 'Manage Family'], ['dr-rem', 'clock', 'Reminders', true], ['dr-plus', 'star', 'Family Plus'], ['dr-set', 'settings', 'Settings']]
            .map(([id, ic, label, plus]) => `<div class="dr-row" id="${id}"><span class="dr-ic">${icon(ic, 16, ic === 'star' ? '#D4807B' : '#2A3D66')}</span><span class="dr-l">${label}</span>
              ${plus ? plusTag() : icon('chevron-right', 16, '#9CA3AF')}</div>`).join('')}
        </div>
        <div class="dr-foot"><div class="dr-out">${icon('log-out', 16, '#DC2626')}<span>Sign Out</span></div><div class="dr-ver">AskLocker 1.0.0</div></div>
      </div>
    </div>
  </section>`;
}

// ─── Family tree (src/app/family-tree.tsx, components/family-tree-view.tsx)

// One person's card. Relations are what _shared/kinship.ts calls them, seen
// from Rohan, in English, with the family's nickname for them (045); expiry
// badges are documents with 90 days or fewer left.
function treeCard(id, name, rel, { me = false, onApp = false, badge = '' } = {}) {
  return `<div class="tcard${me ? ' me' : ''}" id="${id}">${avatar(name, 36, { me, onApp })}
    <div class="tc-name">${name}</div><div class="tc-rel">${me ? 'You' : rel}</div>
    ${badge ? `<div class="tc-exp">${badge}</div>` : ''}</div>`;
}

function treeScreen() {
  // The layout is family-tree-view.tsx's, in the same flex boxes: a unit is a
  // person and their spouse, a branch is a unit with its children below.
  const kid = (pos, inner) => `<div class="kid"><div class="bar"><i class="${pos === 'first' || pos === 'only' ? '' : 'on'}"></i><i class="${pos === 'last' || pos === 'only' ? '' : 'on'}"></i></div><div class="vl"></div>${inner}</div>`;
  const tree = `<div class="branch" data-g="0">
      <div class="unit">${treeCard('tc-dadi', STORY.dadi, 'Grandmother · "Dadi"')}</div><div class="vl"></div>
      <div class="kids">${kid('only', `<div class="branch">
        <div class="unit">${treeCard('tc-papa', STORY.papa, 'Father · "Papa"', { onApp: true })}<i class="ml"></i>${treeCard('tc-maa', STORY.maa, 'Mother · "Maa"', { onApp: true })}</div>
        <div class="vl"></div>
        <div class="kids">
          ${kid('first', `<div class="branch"><div class="unit">${treeCard('tc-neha', 'Neha Kapoor', 'Sister')}</div></div>`)}
          ${kid('last', `<div class="branch">
            <div class="unit">${treeCard('tc-me', STORY.youFull, '', { me: true, onApp: true, badge: '8 days left' })}<i class="ml"></i>${treeCard('tc-priya', 'Priya Sharma', 'Wife', { onApp: true })}</div>
            <div class="vl"></div>
            <div class="kids">${kid('only', `<div class="branch"><div class="unit">${treeCard('tc-aarav', 'Aarav Sharma', 'Son')}</div></div>`)}</div>
          </div>`)}
        </div></div>`)}</div></div>`;
  const row = (name, sub, opts, alert = false) => `<div class="ev-row">${avatar(name, 32, opts)}<div class="ev-t"><div class="ev-n">${name}</div><div class="ev-s">${sub}</div></div>${alert ? icon('alert-circle', 16, '#B45309') : ''}${icon('chevron-right', 16, '#9CA3AF')}</div>`;
  return `<section class="scr" id="scr-tree">${sbFill}
    ${header('Family tree', { sub: STORY.familyName, right: `<div class="v4-hbtn">${icon('user-plus', 16, '#fff')}<span>Add</span></div>` })}
    <div class="tree-body">
      <div class="onapp-key"><i class="dot">${icon('smartphone', 9, '#fff', 2.4)}</i><span>On AskLocker</span></div>
      <div class="tree-canvas" id="tree-canvas"><div class="tree-content" id="tree-content">${tree}</div></div>
      <div class="overline" style="margin-top:8px">Everyone</div>
      <div class="ev-list">
        ${row(STORY.youFull, 'You', { me: true, onApp: true }, true)}
        ${row(STORY.papa, 'Father · "Papa" · On AskLocker', { onApp: true })}
        ${row(STORY.maa, 'Mother · "Maa" · On AskLocker', { onApp: true })}
      </div>
    </div>
  </section>`;
}

// ─── A person, and their emergency card (person/[id].tsx, emergency/[id].tsx)

const cardTitle = (ic, title) => `<div class="card-title"><span class="ct-ic">${icon(ic, 16, '#2A3D66')}</span><span>${title}</span></div>`;
const bloodPill = (g) => `<span class="blood-pill">${icon('droplet', 12, '#B91C1C', 2.4)}<b>${g}</b></span>`;

function personScreen() {
  const chipP = (name, me) => `<div class="pchip">${avatar(name, 24, { me })}<span>${me ? 'You' : name}</span></div>`;
  return `<section class="scr" id="scr-person">${sbFill}
    ${header(STORY.papa, { right: `<div class="v4-actions"><span class="v4-iconbtn">${icon('edit-2', 24, '#2A3D66')}</span></div>` })}
    <div class="p-body">
      <div class="card hero">${avatar(STORY.papa, 56, { onApp: true })}
        <div class="hero-n">${STORY.papa}</div><div class="hero-nick">"Papa"</div><div class="hero-r">Your father</div>
        <div class="muted">Born 14 March 1966 · 60 years</div>
        <div class="acct-pill">${icon('smartphone', 12, '#2A3D66')}<span>On AskLocker</span></div></div>
      <div class="card">${cardTitle('plus-square', 'Emergency card')}
        <div class="ec-row">${bloodPill('B+')}<span class="muted">2 people to call</span></div>
        <div class="ec-allergy">Allergies: Penicillin</div>
        <div class="btn-primary" id="pp-open">${icon('maximize-2', 16, '#fff')}<span>Open emergency card</span></div></div>
      <div class="card">${cardTitle('users', 'Close family')}
        <div class="overline">Parents</div><div class="pchips">${chipP(STORY.dadi)}</div>
        <div class="overline">Wife</div><div class="pchips">${chipP(STORY.maa)}</div>
        <div class="overline">Children</div><div class="pchips">${chipP('Neha Kapoor')}${chipP(STORY.youFull, true)}</div></div>
    </div>
  </section>`;
}

function emergencyScreen() {
  const call = (n) => `<div class="call-btn-g">${icon('phone', 18, '#fff')}<span>${n}</span></div>`;
  const sec = (label, value) => `<div class="em-sec"><div class="em-l">${label}</div><div class="em-v">${value}</div></div>`;
  return `<section class="scr" id="scr-emerg">${sbFill}
    ${header('Emergency card', { right: `<div class="v4-actions"><span class="v4-iconbtn">${icon('edit-2', 24, '#2A3D66')}</span></div>` })}
    <div class="em-scroll"><div class="em-inner" id="em-inner">
      <div class="em-banner"><div class="em-tag">Emergency</div><div class="em-name">${STORY.papa}</div><div class="em-about">Your father · "Papa" · 60 years</div></div>
      <div class="card em-card">
        <div class="em-sec"><div class="em-l">Blood group</div><div class="em-blood">B+</div></div>
        <div class="em-allergy"><div class="em-l red">${icon('alert-triangle', 18, '#B91C1C')}<span>Allergies</span></div><div class="em-v">Penicillin</div></div>
        ${sec('Health conditions', 'Type 2 diabetes, high blood pressure')}
        ${sec('Medicines', 'Metformin 500 mg, morning and night')}
        <div class="em-sec"><div class="em-l">Doctor</div><div class="em-v">Dr Anil Mehta</div>${call('+91 98765 43210')}</div>
        <div class="em-sec" id="em-ins"><div class="em-l">Health insurance</div><div class="em-v">${STORY.insurer}<br>Policy <mark class="hl" id="em-hl">${STORY.policyNo}</mark></div></div>
        <div class="em-sec"><div class="em-l">People to call</div>
          <div class="em-person"><div class="em-v">${STORY.maa}<span class="em-m">  ·  Wife</span></div>${call('+91 98765 12345')}</div>
          <div class="em-person"><div class="em-v">${STORY.youFull}<span class="em-m">  ·  Son</span></div>${call(STORY.sonPhone)}</div></div>
        <div class="muted em-upd">Updated 3 October 2026 by you</div>
      </div>
    </div></div>
  </section>`;
}

// ─── Notifications (src/app/notifications.tsx) ───────────────────────────

function notificationsScreen() {
  const card = (type, title, msg, time, unread) => {
    const [ic, bg, fg] = {
      expiry: ['clock', '#FEF2F2', '#DC2626'], birthday: ['gift', '#FDF2F8', '#DB2777'],
      plan: ['star', '#FEF3C7', '#B45309'], member: ['user-plus', '#F0FDF4', '#16A34A'],
    }[type];
    return `<div class="nt-card ${unread ? 'unread' : ''}"><div class="nt-ic" style="background:${bg}">${icon(ic, 16, fg)}</div>
      <div class="nt-c"><div class="nt-t">${title}</div><div class="nt-m">${msg}</div><div class="nt-time">${time}</div></div>
      ${unread ? '<div class="nt-dot"></div>' : ''}</div>`;
  };
  return `<section class="scr" id="scr-notifs">${sbFill}
    ${header('Notifications')}
    <div class="nt-list" id="nt-list">
      ${card('expiry', STORY.expiry[0], STORY.expiry[1], 'Just now', true)}
      ${card('birthday', `Today is ${STORY.dadi}'s 78th birthday`, 'Wish her a happy birthday.', 'Just now', true)}
      ${card('plan', `${STORY.familyName} has Family Plus`, STORY.planNote, '1d ago', false)}
      ${card('member', `Priya Sharma joined ${STORY.familyName}`, `Priya Sharma accepted the invitation and can now see ${STORY.familyName}'s documents, as a viewer.`, 'Oct 3', false)}
    </div>
  </section>`;
}

export function phone(lang = '') {
  return phoneShell(`
    ${lockScreen('scr-lock', STORY.t.lock, STORY.t.lockDate, lockNotif('ln1', 'Maa', STORY.maaMsgs))}
    ${callScreen({ label: 'Incoming call', name: 'Maa', sub: STORY.callFrom })}
    ${uploadScreen()}
    ${gmailScreen()}
    ${cameraScreen(policyPaper())}
    ${tagScreen()}
    ${askScreen()}
    ${voiceScreen(lang)}
    ${homeScreen()}
    ${treeScreen()}
    ${personScreen()}
    ${emergencyScreen()}
    ${lockScreen('scr-lockday', STORY.t.day, STORY.t.dayDate, `<div class="lstack">
      ${pushNotif('pn1', STORY.expiry[0], STORY.expiry[1])}
      ${pushNotif('pn2', `Today is ${STORY.dadi}'s 78th birthday`, 'Wish her a happy birthday.')}</div>`)}
    ${notificationsScreen()}
    ${lockScreen('scr-lock2', STORY.t.lock2, STORY.t.lockDate, lockNotif('ln2', 'Maa', [STORY.maaThanks]))}`, STORY.t.lock);
}

// ─── Film layers ─────────────────────────────────────────────────────────

export function scrambleCards() {
  return `
  <div class="sc" id="sc-mail" style="width:470px">
    <div class="sc-top">${icon('inbox', 18, '#6B7280')}<b>${STORY.email}</b></div>
    <div class="sc-search">${icon('search', 18, '#6B7280')}<span class="sc-q" id="sc-q"></span><span class="caret" id="sc-caret"></span></div>
    <div class="sc-count" id="sc-count">2,847 results</div>
    <div class="sc-row"><span><b>Your policy documents</b> · Please find attached your…</span><span>Mar 2023</span></div>
    <div class="sc-row"><span><b>Consolidated Account Statement</b> · Mutual fund…</span><span>Jan 2025</span></div>
    <div class="sc-row"><span><b>Premium receipt</b> · Thank you for your payment…</span><span>Apr 2024</span></div>
  </div>
  <div class="sc" id="sc-work" style="width:430px">
    <div class="sc-top">${icon(STORY.dead.icon, 18, '#6B7280')}<b>${STORY.dead.top}</b></div>
    <div class="sc-alert">${icon(STORY.dead.alert, 22, '#B91C1C')}<div><b>${STORY.dead.title}</b><br>${STORY.dead.body}</div></div>
  </div>
  <div class="sc sc-center" id="sc-pdf" style="width:400px">
    <div class="sc-file">${icon('file-text', 18, '#DC2626')}<span>Policy_Schedule_FINAL(2).pdf</span></div>
    <div class="sc-lock">${icon('lock', 24, '#374151')}</div>
    <div class="sc-h">This document is password protected</div>
    <div class="sc-p">Password: date of birth (DDMMYYYY)</div>
    <div class="sc-field" id="sc-pwd">••••••••</div>
    <div class="sc-err">Incorrect password. 2 attempts left.</div>
  </div>
  <div class="sc sc-center" id="sc-otp" style="width:420px">
    <div class="sc-h">Verify it's you</div>
    <div class="sc-p">Enter the OTP sent to <b>+91 98•••••210</b><br>(Papa's number)</div>
    <div class="sc-otp"><i class="on"></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="sc-p">Resend OTP in 0:29</div>
  </div>
  <div class="sc sc-note" id="sc-note" style="width:350px"><i class="tape"></i>
    Papa's policy papers:<br><u>blue file</u>, almirah,<br>2nd shelf (Lucknow)
  </div>`;
}

export function textBlocks() {
  const langs = `<div class="langs" id="langs"><div class="langs-head">Speech to text and text to speech, in</div>${VOICE_LANGUAGES.map(([n, e]) => `<div class="lang"><b>${n}</b><i>${e}</i></div>`).join('')}
    <div class="langs-note">Each phone reads aloud in its own voices.</div></div>`;
  return `
  <div class="tblock on-dark" id="t-hook">
    <div class="clock-big"><span class="t">2:14</span><span class="ampm">AM</span></div>
    <div class="where">${STORY.where}</div>
  </div>
  <div class="time-chip" id="time-chip">${icon('clock', 24, '#D4807B', 2.4)}<span id="chip-time">2:16 AM${STORY.chipWhere}</span></div>
  <div class="cap-top" id="caps">
    ${STORY.caps.map((c, i) => `<div class="cap-line" id="cap${i + 1}">${words(c)}</div>`).join('\n    ')}
  </div>
  <div class="center-block on-dark" id="t-insight">
    <div class="big" id="ins-1">${words(STORY.insight[0])}</div>
    <div class="big-em" id="ins-2">${words(STORY.insight[1])}</div>
  </div>
  <div class="center-block on-dark" id="t-stat">
    <div class="stat-num" id="stat-num"><span class="rs">₹</span><span id="stat-val">1.84</span> lakh crore</div>
    <div class="stat-line" id="stat-line">of Indians' money lies unclaimed. <b>“In many cases, families are simply unaware that such assets exist.”</b></div>
    <div class="stat-src" id="stat-src">Ministry of Finance, 2025</div>
  </div>
  <div class="q-block on-dark" id="t-question"><div class="big">${words(STORY.question)}</div></div>
  ${brand('brand', 'Every family document. One question away.')}
  ${whyHow('t-gmail', 'Gmail import', 'mail', STORY.why.gmail,
    'AskLocker finds them for you.', 'It lists the attachments that look like documents. Nothing comes in until you tick it.', { plus: '★ Family Plus' })}
  ${whyHow('t-scan', 'Scan', 'camera', STORY.why.scan[0],
    STORY.why.scan[1], 'AskLocker reads the page and pulls out the policy number and expiry date.')}
  ${whyHow('t-ask', 'Ask', 'message-circle', 'In a panic, *nobody remembers* which file has the number.',
    "Just ask, the way you'd ask a person.", 'The answer comes from your own documents, with the source attached.')}
  ${whyHow('t-voice', 'Voice', 'mic', STORY.why.voice[0],
    STORY.why.voice[1], 'Speech to text and text to speech, in nine Indian languages and English.', { after: langs })}
  ${whyHow('t-tree', 'Family tree', 'git-branch', 'Dadi and the kids *never sign in.*|And everyone says “Dadi”, not “Kamala~Sharma”.',
    'Everyone goes in one family tree.', 'With or without an account, by the names your family uses. Ask by relation, and AskLocker knows who you mean.')}
  ${whyHow('t-emerg', 'Emergency card', 'plus-square', 'The doctor asks: blood~group? Allergies? Medicines?|At 2~AM, *nobody remembers.*',
    'One emergency card for each person.', 'With the policy number too. Anyone in the family can open it, and every number is one tap from the dialler.')}
  ${whyHow('t-alerts', 'Reminders', 'bell', STORY.why.alerts[0],
    'Everyone is reminded in time.', STORY.why.alerts[1], { plus: '★ Family Plus' })}
  ${trustBlock('Policies, IDs, medical records: *the most private papers* a family has.', 'In AskLocker, only your family can open them.', [
    ['lock', 'Invite-only', 'Nobody joins unless an admin asks and they say yes.'],
    ['users', 'Nobody else', "Nobody else using AskLocker can open your family's documents."],
    ['link', 'Links that expire', 'Share one document for 1 or 7 days, or 30 with Family Plus. Turn it off any time.'],
    ['eye-off', 'Yours alone', "Your personal vault is yours alone. Your family won't see it."],
  ], 'Search sends passages of your documents to outside AI services. Settings › Privacy names them.')}
  <div class="tblock on-dark res-block" id="t-res">
    <div class="kicker">${icon('heart', 22, 'currentColor', 2.4)}<span>${STORY.res.kicker}</span></div>
    <div class="clock-big"><span class="t" id="res-time">2:14</span><span class="ampm">AM</span></div>
    <div class="res-lines"><div class="h1" id="res-h1a">${words('Maa asks. AskLocker answers.')}</div>
      <div class="h1" id="res-h1b">${words(STORY.res.h1b)}</div></div>
    <div class="sub" id="res-sub">${STORY.res.sub}</div>
  </div>
  ${brand('endcard', 'Every family document. One question away.', { cta: STORY.cta, ctaNote: STORY.ctaNote, url: STORY.url, end: true })}`;
}

export function callouts() {
  const check = (t) => `<div class="co-check">${icon('check', 16, '#16A34A', 2.6)}<span>${t}</span></div>`;
  const ask = (q, who) => `<div class="co-ask"><span class="q">“${q}”</span>${icon('chevron-right', 16, '#9CA3AF', 2.4)}<span class="who">${who}</span></div>`;
  return `
  <div class="callout" id="co-gmail" style="width:380px">
    <div class="co-label">${icon('mail', 14, '#D4807B', 2.6)}<span>Your inbox, your tick</span></div>
    ${check('Only checks emails with a PDF or photo')}
    ${check("Your family doesn't see what it finds")}
    ${check('Disconnecting clears the list')}
  </div>
  <div class="callout" id="co-scan" style="width:370px">
    <div class="co-label">${icon('zap', 14, '#D4807B', 2.6)}<span>Read off the page</span></div>
    <div class="co-row"><span class="co-k">Policy no.</span><span class="co-v">${STORY.policyNo}</span></div>
    <div class="co-row"><span class="co-k">Valid till</span><span class="co-v">14 Mar 2027</span></div>
    <div class="co-row"><span class="co-k">Sum insured</span><span class="co-v">₹10,00,000</span></div>
    <div class="co-foot">${icon('bell', 14, '#16A34A', 2.6)}<span>Expiry reminder added</span></div>
  </div>
  <div class="callout" id="co-tree" style="width:390px">
    <div class="co-label">${icon('users', 14, '#D4807B', 2.6)}<span>Ask by relation</span></div>
    ${ask("Papa's health policy", STORY.papa)}
    ${ask('Dadi ki pension', STORY.dadi)}
    ${ask('दादी की पेंशन', STORY.dadi)}
    <div class="co-quiet">Worked out from the family tree.</div>
  </div>
  <div class="callout" id="co-alerts" style="width:400px">
    <div class="co-label">${icon('bell', 14, '#D4807B', 2.6)}<span>Before it expires</span></div>
    <div class="co-steps"><i class="track"></i>
      ${[['90', 'days'], ['30', 'days'], ['7', 'days'], ['On the', 'day']].map(([a, b]) => `<div class="co-step"><i class="dot"></i><b>${a}</b><span>${b}</span></div>`).join('')}</div>
    <div class="co-foot">${icon('gift', 14, '#16A34A', 2.6)}<span>Birthdays too, on the morning</span></div>
  </div>
  <div class="wave" id="wave">${Array.from({ length: 26 }, () => '<i></i>').join('')}</div>`;
}

export function subtitles(lang = '') {
  const v = voiceSubtitles(lang || 'hi', STORY.policyNo);
  // Without subtitles (English), the voice lines' stay empty and unseen.
  const line = (id, text) => `<div class="subline on-light" id="${id}"${text ? '' : ' style="display:none"'}>${text ?? ''}</div>`;
  return `
    <div class="subline" id="sub-1">${STORY.subs[0]}</div>
    <div class="subline" id="sub-2">${STORY.subs[1]}</div>
    ${line('sub-3', v?.q)}
    ${line('sub-4', v?.a1)}
    ${line('sub-4b', v?.a2)}
    <div class="subline" id="sub-5">${STORY.subs[2]}</div>`;
}
