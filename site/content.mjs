// The words on asklocker.com's landing page, as data: the page, its FAQ
// structured data and the Markdown for AI assistants (llms-full.txt) all
// come from here, so they agree.
//
// The app's rules hold (CLAUDE.md, Conventions):
//  - Short and plain, as the app's screens are: a title and one line.
//    Where the app already says it, the page uses the app's own words (the
//    onboarding slides, Settings › Privacy, Help).
//  - Never promise more privacy than AskLocker gives: no "secure", "safe",
//    "private and isolated", "100% private", "only you can see it" or
//    "nothing is kept"; "end-to-end" only as "not end-to-end". The QA
//    self-test checks the built page.
//  - Numbers come from the constants (lib/facts.mjs), never typed in.
//  - Claim only what the app does. Voice answers come in every voice
//    language; typed questions carry no language, so they are not claimed.

import { SUPPORT_EMAIL, businessPlans, dollars, facts, listOf, rupees } from './lib/facts.mjs';

const voiceNames = facts.voiceLanguages.map((l) => l.english);
const p = facts.plus;
const pro = facts.pro;

export const meta = {
  title: 'AskLocker: a family document vault you can ask',
  description: `Keep passports, policies, bills and certificates in one family vault, and ask about them in plain words, or by voice in ${voiceNames.length} languages. Free to start.`,
};

/** What AskLocker is, in one place: FAQ, structured data, llms.txt. */
export const about = 'AskLocker is a document vault for families and small businesses. Add documents by photo, PDF or spreadsheet, then ask about them in plain words or by voice. Each answer shows the document it came from.';

export const hero = {
  title: 'Every family document, one question away.',
  lead: "Your family's documents, in one place. Just ask.",
  note: 'Free to start. Works on any phone or computer.',
};

// The onboarding's slides (src/app/onboarding.tsx), and what Home offers next.
export const steps = [
  { icon: 'camera', title: 'Snap or upload', text: 'AskLocker reads every page for you.' },
  { icon: 'message-circle', title: 'Just ask', text: '“When does Dad\'s passport expire?”' },
  { icon: 'bell', title: 'Get reminded', text: 'Before a passport or policy runs out.' },
];

export const features = [
  { icon: 'users', title: 'Ask by relation', text: '“Nani\'s pension” just works.' },
  { icon: 'mic', title: 'Ask by voice', text: `In English, Hindi and ${voiceNames.length - 2} more.` },
  { icon: 'heart', title: 'Emergency cards', text: 'Blood group, allergies, who to call.' },
  { icon: 'link', title: 'Share one document', text: 'A link for your CA or agent.' },
  { icon: 'lock', title: 'A vault of your own', text: 'Yours alone, or shared with family.' },
  { icon: 'aperture', title: 'Fingerprint sign-in', text: 'After Google, just once.' },
];

export const business = {
  title: 'AskLocker for business',
  text: `Invoices, bills and licences, for your team. From ${rupees(businessPlans[0].price)} a month + GST.`,
  cta: { label: 'Ask us', href: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('AskLocker for my business')}` },
};

/** The Plans page's rows (src/app/plus.tsx), the ones that tell plans apart. */
export const planRows = [
  { label: 'People', cell: (plan) => String(plan.people) },
  { label: 'Space', cell: (plan) => plan.space },
  { label: 'Questions a month', cell: (plan) => plan.questions },
  { label: 'Expiry reminders', cell: (plan) => plan.expiry },
  { label: 'Share a document', cell: (plan) => `${plan.shareDays} days` },
  { label: 'Indian languages', cell: (plan) => plan.languages },
];

export const pricingNote = `Outside India, Family Plus is ${dollars(p.monthly.usd)} and Family Pro ${dollars(pro.monthly.usd)} a month.`;

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
