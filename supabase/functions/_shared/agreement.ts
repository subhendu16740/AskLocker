// What everyone agrees to before using AskLocker (062), in plain words: what
// AskLocker does with their documents. The app shows it as a screen nobody
// can skip (src/components/agreement-screen.tsx) and records who agreed, to
// which version, and when, by the database's clock (record_agreement()).
//
// Every sentence must stay true of the app and of the people who run it, as
// Settings › Privacy must (CLAUDE.md, "Never promise more privacy than
// AskLocker gives"). Change it with any change to sharing, search, OCR or the
// AI — and then give it a new version and a new migration with the new words,
// so everyone is asked again. The same words
// are a row of agreement_versions; the self-test checks the two match word
// for word, so the record always says what the screen said.

export const AGREEMENT_VERSION = '2026-10-23';

export const AGREEMENT_TITLE = 'Before you start';

export const AGREEMENT_INTRO = 'Here is what happens to your documents.';

// Only what happens to people's documents (the owner's ask, 23 October 2026).
// Everything else worth knowing is one line each in Settings › Privacy.
export const AGREEMENT_POINTS: { head: string; text: string }[] = [
  {
    head: 'Who can see them',
    text: 'People in the same vault, and anyone you send a share link to. Your personal vault is only for you.',
  },
  {
    head: 'Not end-to-end encrypted',
    text: 'They are encrypted when sent and stored, but the people who run AskLocker can open them.',
  },
  {
    head: 'Other services',
    text: 'To search and answer, parts of them go to HuggingFace and Groq. Scanned PDFs and Gmail photos go to OCR.space.',
  },
];

export const AGREEMENT_FOOTER = "More in Settings › Privacy. If this changes, we'll ask you again.";

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
