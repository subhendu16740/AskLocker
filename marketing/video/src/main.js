// Picks the film: ?film=business for AskLocker for Business, ?film=features
// for one feature (?feature=ask): a 9:16 short with ?orientation=portrait, a
// poster at any other size; anything else for the family film. Each builds its
// stage and timeline with src/engine.js.
const asked = new URLSearchParams(location.search).get('film');
const film = ['business', 'features'].includes(asked) ? asked : 'family';
document.title = { business: 'AskLocker for Business', features: 'AskLocker features' }[film] ?? 'AskLocker for families';
await import(`./${film}.js`);
