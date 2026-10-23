// What everyone agrees to before using AskLocker (062), in plain words: what
// AskLocker does with their documents. The app shows it as a screen nobody
// can skip (src/components/agreement-screen.tsx) and records who agreed, to
// which version, and when, by the database's clock (record_agreement()).
//
// Every sentence must stay true of the app and of the people who run it, as
// Settings › Privacy must (CLAUDE.md, "Never promise more privacy than
// AskLocker gives"). Change it with any change to sharing, search, OCR, AI,
// plans, deletion or usage counts — and then give it a new version and a new
// migration with the new words, so everyone is asked again. The same words
// are a row of agreement_versions; the self-test checks the two match word
// for word, so the record always says what the screen said.

import { DEFAULT_PLAN_LIMITS } from './plan-text.ts';

export const AGREEMENT_VERSION = '2026-10-23';

export const AGREEMENT_TITLE = 'Before you start';

export const AGREEMENT_INTRO = 'Here is what AskLocker does with your documents.';

export const AGREEMENT_POINTS: { head: string; text: string }[] = [
  {
    head: 'Who can see them',
    text: 'Everyone in a vault can see its documents. Anyone you send a share link to can see that document. Your personal vault is only for you.',
  },
  {
    head: 'Not end-to-end encrypted',
    text: 'Your documents are encrypted when sent and when stored, but not end-to-end. The people who run AskLocker can open them.',
  },
  {
    head: 'Other services read parts of them',
    text: 'To search and answer questions, our servers read the text of your documents. Parts of it go to HuggingFace and Groq. Scanned PDFs and photos from Gmail go to OCR.space.',
  },
  {
    head: 'AI can be wrong',
    text: 'Answers are written by AI. Check the document before you rely on an answer.',
  },
  {
    head: 'Not a backup',
    text: 'Keep the originals of important papers. AskLocker is not a backup.',
  },
  {
    head: 'When Family Plus ends',
    text: `If a vault holds more than its free space, its newest documents above that are removed after ${DEFAULT_PLAN_LIMITS.graceDays} days. We warn you first.`,
  },
  {
    head: 'Deleting your account',
    text: "It happens at once and can't be undone. Documents you added to a family may stay there after you go.",
  },
  {
    head: 'Usage counts',
    text: 'We count which screens are used and the kinds of documents added, like "Passport", never what they say. You can turn this off in Settings › Privacy.',
  },
];

export const AGREEMENT_FOOTER = "If any of this changes, we'll ask you again.";

export const AGREEMENT_TICK = "I've read this and I agree.";

/** The exact words shown, in one string: what agreement_versions keeps for the version. */
export function agreementText(): string {
  return [
    AGREEMENT_TITLE,
    AGREEMENT_INTRO,
    ...AGREEMENT_POINTS.map((p) => `${p.head}\n${p.text}`),
    AGREEMENT_FOOTER,
    AGREEMENT_TICK,
  ].join('\n\n');
}
