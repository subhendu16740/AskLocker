// Picks the film: ?film=business for AskLocker for Business, ?film=nri for the
// family film told by a son who lives abroad, ?film=features for one feature
// (?feature=ask): a 9:16 short with ?orientation=portrait, a poster at any
// other size; anything else for the family film. Each builds its stage and
// timeline with src/engine.js; the NRI film is the family film's scenes with
// its own story (NRI_STORY in family-screens.js).
const asked = new URLSearchParams(location.search).get('film');
const film = ['business', 'nri', 'features'].includes(asked) ? asked : 'family';
document.title = { business: 'AskLocker for Business', nri: 'AskLocker for families abroad', features: 'AskLocker features' }[film] ?? 'AskLocker for families';
await import(`./${film === 'nri' ? 'family' : film}.js`);
