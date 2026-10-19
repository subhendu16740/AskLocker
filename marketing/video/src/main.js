// Picks the film: ?film=business for AskLocker for Business, anything else for
// the family film. Each builds its stage and timeline with src/engine.js.
const film = new URLSearchParams(location.search).get('film') === 'business' ? 'business' : 'family';
document.title = film === 'business' ? 'AskLocker for Business' : 'AskLocker for families';
await import(`./${film}.js`);
