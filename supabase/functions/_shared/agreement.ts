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

// 2026-10-23 (062) opened with "Please read the following."; 2026-10-23.2
// (063) says why the points are there.
export const AGREEMENT_VERSION = '2026-10-23.2';

export const AGREEMENT_TITLE = 'Before you start';

// Respect, then plain words about what is done (the owner's ask, 23 October
// 2026). An attitude, never a promise: "we keep them confidential" would be
// untrue, since the people who run AskLocker can open them (Privacy).
export const AGREEMENT_INTRO = "We respect your confidentiality. Here's exactly what we do with your documents.";

// Only what a new person needs before they have used anything (the owner's
// ask, 23 October 2026): two points of two lines each, said from the side
// of what AskLocker does, and no service named. "In AskLocker" is the
// approved limit (CLAUDE.md): the people who run AskLocker can still open
// documents, which Settings › Privacy says, with the services by name and
// who can see what; the footer points there.
export const AGREEMENT_POINTS: { head: string; text: string }[] = [
  {
    head: 'Encrypted',
    text: 'Sent and stored encrypted. In AskLocker, only people in your vault can open them.',
  },
  {
    head: 'Read to answer you',
    text: 'Our servers and AI services read parts of them to answer your questions.',
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
