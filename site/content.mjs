// The words on asklocker.com's landing page, as data: the HTML page, its
// FAQ structured data and the Markdown for AI assistants (llms-full.txt) are
// all drawn from here, so they always say the same thing.
//
// The app's rules hold here too (CLAUDE.md, Conventions):
//  - Never promise more privacy than AskLocker gives. No "secure", "safe",
//    "private and isolated", "100% private", "only you can see it" or
//    "nothing is kept". "In AskLocker, only people in your vault…" is the
//    approved limit, and documents are "not end-to-end" encrypted. The QA
//    self-test checks the built page.
//  - Short and plain: talk to the person as "you", no em-dash asides.
//  - Numbers come from the constants (lib/facts.mjs), never typed in.
//  - Claim only what the app does today. Voice answers come in every voice
//    language; typed questions carry no language, so they are not claimed.

import { SUPPORT_EMAIL, businessPlans, dollars, facts, listOf, rupees } from './lib/facts.mjs';

const indian = facts.voiceLanguages.filter((l) => l.code !== 'en-IN');
const voiceNames = facts.voiceLanguages.map((l) => l.english);
const plusYearSaving = 12 * facts.plus.monthly.inr - facts.plus.yearly.inr;

export const meta = {
  title: 'AskLocker: a family document vault you can ask',
  description: `Keep passports, policies, bills and certificates in one family vault, and ask about them in plain words, or by voice in ${voiceNames.length} languages. Free to start.`,
};

export const hero = {
  eyebrow: 'Family document vault',
  title: 'Every family document, one question away.',
  lead: 'Keep passports, policies, bills and certificates in one vault your family shares. Then just ask, and AskLocker answers from the document itself.',
  note: 'Free to start. Works in the browser on any phone or computer.',
  demo: {
    question: "When does Mom's passport expire?",
    answer: "Mom's passport expires on 12 March 2027.",
    source: 'Passport · Mom',
    voice: `Or ask aloud in ${indian.slice(0, 3).map((l) => l.native).join(', ')} and ${facts.voiceLanguages.length - 3} more`,
  },
};

export const what = {
  heading: 'What is AskLocker?',
  paragraphs: [
    'AskLocker is a document vault for families, with business vaults for small businesses. You add documents by taking a photo or uploading a PDF or spreadsheet. AskLocker reads every page, picks out details like expiry dates and policy, passport and PAN numbers, and answers questions about your documents in plain words.',
    `Each answer shows which document it came from, so you can open it and check. Ask by typing, or by voice in ${listOf(voiceNames)}.`,
  ],
};

export const steps = [
  {
    icon: 'camera',
    title: 'Add a document',
    text: `Snap a photo, scan a page, or upload a PDF, Excel or CSV file up to ${facts.maxFileMb} MB. Say whose it is: yours, Papa's or Nani's.`,
  },
  {
    icon: 'eye',
    title: 'AskLocker reads it',
    text: 'It reads the text, files it under a category like Passport or Health Insurance, and notes the dates and numbers that matter.',
  },
  {
    icon: 'message-circle',
    title: 'Ask in your own words',
    text: "“What's Papa's health policy number?” You get the answer, and the document it came from.",
  },
];

export const features = [
  {
    icon: 'users',
    title: 'Ask by relation',
    text: "Add your family tree once. Then ask about “Nani's pension” or “my brother's PAN card”, and AskLocker knows who you mean.",
  },
  {
    icon: 'mic',
    title: 'Ask by voice',
    text: `Speak your question and hear the answer, in English, Hindi and ${indian.length - 1} more Indian languages. Free on every plan.`,
  },
  {
    icon: 'bell',
    title: 'Reminders before things expire',
    text: 'A reminder before a passport, licence or policy runs out. With Family Plus, everyone in the family is reminded 90, 30 and 7 days before.',
  },
  {
    icon: 'heart',
    title: 'Emergency cards',
    text: 'Blood group, allergies, medicines, doctor and people to call, for everyone in the family. Every number is one tap from the dialler.',
  },
  {
    icon: 'link',
    title: 'Share one document',
    text: 'Send your CA or agent a link to one document. It works for 7 days, or 30 with Family Plus, and you can turn it off any time.',
  },
  {
    icon: 'lock',
    title: 'A vault of your own',
    text: 'Your personal vault is yours alone. A family vault is shared with the people you invite, and they join only when they accept.',
  },
  {
    icon: 'globe',
    title: 'Reads Indian languages',
    text: `With Family Plus or Pro, AskLocker reads photos of documents in ${indian.slice(0, 3).map((l) => l.english).join(', ')} and ${indian.length - 3} more Indian languages.`,
  },
  {
    icon: 'aperture',
    title: 'Fingerprint sign-in',
    text: 'Sign in with Google once. After that, your fingerprint or face signs you in on that device.',
  },
];

export const business = {
  eyebrow: 'AskLocker for business',
  heading: 'Bills, invoices and licences, for small businesses',
  text: 'A business vault keeps a shop’s, clinic’s or CA office’s papers for the whole team: sales invoices, purchase bills, GST returns, licences, leases and payroll. AskLocker reads GSTINs, bill numbers, totals and due dates.',
  points: [
    'Ask “When is the Mehta Cables bill due, and how much is it?”',
    'See renewals and bills due in one overview, from Plus',
    'Money in and out by month, from Pro',
    'Your team and your CA, each with their own login',
  ],
  price: `Plans from ${rupees(facts.businessFrom)} a month + GST, set up on request. We're starting with a few businesses.`,
  cta: { label: 'Ask about business plans', href: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('AskLocker for my business')}` },
};

/** The rows of the plans table, as the app's Plans page has them (067). */
export const planRows = [
  { label: 'People', sub: 'Each gets their own login', cell: (p) => String(p.people) },
  { label: 'Space', cell: (p) => p.space },
  { label: 'Questions a month', sub: 'Type or speak', cell: (p) => p.questions },
  { label: 'Expiry reminders', sub: 'Before a passport or policy runs out', cell: (p) => p.expiry },
  { label: 'Birthday reminders', sub: 'For everyone in your tree', cell: (p) => p.birthdays },
  { label: 'Share a document', sub: 'A link for your CA or agent', cell: (p) => `${p.shareDays} days` },
  { label: 'Hindi and other Indian languages', sub: 'Read from photos of documents', cell: (p) => p.languages },
  { label: 'Import from Gmail', sub: 'Attachments from your email', cell: (p) => p.gmail },
];

export const pricingNotes = [
  `Prices in India. Elsewhere, Family Plus is ${dollars(facts.plus.monthly.usd)} a month or ${dollars(facts.plus.yearly.usd)} a year, and Family Pro ${dollars(facts.pro.monthly.usd)} or ${dollars(facts.pro.yearly.usd)}.`,
  `A year of Family Plus costs ${rupees(facts.plus.yearly.inr)}, ${rupees(plusYearSaving)} less than twelve months. Nothing renews by itself.`,
  `Business plans start at ${rupees(businessPlans[0].price)} a month + GST.`,
];

export const privacy = {
  heading: 'Who can open your documents',
  points: [
    'In AskLocker, only people in your vault can open your documents. Your personal vault is yours alone.',
    'A share link opens one document, until it expires or you turn it off.',
    'Documents are encrypted when sent and when stored, but not end-to-end. Our servers read them to search them and answer you, and the people who run AskLocker can open them.',
    'To write an answer, AI services read the parts of your documents that match your question. Never your whole vault.',
    "We don't sell your data, and AskLocker has no ads.",
  ],
};

const p = facts.plus;
const pro = facts.pro;

export const faq = [
  {
    q: 'What is AskLocker?',
    a: 'AskLocker is a document vault for families and small businesses. You add documents by photo, PDF or spreadsheet, and ask questions about them in plain words, by typing or by voice. Each answer shows the document it came from.',
  },
  {
    q: 'How much does AskLocker cost?',
    a: `AskLocker is free to start. On Free, a family can have ${facts.freeMembers} people, and each person can add ${facts.freePersonSpace} and ask ${facts.freeQuestions} questions a month. Family Plus is ${rupees(p.monthly.inr)} a month or ${rupees(p.yearly.inr)} a year, for ${p.members} people, ${p.space} and ${p.questions} questions a month shared. Family Pro is ${rupees(pro.monthly.inr)} a month or ${rupees(pro.yearly.inr)} a year, for ${pro.members} people, ${pro.space} and ${pro.questions} questions a month. Outside India, Family Plus is ${dollars(p.monthly.usd)} a month and Family Pro ${dollars(pro.monthly.usd)}.`,
  },
  {
    q: 'What kinds of documents can I add?',
    a: `Photos (JPG and PNG), PDFs, and Excel (.xlsx) and CSV files, up to ${facts.maxFileMb} MB each. You can scan a paper with your phone's camera. Families keep passports, Aadhaar and PAN cards, insurance policies, property papers, bank statements, bills and certificates.`,
  },
  {
    q: 'Which languages does AskLocker understand?',
    a: `You can ask by voice and hear the answer in ${listOf(voiceNames)}, on every plan. With Family Plus or Pro, AskLocker also reads photos of documents written in Hindi and other Indian languages.`,
  },
  {
    q: 'Who can open my documents?',
    a: 'In AskLocker, only people in your vault, and anyone you send a share link to for that one document. Documents are encrypted when sent and when stored, but not end-to-end, so the people who run AskLocker can open them, and AI services read the parts that match your question to write an answer. The privacy policy names every service.',
  },
  {
    q: 'Does AskLocker remind me before a document expires?',
    a: 'Yes. On Free, whoever adds a document gets one reminder, 30 days before it expires. With Family Plus or Pro, everyone in the family is reminded 90, 30 and 7 days before, and on the day. Turn on notifications to get them on your phone or computer.',
  },
  {
    q: 'Can I share a document with someone outside my family?',
    a: 'Yes. Open the document, tap Share and make a link. Anyone with the link can open that one document for 1 or 7 days, or 30 with Family Plus, and you can turn it off any time.',
  },
  {
    q: 'Is there an AskLocker app for Android or iPhone?',
    a: "AskLocker runs in the browser on any phone or computer, at asklocker.com. On a phone, add it to your Home Screen and it opens like an app, with notifications. Apps in the Play Store and App Store aren't out yet.",
  },
  {
    q: 'Can I use AskLocker for my business?',
    a: `Yes. A business vault keeps invoices, bills, GST returns, licences and contracts for your team. Business plans start at ${rupees(businessPlans[0].price)} a month + GST: ${businessPlans.map((b) => `${b.name} for ${b.members} people`).join(', ').replace(/, ([^,]*)$/, ' and $1')}. They're set up on request: write to ${SUPPORT_EMAIL}.`,
  },
  {
    q: 'Can I rely on the answers?',
    a: "Answers are written by AI and can be wrong, so check the document before you rely on one. Each answer shows the document it came from. AskLocker isn't a backup, so keep the originals of important papers.",
  },
  {
    q: 'How do I delete my account?',
    a: 'In Settings › Security, tap Delete account. It goes right away, with your personal vault and any family only you manage.',
  },
];

export const closing = {
  heading: "Bring your family's documents together",
  text: 'Start free with your personal vault, then invite your family.',
};
