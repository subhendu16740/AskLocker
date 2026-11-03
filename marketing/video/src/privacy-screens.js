// The privacy film's own pieces: its Question/Answer blocks, the cold open,
// the diagrams (where documents go, who can open them, what the AI gets,
// every service), and the two screens only it needs: Manage Family with an
// invitation waiting (src/app/family.tsx) and Delete account
// (src/app/settings/delete-account.tsx).
//
// Every sentence says what public/privacy.html says, or what the code does:
// what goes to the AI is rag-search's buildContext() and familyNote (the
// question, the best passages labelled with their document, and who a named
// relative is), at the limits it sets (RERANK_CANDIDATES 15, RERANK_KEEP 5,
// MAX_CONTEXT_CHARS 6000). CLAUDE.md's rule holds: never "secure", "safe",
// "private and isolated", "100% private", "only you can see it" or "nothing
// is kept". The README lists each claim and where it comes from.
import { icon, logoMark, sbFill, header, rich, words, brand } from './parts.js';
import { STORY } from './family-screens.js';

const NAVY = '#2A3D66';
const CORAL = '#D4807B';
const GREEN = '#16A34A';
const AMBER = '#B45309';
const RED = '#DC2626';

// ─── Words ───────────────────────────────────────────────────────────────

/** A scene asks what people ask, then answers it plainly (the films' why and
 * how, labelled Question and Answer). *stars* mark the question's emphasis. */
export function qa(id, kicker, kIcon, question, answer, sub) {
  return `<div class="tblock wh pv-qa" id="${id}">
      <div class="kicker">${icon(kIcon, 22, 'currentColor', 2.4)}<span>${kicker}</span></div>
      <div class="wh-why"><div class="wh-tag why">Question</div><div class="why-t">${rich(question)}</div></div>
      <div class="wh-how"><div class="wh-tag how">Answer</div><div class="h1">${words(answer)}</div><div class="sub">${sub}</div></div></div>`;
}

/** The cold open: three papers a family keeps, and what to know before
 * uploading them. */
export function openCards() {
  const doc = (id, ic, kind, name, lines) => `<div class="pv-doc" id="${id}">
      <div class="pv-doc-top"><span class="pv-doc-ic">${icon(ic, 26, NAVY, 2.2)}</span><span class="pv-doc-kind">${kind}</span></div>
      <div class="pv-doc-name">${name}</div>
      ${lines.map((w) => `<i style="width:${w}%"></i>`).join('')}
      <div class="pv-doc-spec">SPECIMEN</div>
    </div>`;
  return `<div class="pv-docs" id="pv-docs">
      ${doc('pv-d1', 'book-open', 'Passport', STORY.youFull, [88, 70, 92, 54])}
      ${doc('pv-d2', 'shield', 'Health policy', STORY.papa, [94, 66, 80, 72])}
      ${doc('pv-d3', 'credit-card', 'PAN card', STORY.maa, [76, 90, 62, 84])}
    </div>`;
}
export function openLines() {
  return `<div class="pv-open on-dark" id="t-open">
      <div class="big pv-l" id="pv-l1">${words('Your passport.')}</div>
      <div class="big pv-l" id="pv-l2">${words("Papa's health policy.")}</div>
      <div class="big pv-l" id="pv-l3">${words('Your PAN card.')}</div>
    </div>
    <div class="center-block on-dark pv-before" id="t-before">
      <div class="big">${words('Before you upload them,')}</div><div class="big-em">${words('know where they go.')}</div>
    </div>`;
}

/** The film's title, the closing line, and the end card. */
export function titleCard() {
  return brand('pv-title', 'What happens to your documents, in plain words.');
}
export function closeBlock() {
  return `<div class="center-block pv-close" id="t-close">
      <div class="big">${words('No fine print.')}</div>
      <div class="pv-close-sub" id="pv-close-sub">The whole privacy policy, in plain words:</div>
      <div class="pv-url" id="pv-url">${icon('lock', 26, '#fff', 2.4)}<span>asklocker.com/privacy</span></div>
    </div>`;
}
export function endCard() {
  return brand('endcard', 'Every family document. One question away.',
    { cta: STORY.cta, ctaNote: 'Free to start', url: 'asklocker.com/privacy', end: true });
}

// ─── Where documents are kept ────────────────────────────────────────────

export function pathDiagram() {
  return `<div class="pv-dg pv-path" id="dg-path">
      <div class="pv-node" id="pn-phone"><span class="pv-node-ic">${icon('smartphone', 46, NAVY, 2)}</span><b>Your phone</b></div>
      <div class="pv-wire" id="pw">
        <i class="pv-wire-line" id="pw-line"></i>
        <span class="pv-packet" id="pw-packet">${icon('file-text', 22, NAVY, 2.2)}<span class="pv-packet-lock">${icon('lock', 12, '#fff', 3)}</span></span>
        <span class="pv-badge" id="pw-badge">${icon('lock', 16, '#fff', 2.6)}<span>Encrypted on the way</span></span>
      </div>
      <div class="pv-node" id="pn-store"><span class="pv-node-ic">${icon('database', 46, NAVY, 2)}</span><b>Stored in Mumbai</b><span>India</span>
        <span class="pv-badge low" id="pn-badge">${icon('lock', 16, '#fff', 2.6)}<span>Encrypted where it's kept</span></span></div>
    </div>`;
}

// ─── Who can open them ───────────────────────────────────────────────────

export function whoDiagram() {
  const row = (id, kind, ic, title, line) => `<div class="pv-who ${kind}" id="${id}">
      <span class="pv-who-ic">${icon(ic, 26, kind === 'no' ? RED : kind === 'team' ? AMBER : NAVY, 2.2)}</span>
      <div class="pv-who-t"><b>${title}</b><span>${line}</span></div>
      <span class="pv-who-mark">${icon(kind === 'no' ? 'x' : 'check', 22, kind === 'no' ? RED : kind === 'team' ? AMBER : GREEN, 3)}</span>
    </div>`;
  return `<div class="pv-dg pv-card" id="dg-who">
      <div class="pv-card-h">${icon('eye', 20, CORAL, 2.4)}<span>Who can open your documents</span></div>
      ${row('pw-vault', 'yes', 'users', 'People in your vault', 'Your personal vault is yours alone')}
      ${row('pw-link', 'yes', 'link', 'Anyone you send a link to', 'That one document, until the link ends')}
      ${row('pw-team', 'team', 'server', 'Our servers, and our team', 'Servers read them to search and answer you. The people who run AskLocker can open them.')}
      ${row('pw-svc', 'team', 'cloud', 'Services we use', 'They read parts of them, or a scan, for us. Each one is named in our privacy policy.')}
      ${row('pw-else', 'no', 'user-x', 'Anyone else on AskLocker', 'Nobody else using AskLocker can open them')}
      <div class="pv-card-foot" id="dg-who-foot">${icon('lock', 18, NAVY, 2.4)}<span>Encrypted when sent and stored. <b>Not end-to-end.</b></span></div>
    </div>`;
}

// ─── What the AI gets ────────────────────────────────────────────────────

export const AI_Q = "What is Papa's health insurance policy number?";

// The Sharma family's vault: 24 documents. Search picks the passages for the
// question from seven of them (FOUND): the three insurance papers, and,
// because the question names Papa, documents marked as his, which join the
// candidates (rag-search's ownerChunks). Up to 15 passages from these go to
// the AI, which checks which ones answer (rerankChunks) and writes from the
// best (buildContext); nothing else from the vault goes with the question.
const VAULT = [
  ['shield', STORY.scanFile, 'Health Insurance'], ['umbrella', 'LIC_Premium_Receipt_Papa.pdf', 'Life Insurance'],
  ['truck', 'Car Insurance.pdf', 'Vehicle Insurance'], ['book-open', 'Papa Passport.pdf', 'Passport'],
  ['credit-card', 'PAN_Card_Papa.pdf', 'PAN Card'], ['credit-card', 'PAN_Card_Rohan.pdf', 'PAN Card'],
  ['image', 'IMG_20261012_183245.jpg', 'Aadhaar'], ['file-text', 'FD_Statement_Papa.pdf', 'Bank Statements'],
  ['file-text', 'Statement_Oct_2026.pdf', 'Bank Statements'], ['file-text', 'Form16_FY2025-26.pdf', 'Tax Returns'],
  ['home', 'Property_Tax_Receipt_2026.pdf', 'Property'], ['map', 'ETicket_PNR_4521896307.pdf', 'Travel'],
  ['book-open', 'Rohan Passport.pdf', 'Passport'], ['book-open', 'Maa Passport.pdf', 'Passport'],
  ['award', 'Priya Degree.pdf', 'Education'], ['heart', 'Maa Blood Report.pdf', 'Medical Records'],
  ['activity', 'Papa ECG 2026.pdf', 'Medical Records'], ['file-text', 'ITR_FY2025-26.pdf', 'Tax Returns'],
  ['key', 'Flat Sale Deed.pdf', 'Property'], ['credit-card', 'Voter ID Maa.jpg', 'Voter ID'],
  ['truck', 'Driving Licence Rohan.jpg', 'Driving License'], ['zap', 'Electricity Bill Oct.pdf', 'Bills'],
  ['file-text', 'Gas Connection.pdf', 'Other'], ['award', 'Birth Certificate Priya.pdf', 'Birth Certificate'],
];
const FOUND = new Set([0, 1, 2, 3, 4, 7, 16]);

export function aiDiagram() {
  const tiles = VAULT.map(([ic, name, kind], i) => `<div class="pv-tile${FOUND.has(i) ? ' found' : ''}" id="ai-t${i}">
      <span class="pv-tile-ic">${icon(ic, 18, NAVY, 2.2)}</span><b>${name}</b><span>${kind}</span></div>`).join('');
  // The passage as rag-search's buildContext() writes it, then its text.
  // Rohan has a personal vault too, and Ask searches every vault by default,
  // so each passage says which vault it is in.
  const head = `[Passage 1 | Document: ${STORY.scanFile} | Type: Health Insurance | Marked as ${STORY.papa}'s | In: ${STORY.familyName}]`;
  const text = ['AROGYA SHIELD HEALTH INSURANCE CO. LTD.', 'SCHEDULE OF INSURANCE · FAMILY FLOATER HEALTH PLAN',
    `Policy Number ${STORY.policyNo}`, `Insured name ${STORY.papa} (Self)`, 'Members covered Ramesh Sharma, Sunita Sharma',
    'Sum insured ₹10,00,000', 'Policy period 15/03/2026 to 14/03/2027'];
  return `<div class="pv-dg pv-ai" id="dg-ai">
      <div class="pv-vault" id="ai-vault">
        <div class="pv-vault-h"><span>${icon('users', 18, NAVY, 2.4)}<b>${STORY.familyName}</b></span><span id="ai-count">24 documents</span></div>
        <div class="pv-grid" id="ai-grid">${tiles}</div>
        <div class="pv-vault-f" id="ai-found">${icon('search', 18, CORAL, 2.6)}<span>Search picks up to 15 passages that match, here from ${FOUND.size} documents. <b>Nothing else goes with your question.</b></span></div>
      </div>
      <div class="pv-env" id="ai-env">
        <div class="pv-env-h">${icon('send', 18, '#fff', 2.4)}<span>What the AI gets</span></div>
        <div class="pv-env-sec" id="ai-s1"><i>Your question</i><p>${AI_Q}</p><em>On a follow-up, your last few messages too</em></div>
        <div class="pv-env-sec" id="ai-s2"><i>Who's who, when you name someone</i><p>The person asking is ${STORY.youFull}. In this question, "Papa" means ${STORY.papa}, their father.</p></div>
        <div class="pv-env-sec" id="ai-s3"><i>The passages search found</i>
          <div class="pv-pass"><code>${head}</code>${text.map((l) => `<span>${l}</span>`).join('')}</div>
          <div class="pv-pass-more">${icon('plus', 14, NAVY, 2.6)}<span>More like it, up to 15 in all</span></div></div>
        <div class="pv-env-foot" id="ai-foot">The AI checks which passages answer you, and writes from the best: about a page and a half. <b>Never the files. Never your whole vault.</b></div>
      </div>
      <div class="pv-ai-node" id="ai-node"><span class="pv-ai-ic">${icon('cpu', 30, '#fff', 2.2)}</span>
        <div><b>An AI service</b><span>Claude by Anthropic, or Groq if Claude can't answer</span></div></div>
    </div>`;
}

// ─── Every service, and what it gets ─────────────────────────────────────

const SERVICES = [
  ['database', 'Supabase', 'Stores your account, documents and files, in Mumbai'],
  ['cloud', 'Cloudflare', 'Runs the website. Turns parts of documents and questions into search data'],
  ['cpu', 'Anthropic, Groq', 'Your question and the best-matching parts, to write the answer'],
  ['file-text', 'OCR.space', "Reads scanned PDFs, Gmail photos, and photos your phone couldn't read"],
  ['log-in', 'Google', 'Signs you in. Gmail, only if you connect it. Voice, in Chrome'],
  ['credit-card', 'Razorpay', 'Payments. Your card or UPI details go only to Razorpay'],
  ['bell', 'Push service', 'Your browser\'s. Carries notifications, encrypted so it can\'t read them'],
  ['bar-chart-2', 'Usage analytics', 'Which screens are opened. Never what your documents say'],
];

export function ledgerDiagram() {
  const rows = SERVICES.map(([ic, name, what], i) => `<div class="pv-lg-row" id="lg-${i}">
      <span class="pv-lg-ic">${icon(ic, 20, NAVY, 2.2)}</span><b>${name}</b><span>${what}</span></div>`).join('');
  return `<div class="pv-dg pv-card pv-ledger" id="dg-ledger">
      <div class="pv-card-h">${icon('list', 20, CORAL, 2.4)}<span>Who else gets what</span></div>
      ${rows}
      <div class="pv-card-foot" id="dg-ledger-foot">${icon('slash', 18, NAVY, 2.4)}<span>We don't sell your data. <b>AskLocker has no ads.</b></span></div>
    </div>`;
}

// ─── Manage Family (src/app/family.tsx), with an invitation waiting ──────
// As the screen is just after Rohan invites his wife, on 2 October, before
// she accepted (the family film has her joining on 3 October) and before Papa
// joined: two of Family Plus's four places taken, the invitation holding a
// third. The notice, the tree link, the rows and the pending card are the
// screen's own: an email invitation shows its address, and who sent it.

export const INVITE = { email: 'priya.sharma@example.com', date: '2 October 2026' };

export function membersScreen() {
  const member = (id, name, rel, { me = false, owner = false } = {}) => `<div class="tm-card" id="${id}">
      <div class="tm-av fam${me ? ' me' : ''}">${name.charAt(0).toUpperCase()}</div>
      <div class="tm-info"><div class="tm-n"><span>${name}</span><span class="tm-star">★</span>${me ? '<span class="tm-pill you">You</span>' : ''}${owner ? '<span class="tm-pill admin">Owner</span>' : ''}</div>
        <div class="tm-r">${rel}</div></div>
      ${me ? '' : `<span class="tm-act">${icon('shield', 16, NAVY)}</span><span class="tm-act red">${icon('user-minus', 16, '#EF4444')}</span>`}</div>`;
  return `<section class="scr" id="scr-members">${sbFill}
    ${header(STORY.familyName, { sub: '2 of 4 members', right: `<div class="v4-hbtn" id="mf-add">${icon('user-plus', 16, '#fff')}<span>Add</span></div>` })}
    <div class="tm-body" id="mf-body">
      <div class="mf-notice" id="mf-notice">${icon('info', 16, NAVY)}<span>Invitation sent to ${INVITE.email}. They show as Pending approval until they accept.</span>${icon('x', 16, '#6B7280')}</div>
      <div class="mf-tree"><span class="mf-tree-ic">${icon('git-branch', 16, NAVY)}</span>
        <div class="tm-info"><b>Family tree</b><span>Everyone in the family, and their documents</span></div>${icon('chevron-right', 16, '#9CA3AF')}</div>
      <div class="overline">Members</div>
      ${member('mf-me', STORY.youFull, 'Admin', { me: true, owner: true })}
      ${member('mf-maa', STORY.maa, 'Mother')}
      <div class="overline">Pending approval</div>
      <div class="tm-card" id="mf-pending"><div class="tm-clock">${icon('clock', 16, AMBER)}</div>
        <div class="tm-info"><div class="tm-n"><span class="mf-email">${INVITE.email}</span><span class="tm-pill wait">Pending approval</span></div>
          <div class="tm-r">Invited ${INVITE.date} by you</div></div>
        <span class="tm-act red">${icon('x', 16, '#EF4444')}</span></div>
    </div>
  </section>`;
}

// ─── Delete account (src/app/settings/delete-account.tsx) ────────────────

export function deleteScreen() {
  return `<section class="scr" id="scr-delete">${sbFill}
    ${header('Delete account')}
    <div class="st-body" id="del-body">
      <div class="st-card"><div class="st-ct">${icon('alert-triangle', 18, NAVY)}<span>This cannot be undone</span></div>
        <div class="st-b">Your account is deleted right away. Copies in our providers' backups and logs expire on their own.</div>
        <div class="st-m">Your profile, saved chats, notifications and any Gmail connection go too.</div></div>
      <div class="st-card"><div class="st-ct">${icon('trash-2', 18, NAVY)}<span>Deleted with your account</span></div>
        <div class="st-row"><b>Personal vault</b><span>6 documents</span></div></div>
      <div class="st-card" id="del-leave"><div class="st-ct">${icon('log-out', 18, NAVY)}<span>Families you leave</span></div>
        <div class="st-m">These keep their documents. You stay in their family tree by name, and your emergency card is deleted.</div>
        <div class="st-row"><b>${STORY.familyName}</b><span>Keeps 14 documents you added</span></div></div>
      <div class="st-card"><div class="st-ct">${icon('user-x', 18, NAVY)}<span>Delete your account</span></div>
        <div class="st-l">Type DELETE to confirm</div>
        <div class="st-field" id="del-field"><span id="del-typed"></span><span class="caret" id="del-caret" style="opacity:0"></span></div>
        <div class="st-danger" id="del-btn">${icon('trash-2', 16, '#fff')}<span>Delete my account</span></div></div>
    </div>
  </section>`;
}

// ─── Callouts beside the phone ───────────────────────────────────────────

const label = (ic, text) => `<div class="co-label">${icon(ic, 14, CORAL, 2.6)}<span>${text}</span></div>`;
const check = (text, ic = 'check', c = GREEN) => `<div class="co-check">${icon(ic, 16, c, 2.6)}<span>${text}</span></div>`;

export const PV_CALLOUTS = {
  vault: () => `<div class="callout" id="co-vault" style="width:420px">${label('users', 'By invitation')}
    ${check('Only an admin can invite')}${check('Nobody joins until they say yes')}${check("Leaving needs nobody's permission")}
    ${check('Your personal vault: nobody else can join it', 'lock')}</div>`,
  share: () => `<div class="callout" id="co-share" style="width:400px">${label('link', 'One document, one link')}
    ${check('Opens without an account')}${check('Lasts 1 or 7 days, or 30 with Family Plus')}${check('Turn it off any time')}${check('See how often it was opened')}</div>`,
  device: () => `<div class="callout" id="co-device" style="width:420px">${label('smartphone', 'On your phone')}
    ${check('Photos and spreadsheets are read here')}${check('Your fingerprint never leaves it', 'aperture')}
    ${check('Card and UPI details go only to Razorpay', 'credit-card')}
    <div class="co-quiet">A photo your phone can't read goes to OCR.space.</div></div>`,
  control: () => `<div class="callout" id="co-control" style="width:410px">${label('sliders', 'Yours to decide')}
    ${check('Delete any document you added')}${check('Turn off a share link')}${check('Switch off app usage counts')}
    ${check('Delete your account, right away', 'user-x')}
    <div class="co-quiet">What you added to a family stays with it. Delete it first.</div></div>`,
};
