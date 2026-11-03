// What the films may say about privacy, today and at launch.
//
// Today's films say what is true today: documents are encrypted on the way
// and on Supabase's disks, not end-to-end, so AskLocker's servers read them and
// the people who run AskLocker can open them (public/privacy.html).
//
// ?claims=launch (tools/render.mjs --launch) makes the launch set: what will
// be true once end-to-end encryption ships (the encryption brief of 3 November
// 2026). Documents are locked on members' phones with their vault's own key,
// AskLocker stores only scrambled copies, nobody at AskLocker can open them,
// and only the passages a question needs go to an AI service. Gmail import is
// off for encrypted vaults, and reminders show in the app, not as web
// notifications, so the launch set shows neither.
//
// NOTHING rendered with ?claims=launch is posted until the owner confirms the
// launch has shipped (marketing/launch/README.md). The words come from the
// brief's "Say" list; check them with the owner just before release.
export const LAUNCH = new URLSearchParams(location.search).get('claims') === 'launch';

/** The line under AskLocker on every end card. */
export const END_LINE = LAUNCH
  ? { family: 'Ask your documents anything. Only your family can open them.',
    business: 'Ask your records anything. Only your team can open them.' }
  : { family: 'Every family document. One question away.',
    business: null }; // the business film's own tagline (BIZ.tagline)

/** The launch set's one line, and a business's. */
export const LAUNCH_LINE = 'Locked on your phone. Opened only by your family.';
export const LAUNCH_LINE_BUSINESS = 'Locked on your phone. Opened only by your team.';
