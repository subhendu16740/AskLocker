// Picks the film: ?film=business for AskLocker for Business, ?film=nri for the
// family film told by a son who lives abroad, ?film=features for one feature
// (?feature=ask): a 9:16 short with ?orientation=portrait, a poster at any
// other size; anything else for the family film. Each builds its stage and
// timeline with src/engine.js; the NRI film is the family film's scenes with
// its own story (NRI_STORY in family-screens.js). ?film=privacy is what
// AskLocker does with a family's documents (src/privacy.js), with &reel= for
// one of its reels. ?film=locked is the launch's own film, what AskLocker
// does once end-to-end encryption ships (src/locked.js): it needs
// &claims=launch and is never posted before the launch; ?film=locked-business
// is the same film for a business (src/locked-screens.js). ?film=why is why
// AskLocker was made, with &reel=founder, family or business (src/why.js).
const asked = new URLSearchParams(location.search).get('film');
const film = ['business', 'nri', 'features', 'privacy', 'locked', 'locked-business', 'why'].includes(asked) ? asked : 'family';
document.title = { business: 'AskLocker for Business', nri: 'AskLocker for families abroad', features: 'AskLocker features', privacy: 'What happens to your documents', locked: 'Locked on your phone', 'locked-business': 'Locked on your phone, for Business', why: 'Why we built AskLocker' }[film] ?? 'AskLocker for families';
await import(`./${{ nri: 'family', 'locked-business': 'locked' }[film] ?? film}.js`);
