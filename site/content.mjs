// The words on asklocker.com's landing page, as data: the page, its FAQ
// structured data and the Markdown for AI assistants (llms-full.txt) all
// come from here, so they agree.
//
// Two modes, as the app has them (the drawer's Family | Business switch):
// the top of the page is a carousel of the two, and the sections below
// follow it. Both are in the HTML, so search engines and AI assistants read
// both; the page shows one at a time.
//
// The app's rules hold (CLAUDE.md, Conventions):
//  - Short and plain, as the app's screens are: a title and one line.
//    Where the app already says it, the page uses the app's own words (the
//    onboarding slides, Settings › Privacy, the Plans page's rows, the films).
//  - Never promise more privacy than AskLocker gives: no "secure", "safe",
//    "private and isolated", "100% private", "only you can see it" or
//    "nothing is kept"; "end-to-end" only as "not end-to-end". The QA
//    self-test checks the built page.
//  - Numbers come from the constants (lib/facts.mjs), never typed in.
//  - Claim only what the app does, on the plan that does it.

import { SUPPORT_EMAIL, businessColumns, businessPlans, dollars, facts, familyPlans, listOf, rupees } from './lib/facts.mjs';

const voiceNames = facts.voiceLanguages.map((l) => l.english);
const p = facts.plus;
const pro = facts.pro;
const askUs = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('A business plan for AskLocker')}`;

export const meta = {
  title: 'AskLocker: a family document vault you can ask',
  description: `Keep passports, policies, bills and certificates in one family vault, and ask about them in plain words, or by voice in ${voiceNames.length} languages. Free to start.`,
};

/** What AskLocker is, in one place: FAQ, structured data, llms.txt. */
export const about = 'AskLocker is a document vault for families and small businesses. Add documents by photo, PDF or spreadsheet, then ask about them in plain words or by voice. Each answer shows the document it came from.';


export const modes = {
  family: {
    key: 'family',
    label: 'For families',
    hero: {
      title: 'Every family document, one question away.',
      lead: "Your family's documents, in one place. Just ask.",
      note: 'Free to start. Works on any phone or computer.',
    },
    // The onboarding's slides (src/app/onboarding.tsx), and what Home offers next.
    steps: [
      { icon: 'camera', title: 'Snap or upload', text: 'AskLocker reads every page for you.' },
      { icon: 'message-circle', title: 'Just ask', text: '“When does Dad\'s passport expire?”' },
      { icon: 'bell', title: 'Get reminded', text: 'Before a passport or policy runs out.' },
    ],
    featuresLabel: 'For the whole family',
    features: [
      { icon: 'users', title: 'Ask by relation', text: '“Nani\'s pension” just works.' },
      { icon: 'mic', title: 'Ask by voice', text: `In English, Hindi and ${voiceNames.length - 2} more.` },
      { icon: 'heart', title: 'Emergency cards', text: 'Blood group, allergies, who to call.' },
      { icon: 'link', title: 'Share one document', text: 'A link for your CA or agent.' },
      { icon: 'lock', title: 'A vault of your own', text: 'Yours alone, or shared with family.' },
      { icon: 'aperture', title: 'Fingerprint sign-in', text: 'After Google, just once.' },
    ],
    // The Plans page's rows (src/app/plus.tsx), the ones that tell plans apart.
    plans: {
      columns: familyPlans.map((c) => ({ name: c.name, price: c.price.inr, yearly: c.yearly?.inr ?? null, highlight: c.id === 'plus', cells: c })),
      rows: [
        { label: 'People', cell: (c) => String(c.people) },
        { label: 'Space', cell: (c) => c.space },
        { label: 'Questions a month', cell: (c) => c.questions },
        { label: 'Expiry reminders', cell: (c) => c.expiry },
        { label: 'Share a document', cell: (c) => `${c.shareDays} days` },
        { label: 'Indian languages', cell: (c) => c.languages },
      ],
      note: `Outside India, Family Plus is ${dollars(p.monthly.usd)} and Family Pro ${dollars(pro.monthly.usd)} a month.`,
    },
    other: { icon: 'briefcase', title: 'Running a business?', text: 'Bills, invoices and licences, for your team.', to: 'business', label: 'See business' },
  },
  business: {
    key: 'business',
    label: 'For business',
    hero: {
      // The business film's tagline (marketing/video/src/business-screens.js).
      title: 'Every bill, licence and contract, one question away.',
      lead: "Your business's papers, in one place. Just ask.",
      note: `Free to start. Plans from ${rupees(businessPlans[0].price)} a month + GST.`,
    },
    steps: [
      { icon: 'camera', title: 'Snap or upload', text: 'Bills, invoices and licences, read for you.' },
      { icon: 'message-circle', title: 'Just ask', text: '“When is the Mehta Cables bill due?”' },
      { icon: 'refresh-cw', title: 'See what\'s due', text: 'Renewals and bills, at a glance.' },
    ],
    featuresLabel: 'For your team',
    features: [
      { icon: 'refresh-cw', title: 'Renewals and bills due', text: 'In one overview, from Plus.' },
      { icon: 'bar-chart-2', title: 'Money in and out', text: 'Month by month, from Pro.' },
      { icon: 'bell', title: 'Reminders', text: 'Before a licence or policy lapses.' },
      { icon: 'users', title: 'Your team and your CA', text: 'Each with their own login.' },
      { icon: 'file-text', title: 'Reads your bills', text: 'GSTIN, bill number, total, due date.' },
      { icon: 'edit-3', title: 'Notes', text: 'Your own, with a reminder.' },
    ],
    // The business Plans page's rows (src/app/plus.tsx, businessRows()).
    plans: {
      columns: businessColumns.map((c) => ({ name: c.name, price: c.price, yearly: c.yearly, highlight: c.id === 'business_plus', cells: c })),
      rows: [
        { label: 'People', cell: (c) => String(c.people) },
        { label: 'Space', cell: (c) => c.space },
        { label: 'Questions a month', cell: (c) => c.questions },
        { label: 'Renewals and bills due', cell: (c) => c.overview },
        { label: 'Money in and out', cell: (c) => c.money },
        { label: 'Reminders and 30-day links', cell: (c) => c.reminders },
        { label: 'Indian languages', cell: (c) => c.languages },
      ],
      note: 'Prices + GST. Paid plans are set up on request.',
      cta: { label: 'Ask us', href: askUs },
    },
    other: { icon: 'users', title: 'For your family?', text: 'Passports, policies and certificates, in one place.', to: 'family', label: 'See family' },
  },
};

// Settings › Privacy (src/app/settings/privacy.tsx), word for word.
export const privacy = [
  { icon: 'users', title: 'Who can see your documents', text: 'People in your vault, and anyone you send a share link.' },
  { icon: 'lock', title: 'Encrypted, not end-to-end', text: 'Our servers read them to search, and our team can open them.' },
  { icon: 'message-circle', title: 'AI answers', text: 'Parts of your documents go to AI services to answer you. Never your whole vault.' },
];

// The privacy policy, asklocker.com/privacy (pages/privacy.mjs). Settings ›
// Privacy links to it, and the Play Store, Razorpay and Google's brand check
// read it. Every line has to stay true of the code and of the people who run
// AskLocker (CLAUDE.md: never promise more privacy than AskLocker gives).
// Change it, and `updated`, with any change to sharing, search, OCR,
// embeddings, voice, Gmail import, payments or usage counts. The QA self-test
// checks it names each service that gets document text and makes none of the
// forbidden claims. The usage analytics service is described, not named (the
// owner's ask, 25 October 2026). Short, as the app's screens are: a title and
// one line a row (4 November 2026, when it was cut to the landing page's look).
// Each section's `summary` is what the landing page's Privacy policy row opens
// to, in place (pages/landing.mjs): keep it true of the rows under it.
export const policy = {
  updated: '2026-11-04',
  intro: `Questions? ${SUPPORT_EMAIL}`,
  sections: [
    {
      title: 'What we keep',
      summary: 'Your account, what you add, your questions and payments. Never card or UPI details.',
      rows: [
        ['Your account', 'Name, email and photo from Google. Your phone, if you add it.'],
        ['What you add', 'Documents and their text, family tree, emergency cards, notes and chats.'],
        ['Your questions', 'To answer them, and how many you ask.'],
        ['Payments', "Plan, amount and Razorpay's payment number. Never card or UPI details."],
        ['Your agreement', 'That you agreed to our terms, and when.'],
        ['App usage', "Screens and buttons used and document types, with a random device number. Never your documents' text, questions, name or email. Turn it off in Settings › Privacy."],
        ['Your country', 'Checked to show ₹ or $. Not kept.'],
      ],
    },
    {
      title: 'Who can open your documents',
      // The landing page's three Privacy rows say this just above the summary.
      onLanding: false,
      summary: 'People in your vault and anyone with a share link. Not end-to-end, so our team can open them.',
      rows: [
        ['People in your vault', 'Your personal vault is yours alone.'],
        ['A share link', 'Whoever has it, for that one document, until it expires or you turn it off.'],
        ['Our servers and team', 'Encrypted, not end-to-end. Our servers read documents to search and answer, and the people who run AskLocker can open them.'],
        ['No selling, no ads', 'We never sell your data.'],
      ],
    },
    {
      title: 'Services we use',
      summary: 'Supabase stores your documents, Cloudflare makes them searchable, Anthropic and Groq write answers, OCR.space reads scans, Google signs you in and Razorpay takes payments.',
      note: 'Each keeps what it gets under its own privacy policy.',
      rows: [
        ['Supabase', 'Stores your account and documents, in Mumbai, India.'],
        ['Cloudflare', "Runs the website and email, and makes search data from your documents and questions. Says it doesn't train AI on them."],
        ['Anthropic (Claude) and Groq', 'Get your question and the best-matching passages, to write an answer. Never your whole vault.'],
        ['OCR.space', 'Reads scanned PDFs and photos imported from Gmail. Photos and spreadsheets you upload are read on your device.'],
        ['Google', 'Signs you in. With Gmail connected, we read senders, subjects and attachment names, and download only what you pick, never the email. In Chrome, voice goes to Google.'],
        ['Razorpay', 'Takes payments. Card and UPI details go only to Razorpay.'],
        ['Push services', "Carry notifications, encrypted so they can't read them."],
        ['Usage analytics', 'A service in the EU keeps the usage counts, without internet addresses.'],
      ],
    },
    {
      title: 'How long we keep it',
      summary: 'Until you delete it. Deleting your account is immediate.',
      rows: [
        ['What you add', 'Until you delete it.'],
        ['Your account', 'Deleted at once, with your personal vault and any family only you manage. What you added to other families stays there, so delete it first.'],
        ['When a paid plan ends', `The newest documents over the free space are removed after ${facts.graceDays} days. We warn you first.`],
        ['Payment records', 'Kept with the vault, without your name once your account is gone.'],
        ['Backups and logs', 'Copies expire on their own.'],
      ],
    },
    {
      title: 'Your choices',
      summary: 'Delete documents, leave a vault, turn off usage counts or delete your account, all in the app.',
      rows: [
        ['Delete a document', 'All documents'],
        ['Leave a vault', 'Manage Family'],
        ['Turn off usage counts or notifications', 'Settings › Privacy, Settings › Notifications'],
        ['Disconnect Gmail', 'Import from Gmail'],
        ['Delete your account', 'Settings › Security'],
      ],
    },
    {
      title: 'Good to know',
      summary: 'AI can be wrong, and AskLocker is not a backup.',
      rows: [
        ['AI can be wrong', 'Check the document before relying on an answer.'],
        ['Not a backup', 'Keep the originals.'],
        ['Changes', 'The date above changes with this page. If what happens to your documents changes, we ask you again.'],
      ],
    },
  ],
};

export const faq = [
  { q: 'What is AskLocker?', a: about },
  {
    q: 'How much does it cost?',
    a: `Free to start. Family Plus is ${rupees(p.monthly.inr)} a month and Family Pro ${rupees(pro.monthly.inr)}, or ${rupees(p.yearly.inr)} and ${rupees(pro.yearly.inr)} a year. Business plans start at ${rupees(businessPlans[0].price)} a month + GST.`,
  },
  { q: 'What can I add?', a: `Photos, PDFs, and Excel or CSV files, up to ${facts.maxFileMb} MB each.` },
  { q: 'Which languages does it speak?', a: `Ask aloud and hear answers in ${listOf(voiceNames)}.` },
  { q: 'Who can open my documents?', a: 'People in your vault, and anyone you send a share link. Documents are encrypted, but not end-to-end, so our team can open them.' },
  { q: 'Is there a phone app?', a: "Open asklocker.com on your phone and add it to your Home Screen. Store apps aren't out yet." },
  { q: 'Can I rely on the answers?', a: 'Answers come from AI and can be wrong. Each one shows its document, so you can check.' },
];

// The share card and llms.txt lead with the family mode.
export const hero = modes.family.hero;
