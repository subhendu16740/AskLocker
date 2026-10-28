// Screens the two films never needed, for the feature posters and shorts
// (src/features.js): a document's own page with what was read off it and its
// share sheet, the lock that a fingerprint opens, and a spreadsheet added to a
// business and asked about. Like the films' screens they are ports of the real
// ones (src/app/document/[id].tsx, components/share-sheet.tsx,
// components/app-lock-screen.tsx, (tabs)/upload.tsx, (tabs)/search.tsx), with
// the same copy, sized by src/constants/design.ts, filled with the films'
// fictional family and business.
import {
  icon, logoMark, spinner, sbFill, header, tabBar, plusTag, askMessages, askHeader, saveBar, askInput, categoryChips,
  uploadedDialog, THEME,
} from './parts.js';
import { STORY, policyPaper } from './family-screens.js';
import { BIZ, MONEY } from './business-screens.js';

const NAVY = THEME.family.primary;
const TEAL = THEME.business.primary;

// ─── A document's page (src/app/document/[id].tsx) ───────────────────────
// Papa's policy, a week after Rohan photographed it. "Extracted Data" is
// what supabase/functions/_shared/metadata.ts reads off policyPaper(): run
// extractMetadata on its text and you get these four rows, in this order.
export const POLICY_META = [
  ['Expiry date', '14/03/2027'],
  ['Policy number', STORY.policyNo],
  ['Name', STORY.papa],
  ['Amount', '10,00,000'],
];

// A share link's secret (two v4 UUIDs, 64 hex characters after #s).
export const SHARE_URL = 'https://asklocker.com/s#4f9c2e71b8d04a1c9e35d6f0a2b7c8e1d3a64f05c9b24e8a8f17d2c6e0b9a3f4';
// Made on 1 November, the day the policy was added, for 7 days.
export const SHARE = { note: 'CA Mehta', until: '8 November 2026', untilShort: '8 November 2026' };

function shareSheet() {
  const chip = (id, label, on) => `<div class="ss-chip${on ? ' on' : ''}" id="${id}">${label}</div>`;
  return `<div class="ss-dim" id="ss-dim"></div>
    <div class="ss-sheet" id="ss-sheet">
      <i class="ss-handle"></i>
      <div class="ss-head"><span>Share by link</span>${icon('x', 24, '#6B7280')}</div>
      <div class="ss-body">
        <div class="ss-intro">Anyone with the link can open this document without an account. You or a family admin can turn it off any time.</div>
        <div class="ss-swap" id="ss-swap1">
          <div class="ss-form" id="ss-form">
            <div class="ss-field"><div class="ss-l">Who is it for? (optional)</div>
              <div class="ss-input" id="ss-input"><span class="ph" id="ss-ph">e.g. CA Sharma</span><span id="ss-typed"></span><span class="caret" id="ss-caret" style="opacity:0"></span></div></div>
            <div class="ss-field"><div class="ss-l">How long?</div>
              <div class="ss-chips">${chip('ss-d1', '1 day')}${chip('ss-d7', '7 days', true)}${chip('ss-d30', '30 days')}</div></div>
            <div class="ss-btn" id="ss-make">${icon('link', 16, '#fff')}<span>Make a link</span>
              <div class="busy" id="ss-busy" style="opacity:0">${spinner('#fff', 20, 'ss-spin')}</div></div>
          </div>
          <div class="ss-made" id="ss-made">
            <div class="ss-link">${SHARE_URL}</div>
            <div class="ss-btn" id="ss-copy"><span class="ss-copy-a">${icon('copy', 16, '#fff')}<span>Copy link</span></span>
              <span class="ss-copy-b" id="ss-copied" style="opacity:0">${icon('check', 16, '#fff')}<span>Copied</span></span></div>
            <div class="ss-btn2">${icon('share-2', 16, NAVY)}<span>Send it…</span></div>
            <div class="ss-muted">Works until ${SHARE.until}. Copy it now. It won't be shown again.</div>
          </div>
        </div>
        <div class="ss-section">Links for this document</div>
        <div class="ss-swap" id="ss-swap2">
          <div class="ss-none" id="ss-none">No working links.</div>
          <div class="ss-row" id="ss-row"><div class="ss-rt"><div class="ss-r1">For ${SHARE.note} · until ${SHARE.untilShort}</div>
            <div class="ss-r2">Not opened yet · made by you</div></div><span class="ss-off">Turn off</span></div>
        </div>
      </div>
    </div>`;
}

export function documentScreen({ share = false } = {}) {
  const tag = (cls, text) => `<span class="dp-tag ${cls}">${text}</span>`;
  const row = (label, value) => `<div class="dp-row"><span class="dp-l">${label}</span><span class="dp-v">${value}</span></div>`;
  const meta = POLICY_META.map(([k, v], i) => `<div class="dp-row dp-meta" id="dp-m${i}"><span class="dp-l">${k}</span><span class="dp-v">${v}</span></div>`).join('');
  const action = (id, ic, label, bg, c) => `<div class="dp-act" id="${id}"><span class="dp-aic" style="background:${bg}">${icon(ic, 18, c)}</span><span>${label}</span></div>`;
  return `<section class="scr" id="scr-doc">${sbFill}
    ${header(STORY.scanFile)}
    <div class="dp-tags">${tag('blue', 'Health Insurance')}${tag('purple', 'Father')}${tag('gray', 'Nov 2026')}</div>
    <div class="dp-scroll" id="dp-scroll"><div class="dp-inner" id="dp-inner">
      <div class="dp-preview"><div class="preview-photo dp-photo"><div class="grain"></div><div class="preview-doc">${policyPaper()}</div></div></div>
      <div class="dp-card" id="dp-info">
        <div class="dp-ct">Document Information</div>
        ${row('Uploaded', 'November 1, 2026')}${row('File size', '1.4 MB')}${row('Type', 'JPG')}
        ${row('Category', 'Health Insurance')}${row('Uploaded by', STORY.youFull)}
        <div class="dp-row"><span class="dp-l">Belongs to</span><span class="dp-owner"><i>${STORY.papa[0]}</i><span class="dp-v">${STORY.papa}</span></span></div>
        <div class="dp-ct later" id="dp-meta-title">Extracted Data</div>
        ${meta}
      </div>
    </div></div>
    <div class="dp-actions">
      ${action('dp-share', 'share-2', 'Share', '#EFF6FF', '#2563EB')}${action('dp-dl', 'download', 'Download', '#F0FDF4', '#16A34A')}
      ${action('dp-edit', 'edit-3', 'Edit', '#FFFBEB', '#D97706')}${action('dp-del', 'trash-2', 'Delete', '#FEF2F2', '#DC2626')}
    </div>
    ${share ? shareSheet() : ''}
  </section>`;
}

// ─── Where a document goes (upload.tsx's "Where should this go?") ───────
// Every save asks which vault: the personal vault, which nobody else using
// AskLocker can open, or the family's. The rows and the hint under the field
// are the app's own words (lib/vaults.ts vaultSubtitle(), upload.tsx).
export function vaultsScreen() {
  const face = (id, ic, label, on = true) => `<div class="vf-face" id="${id}"><span class="vf-ic${on ? ' on' : ''}">${icon(ic, 16, on ? '#fff' : NAVY)}</span>
    <span class="vf-l${on ? '' : ' ph'}">${label}</span>${icon('chevron-down', 20, '#4A6491')}</div>`;
  const row = (id, ic, name, sub) => `<div class="vm-row" id="${id}"><span class="vf-ic">${icon(ic, 16, NAVY)}</span><span class="vm-t"><b>${name}</b><i>${sub}</i></span></div>`;
  return `<section class="scr" id="scr-vaults">${sbFill}
    ${header('Upload Document')}
    <div class="tag-scroll" id="vs-scroll"><div class="tag-inner" id="vs-inner">
      <div class="preview"><div class="preview-photo"><div class="grain"></div><div class="preview-doc">${policyPaper()}</div></div></div>
      <div class="file-row">${icon('image', 16, '#6B7280')}<span class="n">${STORY.scanFile}</span><span class="s">1.4 MB</span></div>
      <div class="ocr-slot vs-found"><div class="ocr-done">${icon('check-circle', 16, '#16A34A')}<span>Found 1,284 characters of text</span></div></div>
      <div class="change-file">${icon('refresh-cw', 16, NAVY)}<span>Choose different file</span></div>
      <div class="up-h vf-h" id="vs-title">Where should this go?</div>
      <div class="vault-field" id="vs-field">
        ${face('vs-empty', 'archive', 'Choose a vault', false)}
        ${face('vs-personal', 'lock', 'Personal vault')}
        ${face('vs-family', 'users', STORY.familyName)}
        <div class="vault-menu" id="vs-menu">
          ${row('vs-m-personal', 'lock', 'Personal vault', 'Yours alone')}
          ${row('vs-m-family', 'users', STORY.familyName, "Family · you're an admin")}
        </div>
      </div>
      <div class="vf-hint" id="vs-hint"><span id="vs-h0">Your personal vault is yours alone. Everyone in a family or business can see what's saved there.</span>
        <span id="vs-h1">Yours alone. Your family won't see it.</span>
        <span id="vs-h2">Everyone in ${STORY.familyName} will see it.</span></div>
      <div class="save-btn" id="vs-save"><span class="save-l" id="vs-s0">Choose where it goes</span><span class="save-l" id="vs-s1">Save to Personal vault</span>
        <span class="save-l" id="vs-s2">Save to ${STORY.familyName}</span></div>
    </div></div>
    ${tabBar('upload', 'vs')}
  </section>`;
}

// ─── Locked, and opened with a fingerprint (components/app-lock-screen.tsx)
// The lock covers AskLocker when it opens; Unlock asks the device for the
// passkey, and the device asks for a finger. Its sheet is the phone's own,
// drawn here as Android draws one, with nothing of any company on it.
export function appLockScreen() {
  return `<section class="scr" id="scr-applock">${sbFill}
    <div class="al-body">
      <div class="al-logo grad">${logoMark()}</div>
      <div class="al-title">AskLocker is locked</div>
      <div class="al-text">Use your fingerprint or face to open it.</div>
      <div class="al-unlock" id="al-unlock">${icon('aperture', 24, '#fff')}<span>Unlock</span>
        <div class="busy" id="al-busy" style="opacity:0">${spinner('#fff', 20, 'al-spin')}</div></div>
      <div class="al-google">Use Google instead</div>
      <div class="al-small">This signs you out.</div>
    </div>
    <div class="pk-dim" id="pk-dim"></div>
    <div class="pk-sheet" id="pk-sheet">
      <i class="ss-handle"></i>
      <div class="pk-site"><span class="pk-key">${icon('key', 18, NAVY)}</span><span>asklocker.com</span></div>
      <div class="pk-title">Use your passkey to sign in?</div>
      <div class="pk-acct"><i>${STORY.you[0]}</i><div><b>${STORY.youFull}</b><span>${STORY.email}</span></div></div>
      <div class="pk-fp" id="pk-fp">
        <div class="pk-ring" id="pk-ring"></div>
        <div class="pk-icon" id="pk-icon">${fingerprintGlyph()}</div>
        <div class="pk-ok" id="pk-ok" style="opacity:0">${icon('check', 34, '#fff', 3)}</div>
      </div>
      <div class="pk-hints"><div class="pk-hint" id="pk-hint">Touch the fingerprint sensor</div>
        <div class="pk-hint ok" id="pk-hint-ok" style="opacity:0">Verified</div></div>
      <div class="pk-cancel">Cancel</div>
    </div>
  </section>`;
}

// Feather has no fingerprint (the app uses "aperture"); the phone's own sheet
// shows one, so it is drawn: whorls of a fingertip.
function fingerprintGlyph() {
  return `<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <path d="M6.2 5.4A9 9 0 0 1 20.6 9"/><path d="M3.4 9.4A9 9 0 0 1 4.6 7"/><path d="M21 13a9 9 0 0 1-.4 3"/>
    <path d="M7.5 19.4c.9-1.6 1.4-3.5 1.4-5.4a3.1 3.1 0 0 1 6.2 0c0 .7 0 1.4-.1 2"/>
    <path d="M4.2 16.8A9.6 9.6 0 0 0 5.8 14a6.2 6.2 0 0 1 12.4 0c0 2-.3 3.9-.9 5.6"/>
    <path d="M12 14c0 3-1 5.8-2.8 8"/><path d="M14.8 20.2c.5-1 .9-2 1.2-3.1"/></svg>`;
}

// ─── A spreadsheet added to a business (upload.tsx), then asked (search.tsx)
export const SHEET = { file: 'Sales Register 2026-27.xlsx', size: '86 KB', rows: 245, sheets: 3 };
const BIZ_CATEGORIES = [
  'Sales Invoices', 'Purchase Bills', 'GST Returns', 'Contracts & Agreements', 'Licences & Registrations', 'Bank & Loans',
  'Business Insurance', 'Employee Records', 'Payroll', 'Lease & Property', 'Tax (ITR/TDS)', 'Other',
];
export const SALES = BIZ_CATEGORIES.indexOf('Sales Invoices');

export function sheetTagScreen() {
  return `<section class="scr biz" id="scr-sheet">${sbFill}
    ${header('Upload Document', { theme: 'business' })}
    <div class="tag-scroll" id="sh-scroll"><div class="tag-inner" id="sh-inner">
      <div class="sh-preview"><span class="sh-pic">${icon('grid', 32, NAVY)}</span><span class="sh-kind">Excel spreadsheet</span></div>
      <div class="file-row">${icon('grid', 16, '#6B7280')}<span class="n">${SHEET.file}</span><span class="s">${SHEET.size}</span></div>
      <div class="ocr-slot" id="sh-slot">
        <div class="ocr-card" id="sh-card"><div class="ocr-head">${spinner(NAVY, 20, 'sh-spin')}<span>Reading the spreadsheet...</span></div>
          <div class="ocr-bar"><div class="ocr-fill" id="sh-fill"></div></div></div>
        <div class="ocr-done" id="sh-done">${icon('check-circle', 16, '#16A34A')}<span>Read ${SHEET.rows} rows from ${SHEET.sheets} sheets</span></div>
      </div>
      <div class="change-file">${icon('refresh-cw', 16, NAVY)}<span>Choose different file</span></div>
      <div class="up-h" style="margin-top:24px">Category</div>
      <div class="cat-hint" id="sh-hint">Picked from the file. Tap another to change it.</div>
      ${categoryChips('sc', BIZ_CATEGORIES)}
      <div class="save-btn" id="sh-save"><span class="save-l">Save to ${BIZ.name}</span>
        <div class="busy" id="sh-busy" style="opacity:0">${spinner('#fff', 20, 'sh-spin2')}<span>Uploading...</span></div></div>
    </div></div>
    ${uploadedDialog(BIZ.name).replace(/id="up-dialog"/, 'id="sh-dialog"').replace(/id="up-dialog-box"/, 'id="sh-dialog-box"')}
    ${tabBar('upload', 'sh', 'business')}
  </section>`;
}

const rupees = (v) => `₹${v.toLocaleString('en-IN')}`;
// The register's three sheets are the year's sales invoices (Date, Invoice
// No, Customer, GSTIN, Taxable, GST, Total), the credit notes, and a Summary
// with a row a month ("Month: Sep 2026 | Sales: 390000 | ..."). The answer
// reads the Summary's row: one row says the month's total, so nothing is added
// up by the model. "Invoice No" in the first rows is what files it under Sales
// Invoices (_shared/doc-category.ts); the months are the overview's.
const SEP = MONEY.in[MONEY.months.indexOf('Sep')];
const AUG = MONEY.in[MONEY.months.indexOf('Aug')];
export const SHEET_Q = 'What were our sales in September?';

export function sheetAskScreen() {
  const turns = [{
    q: SHEET_Q, loading: 'Searching documents...',
    a: `Sales in September 2026 were <mark class="hl" id="sa-hl">${rupees(SEP)}</mark>, from the Summary sheet of your sales register. August's were ${rupees(AUG)}.`,
    src: SHEET.file,
  }];
  return `<section class="scr biz" id="scr-sask">${sbFill}
    ${askHeader('sa', 'business')}
    <div class="ask-area" id="sa-area">
      <div class="ask-empty" id="sa-empty">
        <div class="ask-hero"><div class="ic grad">${icon('cpu', 32, '#fff')}</div>
          <div class="t">Ask anything about your documents</div><div class="s">I'll search all your documents.</div></div>
        <div class="ask-cats">${BIZ_CATEGORIES.slice(0, 8).map((c) => `<span class="ask-cat">${c}</span>`).join('')}</div>
      </div>
      <div class="chat-stack" id="sa-stack">${askMessages('sa', turns, false)}</div>
    </div>
    <div class="ask-bottom">${saveBar('sa')}${askInput('sa')}</div>
    ${tabBar('search', 'sa', 'business')}
  </section>`;
}

// ─── Callouts: beside the phone on a poster, in the text's place in a short ─
const check = (t, ic = 'check') => `<div class="co-check">${icon(ic, 16, '#16A34A', 2.6)}<span>${t}</span></div>`;
const ask = (q, who) => `<div class="co-ask"><span class="q">“${q}”</span>${icon('chevron-right', 16, '#9CA3AF', 2.4)}<span class="who">${who}</span></div>`;
const label = (ic, t) => `<div class="co-label">${icon(ic, 14, 'currentColor', 2.6)}<span>${t}</span></div>`;

export const CALLOUTS = {
  ask: () => `<div class="callout" id="co-f" style="width:360px">${label('file-text', 'Where the answer came from')}
    <div class="co-row"><span class="co-k">Document</span><span class="co-v sm">${STORY.scanFile}</span></div>
    <div class="co-row"><span class="co-k">Vault</span><span class="co-v sm">${STORY.familyName}</span></div>
    <div class="co-foot">${icon('check', 14, '#16A34A', 2.6)}<span>Tap it to open the document</span></div></div>`,
  // What happened to the photo; the page beside it shows what was read off it.
  read: () => `<div class="callout" id="co-f" style="width:370px">${label('zap', 'From one photo')}
    ${check('Read on your phone, in seconds', 'smartphone')}${check('Filed under Health Insurance', 'folder')}${check('Expiry reminder added', 'bell')}</div>`,
  voice: () => `<div class="callout co-langs" id="co-f" style="width:440px">${label('mic', 'Speak and hear it in')}
    <div class="co-lgrid">${[['हिन्दी', 'Hindi'], ['বাংলা', 'Bengali'], ['தமிழ்', 'Tamil'], ['తెలుగు', 'Telugu'], ['मराठी', 'Marathi'],
      ['ગુજરાતી', 'Gujarati'], ['ಕನ್ನಡ', 'Kannada'], ['മലയാളം', 'Malayalam'], ['ਪੰਜਾਬੀ', 'Punjabi'], ['English', 'India']]
      .map(([n, e]) => `<div class="co-lang"><b>${n}</b><i>${e}</i></div>`).join('')}</div>
    <div class="co-quiet">Free on every plan. Each phone reads in its own voices.</div></div>`,
  reminders: () => `<div class="callout" id="co-f" style="width:410px">${label('bell', 'Before it expires')}
    <div class="co-steps"><i class="track"></i>
      ${[['90', 'days'], ['30', 'days'], ['7', 'days'], ['On the', 'day']].map(([a, b]) => `<div class="co-step"><i class="dot"></i><b>${a}</b><span>${b}</span></div>`).join('')}</div>
    <div class="co-quiet">For everyone in the family, with Family Plus. On Free, one reminder 30 days before, to whoever added it.</div></div>`,
  tree: () => `<div class="callout" id="co-f" style="width:390px">${label('users', 'Ask by relation')}
    ${ask("Papa's health policy", STORY.papa)}${ask('Dadi ki pension', STORY.dadi)}${ask('दादी की पेंशन', STORY.dadi)}
    <div class="co-quiet">Worked out from the family tree.</div></div>`,
  emergency: () => `<div class="callout" id="co-f" style="width:360px">${label('plus-square', 'On every card')}
    ${check('Blood group, and allergies in red')}${check('Medicines and health conditions')}${check('Doctor and family, one tap to call')}${check('Health insurance policy number')}</div>`,
  share: () => `<div class="callout" id="co-f" style="width:400px">${label('link', 'One document, one link')}
    ${check('Opens without an account')}${check('Lasts 1 or 7 days, or 30 with Family Plus')}${check('Turn it off any time')}${check('See how often it was opened')}</div>`,
  // Who sees each vault, in the app's own words (lib/vaults.ts, upload.tsx).
  vaults: () => `<div class="callout" id="co-f" style="width:390px">${label('lock', 'Who can open what')}
    ${check('Family vault: everyone in your family', 'users')}${check('Personal vault: yours alone', 'lock')}
    ${check('Only people you invite can join', 'user-check')}</div>`,
  fingerprint: () => `<div class="callout" id="co-f" style="width:380px">${label('aperture', 'A passkey on your phone')}
    ${check('Sign in with Google once')}${check('Then your fingerprint or face')}${check('No password to remember')}
    ${check('Your fingerprint stays on your phone')}</div>`,
  business: () => `<div class="callout" id="co-f" style="width:370px">${label('bar-chart-2', 'Read from your papers')}
    ${check('Renewals from licences and policies')}${check('Bills due from due dates on bills')}${check('Money in and out from invoice totals')}
    <div class="co-quiet">Renewals and bills due on Plus. Money in and out on Pro.</div></div>`,
  sheets: () => `<div class="callout" id="co-f" style="width:360px">${label('grid', 'Every row, with its columns')}
    <div class="co-row"><span class="co-k">Read</span><span class="co-v">${SHEET.rows} rows · ${SHEET.sheets} sheets</span></div>
    <div class="co-row"><span class="co-k">Files</span><span class="co-v">.xlsx and .csv</span></div>
    <div class="co-foot">${icon('check', 14, '#16A34A', 2.6)}<span>Read the moment you add it</span></div></div>`,
};

export { NAVY, TEAL };
