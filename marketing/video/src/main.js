// Picks the film: ?film=business for AskLocker for Business, ?film=nri for the
// family film told by a son who lives abroad, anything else for the family
// film. Each builds its stage and timeline with src/engine.js; the NRI film is
// the family film's scenes with its own story (NRI_STORY in family-screens.js).
import { FILM } from './engine.js';

document.title = { business: 'AskLocker for Business', nri: 'AskLocker for families abroad', family: 'AskLocker for families' }[FILM];
await import(`./${FILM === 'business' ? 'business' : 'family'}.js`);
