// HTML for the business film: a formal product film, not a story. Its layers
// are a title, the challenge (what a business keeps, and the dates in it), the
// product in five parts, five numbered chapters beside the phone, access and
// control, the plans and a closing card. The phone screens are ports of the
// real screens in Business mode (src/app/** with src/lib/vault-theme.ts's
// teal), filled with a fictional business as sample data: Arora Electric, an
// electrical-supplies distributor in Pune, on the Pro plan. Every name, number
// and GSTIN is made up; the GSTINs carry valid check characters so the app's
// extractor would read them.
import {
  icon, spinner, sbFill, plusTag, plusStar, header, tabBar, words, categoryChips, ocrSlot, uploadedDialog,
  lockScreen, pushNotif, cameraScreen, phoneShell, askMessages, askHeader, saveBar, askInput, brand, THEME,
} from './parts.js';

const TEAL = THEME.business.primary;

// ─── Sample data (edit here to re-cast the film) ─────────────────────────
export const BIZ = {
  name: 'Arora Electric',
  owner: 'Kavita Arora',
  email: 'kavita@example.com',
  gstin: '27BQKPA4821M1ZP',
  caShown: 'Pooja, our CA',
  caEmail: 'pooja@example.com',
  supplier: 'Mehta Cables',
  supplierGstin: '24AAJFM7350R1ZN',
  billNo: 'MC-7781',
  // A camera scan is saved as scan_<Date.now()>.jpg (upload.tsx): this one was
  // taken at 10:14 on Saturday 3 October 2026.
  scanFile: 'scan_1791002692000.jpg',
  // The closing card. Leave url empty to show no address.
  tagline: 'Every bill, licence and contract. One question away.',
  cta: 'Start your business vault',
  ctaNote: 'Free to start · Plans from ₹499 a month + GST',
  url: 'asklocker.com',
};

// Upload offers a business's twelve categories, in this order, before More…
// (the business order in supabase/functions/_shared/doc-category.ts).
const CATEGORIES = [
  'Sales Invoices', 'Purchase Bills', 'GST Returns', 'Contracts & Agreements', 'Licences & Registrations', 'Bank & Loans',
  'Business Insurance', 'Employee Records', 'Payroll', 'Lease & Property', 'Tax (ITR/TDS)', 'Other',
];
export const PURCHASE = CATEGORIES.indexOf('Purchase Bills');

// ─── The fictional supplier's bill ───────────────────────────────────────
// Its words are the ones the app reads (supabase/functions/_shared/
// metadata.ts and doc-category.ts): "Supplier" files it under Purchase Bills,
// "Bill No", "Bill Date", "Payment due by" and "Total Amount Payable" give the
// number, the dates and the total, and both GSTINs pass the check character.
export function billPaper() {
  const item = (name, hsn, qty, rate, amt) => `<div class="bp-item"><span>${name}</span><span>${hsn}</span><span>${qty}</span><span>${rate}</span><span>${amt}</span></div>`;
  return `<div class="paper bill">
    <div class="pp-head">
      <div class="pp-brand"><div class="pp-mark bp-mark">${icon('zap', 14, '#fff', 2.4)}</div>
        <div class="pp-name bp-name">MEHTA CABLES<small>WIRES &amp; CABLES · AHMEDABAD</small></div></div>
      <div class="pp-kind">TAX<br>INVOICE</div>
    </div>
    <div class="pp-row"><span class="pp-k">Supplier</span><span><b>${BIZ.supplier}</b> · GSTIN ${BIZ.supplierGstin}</span></div>
    <div class="pp-row"><span class="pp-k">Bill To</span><span><b>${BIZ.name}</b>, Pune · GSTIN ${BIZ.gstin}</span></div>
    <div class="pp-row"><span class="pp-k">Bill No</span><b>${BIZ.billNo}</b></div>
    <div class="pp-row"><span class="pp-k">Bill Date</span><span>02/10/2026</span></div>
    <div class="pp-row"><span class="pp-k">Payment due by</span><b>25/10/2026</b></div>
    <div class="bp-table">
      <div class="bp-item bp-th"><span>Item</span><span>HSN</span><span>Qty</span><span>Rate</span><span>Amount</span></div>
      ${item('FR PVC wire 1.5 sq mm, 90 m', '8544', '50', '1,240.00', '62,000.00')}
      ${item('FR PVC wire 2.5 sq mm, 90 m', '8544', '20', '1,900.00', '38,000.00')}
    </div>
    <div class="bp-sum"><span>Taxable value</span><span>1,00,000.00</span></div>
    <div class="bp-sum"><span>IGST 18%</span><span>18,000.00</span></div>
    <div class="bp-total"><span>Total Amount Payable</span><span>Rs. 1,18,000.00</span></div>
    <div class="pp-foot"><span>Goods once sold are taken back only<br>against a credit note.</span><span class="pp-sign">N. Mehta</span></div>
    <div class="pp-spec">SPECIMEN</div>
  </div>`;
}

// ─── Upload (src/app/(tabs)/upload.tsx), in Business mode ────────────────
// One business, so no "Where should this go?", and no "Who does this belong
// to?": a business has no family tree.

export function uploadScreen() {
  return `<section class="scr biz" id="scr-upload">${sbFill}
    ${header('Upload Document', { theme: 'business' })}
    <div class="up-body">
      <div class="up-h">Choose source</div>
      <div class="up-primary">
        <div class="up-scan" id="up-scan">${icon('camera', 28, '#fff')}<span>Scan</span></div>
        <div class="up-browse">${icon('folder', 28, '#2A3D66')}<span>Browse Files</span></div>
      </div>
      <div class="up-secondary">
        <div class="up-sbtn">${icon('image', 22, '#2A3D66')}<span>Gallery</span></div>
        <div class="up-sbtn">${icon('mail', 22, '#2A3D66')}<span>From Gmail</span>${plusTag('Plus')}</div>
      </div>
      <div class="up-hint">${icon('info', 16, '#6B7280')}<span>PDF, PNG or JPG</span></div>
    </div>
    ${tabBar('upload', 'up', 'business')}
  </section>`;
}

export function tagScreen() {
  return `<section class="scr biz" id="scr-tag">${sbFill}
    ${header('Upload Document', { theme: 'business' })}
    <div class="tag-scroll" id="tag-scroll"><div class="tag-inner" id="tag-inner">
      <div class="preview"><div class="preview-photo"><div class="grain"></div><div class="preview-doc">${billPaper()}</div></div></div>
      <div class="file-row">${icon('image', 16, '#6B7280')}<span class="n">${BIZ.scanFile}</span><span class="s">1.2 MB</span></div>
      ${ocrSlot(947)}
      <div class="change-file">${icon('refresh-cw', 16, '#2A3D66')}<span>Choose different file</span></div>
      <div class="up-h" style="margin-top:24px">Category</div>
      <div class="cat-hint" id="cat-hint">Picked from the file. Tap another to change it.</div>
      ${categoryChips('c', CATEGORIES)}
      <div class="save-btn" id="save-btn"><span class="save-l">Save to ${BIZ.name}</span>
        <div class="busy" id="save-busy" style="opacity:0">${spinner('#fff', 20, 'save-spin')}<span>Uploading...</span></div></div>
    </div></div>
    ${uploadedDialog(BIZ.name)}
    ${tabBar('upload', 'tag', 'business')}
  </section>`;
}

// ─── Ask (src/app/(tabs)/search.tsx), in Business mode ───────────────────
// The header is teal; the bubbles, the send button and the empty state's
// icon stay navy, as the app has them.

function askEmpty(id) {
  return `<div class="ask-empty" id="${id}">
    <div class="ask-hero"><div class="ic grad">${icon('cpu', 32, '#fff')}</div>
      <div class="t">Ask anything about your documents</div><div class="s">I'll search all your documents.</div></div>
    <div class="ask-cats">${CATEGORIES.slice(0, 8).map((c) => `<span class="ask-cat">${c}</span>`).join('')}</div>
  </div>`;
}

export function askScreen() {
  const turns = [{
    q: `When is the ${BIZ.supplier} bill due, and how much is it?`, loading: 'Searching documents...',
    a: `${BIZ.supplier}' bill ${BIZ.billNo} is for <mark class="hl" id="ask-hl">₹1,18,000</mark>, due on 25 October 2026. It's dated 2 October and includes ₹18,000 IGST.`,
    src: BIZ.scanFile,
  }];
  return `<section class="scr biz" id="scr-ask">${sbFill}
    ${askHeader('ask', 'business')}
    <div class="ask-area" id="ask-area">
      ${askEmpty('ask-empty')}
      <div class="chat-stack" id="ask-stack">${askMessages('ask', turns, false)}</div>
    </div>
    <div class="ask-bottom">${saveBar('ask')}${askInput('ask')}</div>
    ${tabBar('search', 'ask', 'business')}
  </section>`;
}

// ─── Home and the drawer (home.tsx, ProfileDrawer.tsx), in Business mode ─

function drawerPanel() {
  // Plans is the business's Family Plus row: its star in the business's gold.
  const items = [['home', 'Home'], ['bar-chart-2', 'Overview', '', 'dr-overview'], ['edit-3', 'My notes', '', 'dr-notes'],
    ['briefcase', 'Manage team', '', 'dr-team'], ['clock', 'Reminders', 'Plus'], ['star', 'Plans'], ['settings', 'Settings']];
  const modeBtn = (m, ic, label) => {
    const on = m === 'business';
    const tone = THEME[m].primary;
    return `<div class="dr-mode${on ? ' on' : ''}" style="${on ? `background:${tone};border-color:${tone}` : ''}">${icon(ic, 16, on ? '#fff' : tone)}<span style="color:${on ? '#fff' : tone}">${label}</span></div>`;
  };
  return `<div class="drawer-panel biz">
    <div class="dr-head">
      <div class="dr-top"><div class="dr-av">K</div><span class="dr-x">${icon('x', 24, '#fff')}</span></div>
      <div class="dr-name">${BIZ.owner}${plusStar}</div><div class="dr-line">${BIZ.email}</div><div class="dr-line">${BIZ.name} · Admin</div>
    </div>
    <div class="dr-switch">${modeBtn('family', 'users', 'Family')}${modeBtn('business', 'briefcase', 'Business')}</div>
    <div class="dr-menu">
      ${items.map(([ic, label, plus, id]) => `<div class="dr-row"${id ? ` id="${id}"` : ''}><span class="dr-ic">${icon(ic, 16, ic === 'star' ? '#B7791F' : TEAL)}</span><span class="dr-l">${label}</span>
        ${plus ? plusTag(plus) : icon('chevron-right', 16, '#9CA3AF')}</div>`).join('')}
    </div>
    <div class="dr-foot"><div class="dr-out">${icon('log-out', 16, '#DC2626')}<span>Sign Out</span></div><div class="dr-ver">AskLocker 1.0.0</div></div>
  </div>`;
}

export function homeScreen() {
  // Business categories are grey on Home, and each document wears the business's tag.
  const doc = (name, ic, cat, line) => `<div class="doc-card">
      <div class="doc-icon grad-biz">${icon(ic, 18, '#fff')}</div>
      <div class="doc-info"><div class="doc-title">${name}</div>
        <div class="doc-meta"><span class="cat-badge" style="background:#6B7280">${cat}</span>
          <span class="vault-tag biz">${icon('briefcase', 12, TEAL)}<span>${BIZ.name}</span></span>
          <span>${line}</span></div></div></div>`;
  // Each count opens All documents at its own tab.
  const stats = ['214 Documents', '3 Members', '9 Categories']
    .map((l) => `<span class="stat-link"><u>${l}</u>${icon('chevron-right', 14, TEAL)}</span>`).join('<span class="div">|</span>');
  return `<section class="scr biz" id="scr-home">${sbFill}
    <div class="home-header">
      <div class="home-top"><div class="home-left"><div class="profile-btn" id="scr-home-avatar">K</div>
        <div><div class="greeting">Good morning</div><div class="header-title">${BIZ.owner}${plusStar}</div></div></div>
        <div class="bell-btn">${icon('bell', 20, '#fff')}</div></div>
      <div class="home-search">${icon('search', 18, 'rgba(255,255,255,0.8)')}<span class="ph">Search documents...</span>${icon('mic', 18, 'rgba(255,255,255,0.8)')}</div>
    </div>
    <div class="section"><div class="stats-bar">${stats}</div></div>
    <div class="section"><div class="section-head"><div class="section-title">Recent Documents</div><span class="see-all">See all</span></div>
      <div class="doc-list">
        ${doc('Tax Invoice AE-0142.pdf', 'file-text', 'Sales Invoices', 'Today')}
        ${doc('Shakti Switchgear SS-0889.pdf', 'file-text', 'Purchase Bills', 'Yesterday')}
        ${doc('Salary Register Sep 2026.pdf', 'file-text', 'Payroll', '3 days ago')}
        ${doc(BIZ.scanFile, 'image', 'Purchase Bills', '2 weeks ago')}
        ${doc('Shop Insurance 2025-26.pdf', 'file-text', 'Business Insurance', '2 weeks ago')}
      </div></div>
    ${tabBar('home', 'home', 'business')}
    <div class="drawer" id="drawer"><div class="drawer-dim"></div>${drawerPanel()}</div>
  </section>`;
}

// ─── Overview (src/app/overview.tsx, 056) ────────────────────────────────
// Read from the documents, by the server: renewals from expiry dates, bills
// from due dates, money from the totals of Sales Invoices and Purchase Bills.
// "Today" is Monday 19 October 2026.
export const MONEY = {
  months: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
  in: [320000, 280000, 360000, 410000, 390000, 221400],
  out: [260000, 310000, 290000, 330000, 350000, 186300],
};

export function overviewScreen() {
  const cardTitle = (ic, title) => `<div class="card-title"><span class="ct-ic biz">${icon(ic, 16, TEAL)}</span><span>${title}</span></div>`;
  const when = (tone, text) => {
    const c = { late: '#DC2626', soon: '#B45309', later: '#6B7280' }[tone];
    return `<span class="ov-when" style="color:${c}">${tone === 'later' ? '' : icon(tone === 'late' ? 'alert-circle' : 'clock', 12, c)}${text}</span>`;
  };
  const renewal = (name, sub, tone, text) => `<div class="ov-row"><div class="ov-main"><div class="ov-t">${name}</div><div class="ov-s">${sub}</div></div>${when(tone, text)}</div>`;
  const bill = (id, title, sub, tone, text) => `<div class="ov-row" id="${id}"><div class="ov-main"><div class="ov-t">${title}</div><div class="ov-s">${sub}</div></div>
    <div class="ov-side">${when(tone, text)}<div class="ov-paid" id="${id}-paid">Mark paid</div></div></div>`;
  const max = Math.max(...MONEY.in, ...MONEY.out);
  const h = (v) => Math.max(3, Math.round((v / max) * 132));
  const bars = MONEY.months.map((m, i) => `<div class="ov-slot"><div class="ov-bars">
      <i class="ov-bar in" style="height:${h(MONEY.in[i])}px"></i><i class="ov-bar out" style="height:${h(MONEY.out[i])}px"></i></div>
      <span class="ov-month${i === MONEY.months.length - 1 ? ' on' : ''}">${m}</span></div>`).join('');
  return `<section class="scr biz" id="scr-overview">${sbFill}
    ${header('Overview', { theme: 'business' })}
    <div class="ov-scroll"><div class="ov-inner" id="ov-inner">
      <div class="ov-intro">What ${BIZ.name}'s documents say.</div>
      <div class="ov-tiles">
        ${[['2', 'Renewals in 90 days'], ['0', 'Expired lately'], ['3', 'Bills with a due date', 'ov-tile-bills'], ['214', 'Invoices and bills']]
          .map(([v, l, id]) => `<div class="ov-tile"><div class="ov-v"${id ? ` id="${id}"` : ''}>${v}</div><div class="ov-l">${l}</div></div>`).join('')}
      </div>
      <div class="card" id="ov-renewals">${cardTitle('refresh-cw', 'Renewals')}
        <div class="ov-rows">
          ${renewal('Shop Insurance 2025-26.pdf', 'Business Insurance · 18 Nov 2026', 'soon', 'In 30 days')}
          ${renewal('Godown Leave &amp; Licence.pdf', 'Lease &amp; Property · 31 Dec 2026', 'later', 'In 73 days')}
        </div></div>
      <div class="card" id="ov-bills">${cardTitle('file-text', 'Bills due')}
        <div class="ov-group" id="ov-pay-title">To pay · <span id="ov-pay-total">₹1,54,580</span></div>
        <div class="ov-rows" id="ov-pay">
          ${bill('ov-b1', `${BIZ.billNo} · ${BIZ.scanFile}`, '₹1,18,000 · 25 Oct 2026', 'soon', 'Due in 6 days')}
          ${bill('ov-b2', 'SS-0889 · Shakti Switchgear SS-0889.pdf', '₹36,580 · 2 Nov 2026', 'later', 'Due in 14 days')}
        </div>
        <div class="ov-group">To collect · ₹47,200</div>
        <div class="ov-rows">
          ${bill('ov-b3', 'AE/2026-27/0142 · Tax Invoice AE-0142.pdf', '₹47,200 · 13 Nov 2026', 'later', 'Due in 25 days')}
        </div></div>
      <div class="card" id="ov-money">${cardTitle('bar-chart-2', 'Money in and out')}
        <div class="ov-legend"><span><i class="in"></i>In (sales)</span><span><i class="out"></i>Out (purchases)</span></div>
        <div class="ov-sel">Oct 2026: in ₹2,21,400, out ₹1,86,300</div>
        <div class="ov-chart"><div class="ov-axis">₹4.1L</div><div class="ov-grid"></div><div class="ov-plot">${bars}</div></div>
        <div class="ov-year">Since 1 Apr 2026: in ₹22,71,400, out ₹19,66,300</div>
      </div>
      <div class="muted" id="ov-note">Dates and amounts are read from your documents. Open one to check it.</div>
    </div></div>
  </section>`;
}

// ─── My notes (src/app/notes.tsx, 056) ───────────────────────────────────

export function notesScreen() {
  const note = (id, text, when, done = false) => `<div class="nt-note${done ? ' done' : ''}" id="${id}">
      <span class="nn-check"><span class="nn-off">${icon('circle', 20, '#6B7280')}</span><span class="nn-on">${icon('check-circle', 20, '#16A34A')}</span></span>
      <div class="nn-body"><div class="nn-t">${text}</div>${when ? `<div class="nn-when">${icon('bell', 12, '#1A7A72')}<span>${when}</span></div>` : ''}</div>
      ${icon('trash-2', 16, '#6B7280')}</div>`;
  return `<section class="scr biz" id="scr-notes">${sbFill}
    ${header('My notes', { theme: 'business' })}
    <div class="nn-list">
      <div class="nn-intro">Your own notes in ${BIZ.name}. Nobody else in the team can open them.</div>
      <div class="card nn-compose">
        <div class="nn-input">Write a note</div>
        <div class="nn-label">Remind me on</div>
        <div class="nn-chips"><span>Today</span><span>Tomorrow</span><span>Next week</span></div>
        <div class="nn-date">DD/MM/YYYY, or leave empty</div>
        <div class="nn-add">${icon('plus', 16, '#fff')}<span>Add note</span></div>
      </div>
      ${note('nn-1', `Call ${BIZ.supplier} about the credit note`, 'Today')}
      ${note('nn-2', 'Collect the cheque from Patil Builders', '13 Nov 2026')}
      ${note('nn-3', 'Ask Pooja about the TDS on godown rent', '')}
      <div class="nn-done">▸ Done (2)</div>
    </div>
  </section>`;
}

// ─── Manage team (src/app/family.tsx in Business mode) ───────────────────

export function teamScreen() {
  const member = (id, name, role, { me = false, admin = false } = {}) => `<div class="tm-card" id="${id}">
      <div class="tm-av${me ? ' me' : ''}">${name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</div>
      <div class="tm-info"><div class="tm-n"><span>${name}</span><span class="tm-star">★</span>${me ? '<span class="tm-pill you">You</span>' : ''}${admin ? '<span class="tm-pill admin">Admin</span>' : ''}</div>
        <div class="tm-r">${role}</div></div>
      ${me ? '' : `<span class="tm-act">${icon('shield', 16, '#2A3D66')}</span><span class="tm-act red">${icon('user-minus', 16, '#EF4444')}</span>`}</div>`;
  return `<section class="scr biz" id="scr-team">${sbFill}
    ${header(BIZ.name, { theme: 'business', sub: '3 of 10 members', right: `<div class="v4-hbtn biz" id="tm-add">${icon('user-plus', 16, '#fff')}<span>Add</span></div>` })}
    <div class="tm-body" id="tm-body">
      <div class="tm-banner" id="tm-banner">${icon('check-circle', 16, '#2A3D66')}<span>Invitation sent to ${BIZ.caEmail}. They show as Pending approval until they accept.</span></div>
      <div class="overline">Team</div>
      ${member('tm-me', BIZ.owner, 'Admin', { me: true, admin: true })}
      ${member('tm-ravi', 'Ravi, accounts', 'Viewer')}
      ${member('tm-sunil', 'Sunil, godown', 'Viewer')}
      <div class="tm-pending" id="tm-pending">
        <div class="overline">Pending approval</div>
        <div class="tm-card"><div class="tm-clock">${icon('clock', 16, '#B45309')}</div>
          <div class="tm-info"><div class="tm-n"><span>${BIZ.caEmail}</span></div><span class="tm-pill wait">Pending approval</span>
            <div class="tm-r">Invited 19 October 2026 by you</div></div>
          <span class="tm-x">${icon('x', 18, '#6B7280')}</span></div>
      </div>
      <div class="tm-only">You're its only admin. To leave, make someone else an admin first.</div>
    </div>
    <div class="sheet-dim" id="tm-dim"></div>
    <div class="sheet" id="tm-sheet">
      <i class="sheet-handle"></i>
      <div class="sheet-head"><span>Add to the team</span>${icon('x', 24, '#6B7280')}</div>
      <div class="sheet-text">Enter the email they use for AskLocker. They join as a viewer when they accept. Until then they show as Pending approval.</div>
      <div class="sheet-l">Email Address</div>
      <div class="sheet-field" id="tm-email"><span class="ph" id="tm-email-ph">The email they sign in with</span><span id="tm-email-typed"></span></div>
      <div class="sheet-l">Shown as (optional)</div>
      <div class="sheet-field" id="tm-shown"><span class="ph" id="tm-shown-ph">e.g. Ravi, accounts</span><span id="tm-shown-typed"></span></div>
      <div class="sheet-hint">Shown instead of their account name</div>
      <div class="sheet-btn" id="tm-send">Send invitation</div>
    </div>
  </section>`;
}

/** The next morning: an expiry reminder and a note's reminder, as web pushes. */
export function lockDayScreen() {
  return lockScreen('scr-lockday', '9:05', 'Monday, 19 October', `<div class="lstack">
      ${pushNotif('pn1', 'Shop Insurance 2025-26 expires in 30 days', 'Expires on 18 Nov 2026. A good time to renew it.')}
      ${pushNotif('pn2', `Call ${BIZ.supplier} about the credit note`, `Your note in ${BIZ.name}`)}</div>`);
}

export function phone() {
  return phoneShell(`
    ${uploadScreen()}
    ${cameraScreen(billPaper())}
    ${tagScreen()}
    ${askScreen()}
    ${homeScreen()}
    ${overviewScreen()}
    ${lockDayScreen()}
    ${notesScreen()}
    ${teamScreen()}`, '10:14');
}

// ─── Film layers ─────────────────────────────────────────────────────────

// The five parts of the product, in the order the chapters show them.
export const CHAPTERS = [
  ['ch-capture', 'Capture', 'upload', 'Scan or upload. AskLocker files it and reads it.'],
  ['ch-ask', 'Ask', 'message-circle', 'Plain questions, answered from your documents.'],
  ['ch-overview', 'Overview', 'bar-chart-2', 'Renewals, bills due, money in and out.'],
  ['ch-alerts', 'Reminders', 'bell', 'Alerts before a licence or policy lapses.'],
  ['ch-team', 'Team', 'users', 'Your team and your accountant, by invitation.'],
];
const num = (i) => String(i + 1).padStart(2, '0');

/** A full-screen statement: a small label, a heading, and what follows it. */
function block(id, eyebrow, heading, inner = '', note = '') {
  return `<div class="fm-block" id="${id}">
    <div class="fm-eyebrow">${eyebrow}</div>
    <div class="fm-h">${words(heading)}</div>
    ${inner}${note ? `<div class="fm-p">${note}</div>` : ''}
  </div>`;
}

/** A chapter beside the phone: its number and name, a heading, three points,
 * and the plan it needs where it needs one. In 9:16 a callout takes the place
 * of the points and the plan line (the engine hides .sub). */
function chapter(i, heading, points, plan = '') {
  const [id, name] = CHAPTERS[i];
  return `<div class="fm-chapter" id="${id}">
    <div class="fm-label"><span class="fm-num">${num(i)}</span><span>${name}</span></div>
    <div class="fm-h2">${words(heading)}</div>
    <div class="sub fm-bullets">${points.map((p) => `<div class="fm-b"><span class="fm-bi">${icon('check', 18, THEME.business.primary, 2.6)}</span><span>${p}</span></div>`).join('')}
      ${plan ? `<div class="fm-plan">${icon('star', 16, '#B7791F', 2.4)}<span>${plan}</span></div>` : ''}</div>
  </div>`;
}

// The next 90 days at Arora Electric, from "today", Monday 19 October 2026:
// the dates its own documents carry, the same ones Overview lists (bills to
// pay and to collect, renewals). Nothing here is a date AskLocker does not read.
const DUE = [
  ['25 Oct', 'In 6 days', 'Supplier bill due', 'Mehta Cables, ₹1,18,000', 'soon'],
  ['2 Nov', 'In 14 days', 'Supplier bill due', 'Shakti Switchgear, ₹36,580'],
  ['13 Nov', 'In 25 days', 'Payment to collect', 'Patil Builders, ₹47,200'],
  ['18 Nov', 'In 30 days', 'Policy expires', 'Shop insurance', 'soon'],
  ['31 Dec', 'In 73 days', 'Lease ends', 'Godown leave and licence'],
];

function timeline() {
  return `<div class="fm-tl"><i class="fm-line" id="fm-line"></i>
    ${DUE.map(([date, when, what, detail, tone], i) => `<div class="fm-node" id="node-${i + 1}"><i class="fm-dot"></i>
      <div class="fm-nd"><b>${date}</b><span class="fm-when${tone ? ` ${tone}` : ''}">${when}</span></div>
      <div class="fm-nw">${what}</div><div class="fm-nx">${detail}</div></div>`).join('')}
  </div>`;
}

export function textBlocks(short) {
  const docs = [['file-text', 'Sales Invoices'], ['clipboard', 'Purchase Bills'], ['percent', 'GST Returns'],
    ['award', 'Licences & Registrations'], ['pen-tool', 'Contracts & Agreements'], ['umbrella', 'Business Insurance'],
    ['credit-card', 'Bank & Loans'], ['users', 'Payroll']];
  const shown = short ? CHAPTERS.slice(0, 3) : CHAPTERS;
  const tick = (on) => (on ? icon('check', 22, THEME.business.primary, 2.6) : icon('minus', 22, '#B8C4C2', 2.4));
  const row = (label, cells, cls = '') => `<tr class="${cls}"><td>${label}</td>${cells.map((c) => `<td>${typeof c === 'boolean' ? tick(c) : c}</td>`).join('')}</tr>`;
  return `
  ${brand('brand', 'The document vault for small businesses.', { badge: 'for Business' })}
  ${block('f-docs', 'The challenge', 'A business runs on documents.',
    `<div class="fm-grid">${docs.map(([ic, n]) => `<div class="fm-tile"><span class="fm-ti">${icon(ic, 22, THEME.business.primary)}</span><span>${n}</span></div>`).join('')}</div>`,
    'They arrive by email, on chat apps and on paper, and stay wherever they land.')}
  ${block('f-dates', 'The next 90 days', 'Each one carries a date that matters.', timeline(),
    'Five dates in five documents. Missing one means late fees, a lapsed policy or an unpaid invoice.')}
  ${block('f-pillars', 'AskLocker for Business', 'One place for every business document.',
    `<div class="fm-pillars">${CHAPTERS.map(([id, name, ic, line], i) => `<div class="fm-pillar" id="pl-${i + 1}">
      <div class="fm-pn">${num(i)}</div><div class="fm-pi">${icon(ic, 24, THEME.business.primary)}</div>
      <div class="fm-pt">${name}</div><div class="fm-pd">${line}</div></div>`).join('')}</div>`)}
  <div class="fm-chapters" id="fm-chapters">${shown.map(([id, name], i) => `<span id="cb-${i}"><b>${num(i)}</b>${name}</span>`).join('')}<i class="fm-ind" id="fm-ind"></i></div>
  ${chapter(0, 'Scan or upload. AskLocker files it.', [
    'Category suggested from the text',
    'Reads the GSTIN, dates and total',
    'PDF, photos or Excel, up to 10 MB',
  ])}
  ${chapter(1, 'Ask anything. Get the answer and its source.', [
    'Plain words, no folders to search',
    'Answers come from your documents',
    'Ask by voice in Hindi and 9 more languages',
  ])}
  ${chapter(2, 'See what is due, at a glance.', [
    'Renewals in the next 90 days',
    'Bills to pay and to collect',
    'Money in and out, month by month',
  ], 'Renewals and bills due from Plus. Money in and out from Pro.')}
  ${chapter(3, 'Reminders before anything lapses.', [
    '90, 30 and 7 days before expiry',
    'Sent to everyone in the business',
    'Your own notes, with a reminder',
  ], 'Expiry and note reminders from Plus.')}
  ${chapter(4, 'Your team and your CA, by invitation.', [
    'People join only when they accept',
    'Admin and viewer roles',
    'Records stay when people leave',
  ])}
  ${block('f-trust', 'Access and control', 'In AskLocker, only your team can open your records.',
    `<div class="fm-cards">${[
      ['lock', 'Access by invitation', 'Nobody joins unless an admin asks and they accept.'],
      ['shield', 'Admins in charge', 'Admins manage the team and can remove any record. A business always keeps one.'],
      ['archive', 'Records that stay', 'When someone leaves, what they added stays with the business.'],
      ['link', 'Sharing with limits', 'Share one document by link for 1 or 7 days, or 30 on a paid plan. Turn it off any time.'],
    ].map(([ic, t, b], i) => `<div class="fm-card" id="fc-${i + 1}"><div class="fm-ci">${icon(ic, 26, THEME.business.primary)}</div><b>${t}</b><span>${b}</span></div>`).join('')}</div>`,
    'To answer questions, AskLocker sends passages of your documents to outside AI services. Settings › Privacy names them.')}
  ${block('f-plans', 'Plans', 'Start free. Move up as you grow.',
    `<table class="fm-table" id="fm-table"><thead><tr><th></th><th>Free</th><th>Plus</th><th>Pro</th><th>Enterprise</th></tr></thead><tbody>
      ${row('Price a month', ['Free', '₹499', '₹999', '₹3,999'], 'price')}
      ${row('People', ['2', '5', '10', '50'])}
      ${row('Space', ['100 MB a person', '20 GB', '50 GB', '200 GB'])}
      ${row('Questions a month', ['20 a person', '1,000 shared', '2,000 shared', '8,000 shared'])}
      ${row('Expiry reminders', [false, true, true, true])}
      ${row('Renewals and bills due', [false, true, true, true])}
      ${row('Money in and out', [false, false, true, true])}
    </tbody></table>`,
    'Prices before GST. A year costs about ten months. Paid plans are set up on request.')}
  ${brand('endcard', BIZ.tagline, { badge: 'for Business', cta: BIZ.cta, ctaNote: BIZ.ctaNote, url: BIZ.url, end: true })}`;
}

export function callouts() {
  const T = THEME.business.primary;
  const check = (t) => `<div class="co-check">${icon('check', 16, T, 2.6)}<span>${t}</span></div>`;
  return `
  <div class="callout" id="co-bill" style="width:390px">
    <div class="co-label">${icon('file-text', 14, T, 2.6)}<span>Read from the bill</span></div>
    <div class="co-row"><span class="co-k">Supplier GSTIN</span><span class="co-v">${BIZ.supplierGstin}</span></div>
    <div class="co-row"><span class="co-k">Bill no.</span><span class="co-v">${BIZ.billNo}</span></div>
    <div class="co-row"><span class="co-k">Total</span><span class="co-v">₹1,18,000.00</span></div>
    <div class="co-row"><span class="co-k">Due date</span><span class="co-v">25 Oct 2026</span></div>
    <div class="co-foot">${icon('check', 14, '#16A34A', 2.6)}<span>Filed under Purchase Bills</span></div>
  </div>
  <div class="callout" id="co-overview" style="width:390px">
    <div class="co-label">${icon('bar-chart-2', 14, T, 2.6)}<span>Read from your documents</span></div>
    ${check('Renewals, from expiry dates')}
    ${check('Bills due, from due dates')}
    ${check('Money in and out, from invoice totals')}
    <div class="co-quiet">Nothing to type in. Open a document to check it.</div>
  </div>
  <div class="callout" id="co-alerts" style="width:400px">
    <div class="co-label">${icon('bell', 14, T, 2.6)}<span>Before it expires</span></div>
    <div class="co-steps"><i class="track"></i>
      ${[['90', 'days'], ['30', 'days'], ['7', 'days'], ['On the', 'day']].map(([a, b]) => `<div class="co-step"><i class="dot"></i><b>${a}</b><span>${b}</span></div>`).join('')}</div>
    <div class="co-foot">${icon('edit-3', 14, '#16A34A', 2.6)}<span>Notes remind you on the day you pick</span></div>
  </div>`;
}
