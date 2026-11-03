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
