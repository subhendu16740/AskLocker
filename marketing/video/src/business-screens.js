// HTML for the business film. The phone screens are ports of the real screens
// in Business mode (src/app/** with src/lib/vault-theme.ts's teal), filled with
// a fictional business: Arora Electric, an electrical-supplies distributor in
// Pune, on the Pro plan. Its owner Kavita is the only admin; her CA, Pooja,
// joins as a viewer. Every name, number and GSTIN here is made up; the GSTINs
// carry valid check characters so the app's extractor would read them.
import {
  icon, spinner, sbFill, plusTag, plusStar, header, tabBar, avatar, words, categoryChips, ocrSlot, uploadedDialog,
  lockScreen, lockNotif, pushNotif, callScreen, cameraScreen, phoneShell, askMessages, askHeader, searchIn, saveBar,
  askInput, whyHow, trustBlock, brand, THEME,
} from './parts.js';

const TEAL = THEME.business.primary;

// ─── Story data (edit here to re-cast the film) ──────────────────────────
export const BIZ = {
  name: 'Arora Electric',
  owner: 'Kavita Arora',
  email: 'kavita@example.com',
  gstin: '27BQKPA4821M1ZP',
  family: 'Arora Family',
  ca: 'Pooja Joshi',
  caShown: 'Pooja, our CA',
  caEmail: 'pooja@example.com',
  supplier: 'Mehta Cables',
  supplierGstin: '24AAJFM7350R1ZN',
  billNo: 'MC-7781',
  // A camera scan is saved as scan_<Date.now()>.jpg (upload.tsx): this one was
  // taken at 10:14 on Saturday 3 October 2026.
  scanFile: 'scan_1791002692000.jpg',
  cta: 'Start your business vault',
  ctaNote: 'Free to start · Plans from ₹500 a month + GST',
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

function uploadScreen() {
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

function tagScreen() {
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

function askScreen() {
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

// The CA's phone, the same evening. She is in her clients' businesses too, so
// she asks in one of them, and each source says which.
function caAskScreen() {
  const bills = [['MC-7702', 'Mehta Cables', '₹84,960'], ['SS-0861', 'Shakti Switchgear', '₹36,580'],
    ['KL-551', 'Kiran Lighting', '₹22,420'], ['SC-1093', 'Sai Conduits', '₹15,340']];
  const sources = bills.map(([no, who]) => `<div class="src-chip">${icon('file-text', 12, '#2A3D66')}<span>${who} ${no}.pdf</span><span class="src-vault">· ${BIZ.name}</span></div>`).join('');
  return `<section class="scr biz" id="scr-ca">${sbFill}
    ${askHeader('ca', 'business')}
    ${searchIn(BIZ.name)}
    <div class="ask-area" id="ca-area"><div class="chat-stack" id="ca-stack">
      <div class="msg user" id="ca-q1"><div class="bubble">Show me September's purchase bills</div></div>
      <div class="msg ai" id="ca-a1"><div class="ai-avatar">${icon('cpu', 14, '#2A3D66')}</div>
        <div class="bubble"><div>I found 4 purchase bills from September 2026:</div>
          <ul class="ans-list">${bills.map(([no, who, amt]) => `<li>${who}, ${no}: <b>${amt}</b></li>`).join('')}</ul>
          <div class="sources">${sources}</div></div></div>
    </div></div>
    <div class="ask-bottom">${saveBar('ca')}${askInput('ca')}</div>
    ${tabBar('search', 'ca', 'business')}
  </section>`;
}

// ─── Home and the drawer, in both modes ──────────────────────────────────

function drawerPanel(mode) {
  const biz = mode === 'business';
  const c = THEME[mode].primary;
  const items = biz
    ? [['home', 'Home'], ['bar-chart-2', 'Overview', '', 'dr-overview'], ['edit-3', 'My notes'], ['briefcase', 'Manage team', '', 'dr-team'], ['clock', 'Reminders', 'Plus'], ['settings', 'Settings']]
    : [['home', 'Home'], ['git-branch', 'Family tree'], ['plus-square', 'Emergency cards'], ['users', 'Manage Family'], ['clock', 'Reminders', 'Family Plus'], ['settings', 'Settings']];
  const modeBtn = (m, ic, label) => {
    const on = m === mode;
    const tone = THEME[m].primary;
    return `<div class="dr-mode${on ? ' on' : ''}" id="${mode}-mode-${m}" style="${on ? `background:${tone};border-color:${tone}` : ''}">${icon(ic, 16, on ? '#fff' : tone)}<span style="color:${on ? '#fff' : tone}">${label}</span></div>`;
  };
  return `<div class="drawer-panel${biz ? ' biz' : ''}">
    <div class="dr-head">
      <div class="dr-top"><div class="dr-av">K</div><span class="dr-x">${icon('x', 24, '#fff')}</span></div>
      <div class="dr-name">${BIZ.owner}${plusStar}</div><div class="dr-line">${BIZ.email}</div><div class="dr-line">${biz ? BIZ.name : BIZ.family} · Admin</div>
    </div>
    <div class="dr-switch">${modeBtn('family', 'users', 'Family')}${modeBtn('business', 'briefcase', 'Business')}</div>
    <div class="dr-menu">
      ${items.map(([ic, label, plus, id]) => `<div class="dr-row"${id ? ` id="${id}"` : ''}><span class="dr-ic">${icon(ic, 16, c)}</span><span class="dr-l">${label}</span>
        ${plus ? plusTag(plus) : icon('chevron-right', 16, '#9CA3AF')}</div>`).join('')}
    </div>
    <div class="dr-foot"><div class="dr-out">${icon('log-out', 16, '#DC2626')}<span>Sign Out</span></div><div class="dr-ver">AskLocker 1.0.0</div></div>
  </div>`;
}

function homeScreen(mode) {
  const biz = mode === 'business';
  const id = biz ? 'scr-home' : 'scr-fhome';
  // Business categories are grey on Home; a family's take home.tsx's colours.
  const doc = (name, ic, cat, color, vaultIcon, vault, line) => `<div class="doc-card">
      <div class="doc-icon ${biz ? 'grad-biz' : 'grad'}">${icon(ic, 18, '#fff')}</div>
      <div class="doc-info"><div class="doc-title">${name}</div>
        <div class="doc-meta"><span class="cat-badge" style="background:${color}">${cat}</span>
          <span class="vault-tag${biz ? ' biz' : ''}">${icon(vaultIcon, 12, biz ? TEAL : '#2A3D66')}<span>${vault}</span></span>
          <span>${line}</span></div></div></div>`;
  const docs = biz ? `
      ${doc('Tax Invoice AE-0142.pdf', 'file-text', 'Sales Invoices', '#6B7280', 'briefcase', BIZ.name, 'Today')}
      ${doc('Shakti Switchgear SS-0889.pdf', 'file-text', 'Purchase Bills', '#6B7280', 'briefcase', BIZ.name, 'Yesterday')}
      ${doc('Salary Register Sep 2026.pdf', 'file-text', 'Payroll', '#6B7280', 'briefcase', BIZ.name, '3 days ago')}
      ${doc(BIZ.scanFile, 'image', 'Purchase Bills', '#6B7280', 'briefcase', BIZ.name, '2 weeks ago')}
      ${doc('Shop Insurance 2025-26.pdf', 'file-text', 'Business Insurance', '#6B7280', 'briefcase', BIZ.name, '2 weeks ago')}` : `
      ${doc('Raj_Passport.pdf', 'file-text', 'Passport', '#3B82F6', 'users', BIZ.family, 'Husband · Raj Arora · Today')}
      ${doc('Health Policy 2026.pdf', 'file-text', 'Health Insurance', '#22C55E', 'users', BIZ.family, 'Kavita Arora · Yesterday')}
      ${doc('Ishaan_School_Fees.pdf', 'file-text', 'Educational Certificates', '#6B7280', 'users', BIZ.family, 'Son · Ishaan Arora · 4 days ago')}
      ${doc('PAN_Card_Kavita.pdf', 'file-text', 'PAN Card', '#6B7280', 'lock', 'Personal vault', 'Kavita Arora · 1 week ago')}`;
  const stats = biz
    ? `<span class="stat-link"><u>214 Documents</u>${icon('chevron-right', 14, TEAL)}</span><span class="div">|</span><span>3 Members</span><span class="div">|</span><span>9 Categories</span>`
    : `<span class="stat-link"><u>41 Documents</u>${icon('chevron-right', 14, '#2A3D66')}</span><span class="div">|</span><span>2 Vaults</span>`;
  return `<section class="scr${biz ? ' biz' : ''}" id="${id}">${sbFill}
    <div class="home-header">
      <div class="home-top"><div class="home-left"><div class="profile-btn" id="${id}-avatar">K</div>
        <div><div class="greeting">Good morning</div><div class="header-title">${BIZ.owner}${plusStar}</div></div></div>
        <div class="bell-btn">${icon('bell', 20, '#fff')}</div></div>
      <div class="home-search">${icon('search', 18, 'rgba(255,255,255,0.8)')}<span class="ph">Search documents...</span>${icon('mic', 18, 'rgba(255,255,255,0.8)')}</div>
    </div>
    <div class="section"><div class="stats-bar">${stats}</div></div>
    <div class="section"><div class="section-head"><div class="section-title">Recent Documents</div><span class="see-all">See all</span></div>
      <div class="doc-list">${docs}</div></div>
    ${tabBar('home', biz ? 'home' : 'fhome', mode)}
    <div class="drawer" id="${biz ? 'drawer' : 'fdrawer'}"><div class="drawer-dim"></div>${drawerPanel(mode)}</div>
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

function overviewScreen() {
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

function notesScreen() {
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

function teamScreen() {
  const member = (id, name, role, { me = false, admin = false } = {}) => `<div class="tm-card" id="${id}">
      <div class="tm-av${me ? ' me' : ''}">${name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</div>
      <div class="tm-info"><div class="tm-n"><span>${name}</span><span class="tm-star">★</span>${me ? '<span class="tm-pill you">You</span>' : ''}${admin ? '<span class="tm-pill admin">Admin</span>' : ''}</div>
        <div class="tm-r">${role}</div></div>
      ${me ? '' : `<span class="tm-act">${icon('shield', 16, '#2A3D66')}</span><span class="tm-act red">${icon('user-minus', 16, '#EF4444')}</span>`}</div>`;
  return `<section class="scr biz" id="scr-team">${sbFill}
    ${header(BIZ.name, { theme: 'business', sub: '3 of 15 members', right: `<div class="v4-hbtn biz" id="tm-add">${icon('user-plus', 16, '#fff')}<span>Add</span></div>` })}
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

export function phone() {
  return phoneShell(`
    ${lockScreen('scr-lock', '8:40', 'Sunday, 18 October', lockNotif('ln1', `${BIZ.ca} (CA)`, [
      'Kavita ji, September ke saare purchase bills bhej dijiye 🙏',
      '20 tareekh ko 3B file karna hai. Kal subah tak chahiye.',
    ]))}
    ${callScreen({ label: 'Calling…', name: 'Ravi (Accounts)', sub: 'Mobile', outgoing: true, missed: 'No answer' })}
    ${uploadScreen()}
    ${cameraScreen(billPaper())}
    ${tagScreen()}
    ${askScreen()}
    ${homeScreen('business')}
    ${homeScreen('family')}
    ${overviewScreen()}
    ${lockScreen('scr-lockday', '9:05', 'Monday, 19 October', `<div class="lstack">
      ${pushNotif('pn1', 'Shop Insurance 2025-26 expires in 30 days', 'Expires on 18 Nov 2026. A good time to renew it.')}
      ${pushNotif('pn2', `Call ${BIZ.supplier} about the credit note`, `Your note in ${BIZ.name}`)}</div>`)}
    ${notesScreen()}
    ${teamScreen()}
    ${caAskScreen()}
    ${lockScreen('scr-lock2', '8:46', 'Sunday, 18 October', lockNotif('ln2', `${BIZ.ca} (CA)`, ['September ke bills mil gaye, AskLocker mein 👍 Kal file kar dungi.']))}`, '8:40');
}

// ─── Film layers ─────────────────────────────────────────────────────────

export function scrambleCards() {
  const row = (who, what, when) => `<div class="sc-row"><span><b>${who}</b> · ${what}</span><span>${when}</span></div>`;
  return `
  <div class="sc" id="sc-chat" style="width:460px">
    <div class="sc-top">${icon('message-circle', 18, '#6B7280')}<b>Chats</b></div>
    <div class="sc-search">${icon('search', 18, '#6B7280')}<span class="sc-q" id="sc-q"></span><span class="caret" id="sc-caret"></span></div>
    <div class="sc-count" id="sc-count">318 messages</div>
    ${row(BIZ.supplier, '📄 MC-7781.pdf', '2 Oct')}
    ${row('Shakti Switchgear', '📷 Photo', '29 Sep')}
    ${row('Ravi (Accounts)', 'sept bills FINAL.zip', '1 Oct')}
  </div>
  <div class="sc" id="sc-mail" style="width:450px">
    <div class="sc-top">${icon('inbox', 18, '#6B7280')}<b>${BIZ.email}</b></div>
    <div class="sc-search">${icon('search', 18, '#6B7280')}<span>invoice september</span></div>
    <div class="sc-count" style="opacity:1">1,206 results</div>
    ${row('Tax Invoice SS-0861', 'Please find attached…', 'Sep 2026')}
    ${row('Re: Re: Fwd: bill', 'sending again, last one…', 'Sep 2026')}
  </div>
  <div class="sc sc-note" id="sc-note" style="width:340px"><i class="tape"></i>
    Sept bills:<br><u>blue file</u>, counter,<br>bottom drawer (ask Ravi)
  </div>
  <div class="sc" id="sc-photos" style="width:400px">
    <div class="sc-top">${icon('image', 18, '#6B7280')}<b>Photos</b><span class="sc-dim">2,931 items</span></div>
    <div class="sc-grid">${Array.from({ length: 12 }, (_, i) => `<i class="ph${i % 3}"></i>`).join('')}</div>
  </div>
  <div class="sc" id="sc-pc" style="width:430px">
    <div class="sc-top">${icon('monitor', 18, '#6B7280')}<b>\\\\RAVI-PC\\Accounts\\2026</b></div>
    <div class="sc-alert">${icon('alert-triangle', 22, '#B91C1C')}<div><b>Ravi-PC is not reachable.</b><br>Check that the computer is on and connected to the network.</div></div>
  </div>`;
}

export function textBlocks() {
  return `
  <div class="tblock on-dark" id="t-hook">
    <div class="clock-big"><span class="t">8:40</span><span class="ampm">PM</span></div>
    <div class="where">Kavita runs <b>${BIZ.name}</b> in Pune.<br>The GST return is due on the <b>20th</b>.</div>
  </div>
  <div class="time-chip" id="time-chip">${icon('clock', 24, '#D4807B', 2.4)}<span id="chip-time">8:42 PM</span></div>
  <div class="cap-top" id="caps">
    <div class="cap-line" id="cap1">${words('Some came in chats…')}</div>
    <div class="cap-line" id="cap2">${words('…some by email…')}</div>
    <div class="cap-line" id="cap3">${words('…some on paper, somewhere in the shop.')}</div>
    <div class="cap-line" id="cap4">${words('…some are photos, among 2,931.')}</div>
    <div class="cap-line" id="cap5">${words("The rest are on Ravi's computer.")}</div>
  </div>
  <div class="center-block on-dark" id="t-insight">
    <div class="big" id="ins-1">${words('The bills are somewhere.')}</div>
    <div class="big-em" id="ins-2">${words("The deadline isn't.")}</div>
  </div>
  <div class="q-block on-dark" id="t-question"><div class="big">${words('Now imagine Ravi leaves for good.')}</div></div>
  ${brand('brand', 'Every bill, licence and contract. One question away.', { badge: 'for Business' })}
  ${whyHow('t-scan', 'Scan and file', 'camera', 'Bills turn up everywhere.|*Nobody files them.*',
    'Snap it. AskLocker files it.', 'It picks the category and reads the GSTIN, bill number, total and due date.')}
  ${whyHow('t-ask', 'Ask', 'message-circle', 'Your CA asks for one bill.|*You scroll for an hour.*',
    "Ask, the way you'd ask your accountant.", 'The answer comes from your own papers, with the bill attached.')}
  ${whyHow('t-overview', 'Overview', 'bar-chart-2', 'Renewal dates and payments hide *inside the papers.*',
    'Overview reads them out for you.', "What's up for renewal, what's due to pay and to collect. Mark a bill paid when it's done.", { plus: '★ Plus · Money in and out ★ Pro' })}
  ${whyHow('t-alerts', 'Reminders', 'bell', 'A policy or licence lapses quietly.|You find out *when someone asks for~it.*',
    'The whole team is reminded in time.', '90, 30 and 7 days before a licence, policy or lease runs out. Your own notes can remind you too.', { plus: '★ Plus' })}
  ${whyHow('t-team', 'Team', 'users', 'When the accountant leaves,|*the files leave with him.*',
    'Invite your team. The records stay.', 'People join only when they say yes. Everyone sees the same records, and a business always keeps an admin.')}
  ${whyHow('t-apart', 'Family and Business', 'briefcase', "Shop papers and family papers *don't belong in one pile.*",
    'One switch. Two vaults, kept apart.', "Business records never mix with your family's documents. Each has its own people.")}
  ${trustBlock('GST bills, bank papers, contracts: *your whole business,* on paper.', 'In AskLocker, only your team can open them.', [
    ['lock', 'Invite-only', 'Nobody joins unless an admin asks and they say yes.'],
    ['archive', 'Records stay', 'When someone leaves, the records stay with the business.'],
    ['link', 'Links that expire', 'Share one document for 1 or 7 days, or 30 on a paid plan. Turn it off any time.'],
    ['shield', 'An admin in charge', 'Admins can delete any record. A business always keeps an admin.'],
  ], 'Search sends passages of your documents to outside AI services. Settings › Privacy names them.')}
  <div class="tblock on-dark res-block" id="t-res">
    <div class="kicker">${icon('check-circle', 22, 'currentColor', 2.4)}<span>The same evening, with AskLocker</span></div>
    <div class="clock-big"><span class="t" id="res-time">8:40</span><span class="ampm">PM</span></div>
    <div class="res-lines"><div class="h1" id="res-h1a">${words("Pooja's on the team.")}</div>
      <div class="h1" id="res-h1b">${words('Sorted before dinner.')}</div></div>
    <div class="sub" id="res-sub">No chat hunt. No calls to Ravi. No digging through email.</div>
  </div>
  ${brand('endcard', 'Every bill, licence and contract. One question away.', { badge: 'for Business', cta: BIZ.cta, ctaNote: BIZ.ctaNote, end: true })}`;
}

export function callouts() {
  const check = (t) => `<div class="co-check">${icon('check', 16, '#16A34A', 2.6)}<span>${t}</span></div>`;
  return `
  <div class="callout" id="co-bill" style="width:390px">
    <div class="co-label">${icon('zap', 14, '#D4807B', 2.6)}<span>Read off the bill</span></div>
    <div class="co-row"><span class="co-k">GSTIN</span><span class="co-v">${BIZ.supplierGstin}</span></div>
    <div class="co-row"><span class="co-k">Bill no.</span><span class="co-v">${BIZ.billNo}</span></div>
    <div class="co-row"><span class="co-k">Total</span><span class="co-v">₹1,18,000.00</span></div>
    <div class="co-row"><span class="co-k">Due date</span><span class="co-v">25 Oct 2026</span></div>
    <div class="co-foot">${icon('file-text', 14, '#16A34A', 2.6)}<span>Added to Bills due</span></div>
  </div>
  <div class="callout" id="co-overview" style="width:390px">
    <div class="co-label">${icon('bar-chart-2', 14, '#D4807B', 2.6)}<span>Nothing to type in</span></div>
    ${check('Renewals, from expiry dates')}
    ${check('Bills due, from due dates')}
    ${check('Money in and out, from invoice totals')}
    <div class="co-quiet">Read from your documents. Open one to check it.</div>
  </div>
  <div class="callout" id="co-alerts" style="width:400px">
    <div class="co-label">${icon('bell', 14, '#D4807B', 2.6)}<span>Before it expires</span></div>
    <div class="co-steps"><i class="track"></i>
      ${[['90', 'days'], ['30', 'days'], ['7', 'days'], ['On the', 'day']].map(([a, b]) => `<div class="co-step"><i class="dot"></i><b>${a}</b><span>${b}</span></div>`).join('')}</div>
    <div class="co-foot">${icon('edit-3', 14, '#16A34A', 2.6)}<span>Notes remind you on the day you pick</span></div>
  </div>`;
}

export function subtitles() {
  return `
    <div class="subline" id="sub-1">Kavita ji, please send me all of September's purchase bills.</div>
    <div class="subline" id="sub-2">GSTR-3B is due on the 20th. I need them by tomorrow morning.</div>
    <div class="subline" id="sub-5">“Got September's bills in AskLocker. I'll file tomorrow.”</div>`;
}
