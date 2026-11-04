// The films in India's languages. ?ui=hi (tools/render.mjs --ui hi) puts the
// film's own words in Hindi: headlines, lines, callouts, cards, subtitles and
// the end card. The same for bn, mr, ta, te, gu, kn, ml and pa.
//
// The phone keeps the app's own English, because the app is in English: only
// what a person types or says into it, and the answers, follow the film's
// language, as AskLocker answers in the language it is asked in. The family
// film's voice scene speaks it too (?lang=, src/voice-lines.js).
//
// Each language's words are in src/i18n/<code>.js, keyed by the English. t()
// gives the English back where a language has no entry, and render.mjs
// --strings lists every string a film shows and those a language lacks.
// ?ui=qq is a test language: every Latin letter accented, so English left
// anywhere in a film's words stands out.
//
// The translations are first drafts. Have someone who speaks each language
// read its film before it goes out. The never-say rules hold in every
// language (marketing/README.md): no word for "safe" or "secure", nothing
// that promises more privacy than AskLocker gives.

/** The film's language: '' for English. */
export const UI = new URLSearchParams(location.search).get('ui') || '';

/** The languages, in English, and their script's fonts (fonts/indic.css): text, serif, and the app's. */
export const UI_LANGS = {
  hi: { name: 'Hindi', fonts: ['Anek Devanagari', 'Noto Serif Devanagari', 'Noto Sans Devanagari'] },
  bn: { name: 'Bengali', fonts: ['Anek Bangla', 'Noto Serif Bengali', 'Noto Sans Bengali'] },
  mr: { name: 'Marathi', fonts: ['Anek Devanagari', 'Noto Serif Devanagari', 'Noto Sans Devanagari'] },
  ta: { name: 'Tamil', fonts: ['Anek Tamil', 'Noto Serif Tamil', 'Noto Sans Tamil'] },
  te: { name: 'Telugu', fonts: ['Anek Telugu', 'Noto Serif Telugu', 'Noto Sans Telugu'] },
  gu: { name: 'Gujarati', fonts: ['Anek Gujarati', 'Noto Serif Gujarati', 'Noto Sans Gujarati'] },
  kn: { name: 'Kannada', fonts: ['Anek Kannada', 'Noto Serif Kannada', 'Noto Sans Kannada'] },
  ml: { name: 'Malayalam', fonts: ['Anek Malayalam', 'Noto Serif Malayalam', 'Noto Sans Malayalam'] },
  pa: { name: 'Punjabi', fonts: ['Anek Gurmukhi', 'Noto Serif Gurmukhi', 'Noto Sans Gurmukhi'] },
  qq: { name: 'Test', fonts: [] },
};
if (UI && !UI_LANGS[UI]) throw new Error(`No film language "${UI}": one of ${Object.keys(UI_LANGS).join(', ')}`);

const DICT = UI && UI !== 'qq' ? (await import(`./i18n/${UI}.js`)).default : {};
// A string already in the film's language passes through unchanged.
const DONE = new Set(Object.values(DICT));
const seen = new Set();
const missing = new Set();
window.__i18n = { ui: UI, seen, missing };

const ACCENTS = 'áƀçđéƒğĥíĵķĺɱńóƥɋŕśťúʋŵẋýźÁƁÇĐÉƑĞĤÍĴĶĹṀŃÓƤɊŔŚŤÚṾŴẊÝŹ';
const LATIN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** ?ui=qq: every Latin letter outside a tag or an entity accented. */
const pseudo = (s) => s.replace(/(<[^>]*>|&[a-z]+;)|([A-Za-z])/g, (m, tag, ch) => tag || ACCENTS[LATIN.indexOf(ch)]);

/** The film's words in its language: the English is the key. */
export function t(s) {
  // Numbers alone ("90", "₹499") read the same in every language.
  if (typeof s !== 'string' || !/[A-Za-z]/.test(s) || DONE.has(s)) return s;
  seen.add(s);
  if (!UI) return s;
  if (UI === 'qq') return pseudo(s);
  if (Object.hasOwn(DICT, s)) return DICT[s];
  missing.add(s);
  return s;
}
