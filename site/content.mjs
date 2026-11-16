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

import { LEGAL, POLICY_CHOICES, SUPPORT_EMAIL, businessColumns, businessPlans, dollars, facts, familyPlans, listOf, rupees } from './lib/facts.mjs';

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
  updated: '2026-11-14',
  intro: `For asklocker.com and the AskLocker app for Android. Questions? ${SUPPORT_EMAIL}`,
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
        ['Your devices', 'An address for each device where you turn notifications on, so they reach it.'],
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
      summary: 'Supabase stores your documents, Cloudflare makes them searchable, Anthropic and Groq write answers, OCR.space reads scans and Android photos, Google signs you in and carries Android notifications, and Razorpay takes payments on the website.',
      note: 'Each keeps what it gets under its own privacy policy.',
      rows: [
        ['Supabase', 'Stores your account and documents, in Mumbai, India.'],
        ['Cloudflare', "Runs the website and email, and makes search data from your documents and questions. Says it doesn't train AI on them."],
        ['Anthropic (Claude) and Groq', 'Get your question and the best-matching passages, to write an answer. Never your whole vault.'],
        ['OCR.space', 'Reads scanned PDFs, photos imported from Gmail, and photos you add in the Android app, in English. Photos you add on the website, and spreadsheets, are read on your device.'],
        ['Google', 'Signs you in. With Gmail connected, we read senders, subjects and attachment names, and download only what you pick, never the email. In Chrome, voice goes to Google.'],
        ['Razorpay', 'Takes payments on the website. Card and UPI details go only to Razorpay. The Android app takes no payments.'],
        // If the Android app's notifications go through Expo's push service on
        // their way to Firebase, Expo must be named here too.
        ['Push services', "Carry notifications. On the website they are encrypted, so the service can't read them. In the Android app, Google's Firebase Cloud Messaging carries them and can read their title and line."],
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
        ['Delete your account', `Settings › Security › Delete account, in the app or at asklocker.com/settings/delete-account. Or write to ${SUPPORT_EMAIL} from the email you sign in with.`],
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

// The terms, refunds and contact pages (pages/legal.mjs), for families,
// businesses, Razorpay's website review and the Play Store. Same rules as the
// policy above: plain, short, true of the code, numbers from the constants.
// Lines that need a fact only the owner can give (LEGAL in lib/facts.mjs) are
// left out while it is null. A lawyer's read is worth it before relying on them.

const price = (pp) => `${rupees(pp.monthly.inr)} a month or ${rupees(pp.yearly.inr)} a year in India, ${dollars(pp.monthly.usd)} or ${dollars(pp.yearly.usd)} elsewhere`;
const bizPrices = businessPlans.map((b) => `${b.name} ${rupees(b.price)} a month or ${rupees(b.yearly)} a year`).join(', ');
const { refundDays, replyWorkingDays } = POLICY_CHOICES;
/** Rows whose text is null are left out (a fact not given yet). */
const given = (rows) => rows.filter(([, text]) => text != null && text !== '');

export const terms = {
  path: '/terms',
  title: 'Terms of service',
  description: 'The rules for using AskLocker: accounts, plans and prices, your documents, and what we each promise.',
  updated: '2026-11-14',
  intro: `By using AskLocker, on asklocker.com or in the Android app, you agree to these terms. Questions? ${SUPPORT_EMAIL}`,
  sections: [
    {
      title: 'AskLocker',
      rows: given([
        ['What it is', about],
        ['Who runs it', LEGAL.operator ? `${LEGAL.operator}${LEGAL.address ? `, ${LEGAL.address}` : ''}.` : null],
        ['Who can use it', 'You must be 18 or older to make an account. A vault can hold documents about children in your care.'],
        ['Your account', 'You sign in with Google. Keep your Google account to yourself: whoever can sign in to it can open your vaults.'],
      ]),
    },
    {
      title: 'Plans and payments',
      rows: [
        ['Free', `${facts.freeQuestions} questions a month each, ${facts.freePersonSpace} of space per person, ${facts.freeMembers} people in a family.`],
        ['Family Plus', `${price(facts.plus)}.`],
        ['Family Pro', `${price(facts.pro)}.`],
        ['Business plans', `${bizPrices}, plus GST where it applies. Set up on request.`],
        ['How paying works', 'You pay on the website, through Razorpay. Each payment adds a month or a year, from the end of the time already paid for. The Android app takes no payments.'],
        ['Nothing renews by itself', 'We never charge you without you paying. A plan ends when its time runs out.'],
        ['Refunds', `Within ${refundDays} days of a payment. See asklocker.com/refunds.`],
        ['Prices can change', 'A new price applies to payments made after it changes, never to time already paid for.'],
      ],
    },
    {
      title: 'Limits',
      rows: [
        ['Each plan has limits', 'On people, space and questions, shown on the Plans page and at asklocker.com. We may change them, and a lower limit never deletes what you have.'],
        ['Daily limits', 'Questions and uploads have daily limits too, so one account cannot use up what everyone shares.'],
        ['Files', `Up to ${facts.maxFileMb} MB each: ${listOf(facts.fileTypes)}.`],
      ],
    },
    {
      title: 'When a paid plan ends',
      rows: [
        ['A family or personal vault', `You can still read, search and download everything, but add nothing over the free space. After ${facts.graceDays} days the newest documents above the free space are removed. We warn you before, and renewing or deleting documents stops it.`],
        ['A business', 'Keeps every record and adds nothing until the plan is renewed. A trial goes back to Free.'],
      ],
    },
    {
      title: 'Your documents',
      rows: [
        ['They stay yours', 'You give us permission to store and read them only to run AskLocker for you: to search them, answer your questions, remind you and share them when you ask.'],
        ['Who else gets them', 'People in your vault, anyone you send a share link, and the services named in our privacy policy at asklocker.com/privacy. Documents are encrypted, but not end-to-end, so the people who run AskLocker can open them.'],
        ['AI can be wrong', 'Answers are written by AI. Check the document before you rely on one.'],
        ['Not a backup', 'Keep the originals of important papers.'],
      ],
    },
    {
      title: 'Using it fairly',
      rows: [
        ['Add only what you may keep', "Your own documents, and your family's or business's with their permission."],
        ['Never', "Anything illegal, malware, documents taken from others, ways around the limits, or attempts to reach a vault you aren't in."],
        ['If you break these terms', 'We may suspend or close the account. Where we can, we tell you first and give you time to download your documents.'],
      ],
    },
    {
      title: 'Ending',
      rows: [
        ['Delete your account', 'Settings › Security › Delete account. It is immediate, with your personal vault and any family only you manage.'],
        ['Delete a vault', "Its owner can, in Settings › Your vaults. Everyone in it loses what's there."],
        ['If AskLocker closes', 'We tell you at least 30 days before, so you can download your documents.'],
      ],
    },
    {
      title: 'The legal part',
      rows: given([
        ['As it is', "We work to keep AskLocker running and your documents in it, but we can't promise it will always be available or free of errors."],
        ['Our liability', 'As far as the law allows, we are not liable for indirect losses, and our total liability is what you paid us in the 12 months before the claim.'],
        ['Changes to these terms', 'If a change matters to you, we tell you in the app before it applies. The date above changes with this page.'],
        ['Law', 'Indian law governs these terms.'],
        ['Courts', LEGAL.courtsCity ? `The courts of ${LEGAL.courtsCity} hear any dispute.` : null],
        ['Contact', `${SUPPORT_EMAIL}, or asklocker.com/contact.`],
      ]),
    },
  ],
};

export const refunds = {
  path: '/refunds',
  title: 'Refunds and cancellation',
  description: `How to ask for a refund within ${refundDays} days, and why there is nothing to cancel.`,
  updated: '2026-11-14',
  intro: `Ask by email: ${SUPPORT_EMAIL}`,
  sections: [
    {
      title: 'Cancelling',
      rows: [
        ['Nothing to cancel', 'Plans never renew by themselves, so we never charge you unless you pay. A plan ends when its time runs out.'],
      ],
    },
    {
      title: 'Refunds',
      rows: [
        [`Within ${refundDays} days`, `Write to ${SUPPORT_EMAIL} within ${refundDays} days of a payment, from the email you sign in with, and we refund it in full.`],
        [`After ${refundDays} days`, 'No refund for time already paid. Your plan runs to its end date.'],
        ['What a refund does', `The plan ends at once. Above the free space, the newest documents are removed after ${facts.graceDays} days, with warnings first.`],
        ['When the money arrives', 'Razorpay returns it to the same card, UPI or bank account, usually within 5 to 7 working days.'],
        ['Business plans', 'The same rules apply.'],
      ],
    },
  ],
};

export const contact = {
  path: '/contact',
  title: 'Contact',
  description: 'How to reach the people who run AskLocker, and where complaints go.',
  updated: '2026-11-14',
  intro: `Write to ${SUPPORT_EMAIL}. We reply within ${replyWorkingDays} working days.`,
  sections: [
    {
      title: 'Support',
      rows: given([
        ['Email', SUPPORT_EMAIL],
        ['Phone', LEGAL.phone],
        ['What to include', "The email you sign in with, which vault, and what happened. Don't send documents or ID numbers by email."],
        ['In the app', 'Settings › Help & FAQ › Send feedback.'],
      ]),
    },
    {
      title: 'Complaints and your data',
      rows: given([
        ['Grievance Officer', LEGAL.grievanceOfficer],
        ['Email', LEGAL.grievanceEmail],
        ['For', 'Complaints about AskLocker or about content in it, and requests about your personal data, under India’s IT Rules 2021 and the Digital Personal Data Protection Act.'],
        ['How long it takes', 'We acknowledge a complaint within 24 hours and resolve it within 15 days.'],
      ]),
    },
    {
      title: 'Who runs AskLocker',
      rows: given([
        ['Run by', LEGAL.operator],
        ['Postal address', LEGAL.address],
      ]),
    },
  ].filter((sec) => sec.rows.length),
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
