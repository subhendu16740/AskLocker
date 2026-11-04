// Checks each language's table of the films' words (src/i18n/<code>.js)
// against its English keys: the same markup (<b>, <br>, <mark>, *stars*,
// |line breaks), every number kept, no Latin word the English does not have
// beyond product names and codes, and none of the words for "safe", "secure"
// or "confidential", which no film may use (marketing/README.md).
// Which strings a film shows, and whether a language lacks any, is
// tools/render.mjs --strings --ui <code>.
//
// usage: node tools/i18n-check.mjs [hi bn mr ta te gu kn ml pa ...]   (all when none is named)

const ALL = ['hi', 'bn', 'mr', 'ta', 'te', 'gu', 'kn', 'ml', 'pa'];
const FORBIDDEN = {
  hi: ['सुरक्षित', 'गोपनीय'], mr: ['सुरक्षित', 'गोपनीय'], bn: ['সুরক্ষিত', 'নিরাপদ', 'গোপনীয়'],
  ta: ['பாதுகாப்பான', 'பாதுகாப்பாக', 'ரகசிய'], te: ['సురక్షిత', 'భద్రంగా', 'రహస్య'],
  gu: ['સુરક્ષિત', 'ગોપનીય'], kn: ['ಸುರಕ್ಷಿತ', 'ಗೌಪ್ಯ'], ml: ['സുരക്ഷിത', 'രഹസ്യ'], pa: ['ਸੁਰੱਖਿਅਤ', 'ਗੁਪਤ'],
};
// Latin a translation may keep: product names, file and code names, units, and the app's own menu path.
const LATIN_OK = new Set(['AskLocker', 'Gmail', 'Family', 'Plus', 'Pro', 'Enterprise', 'PDF', 'OTP', 'GST', 'GSTIN',
  'IGST', 'CA', 'AI', 'ID', 'MB', 'GB', 'Excel', 'Settings', 'Privacy', 'AM']);
const SAME_OK = new Set(['★ Family Plus', 'Plus', 'Pro', 'Enterprise', '20 GB', '50 GB', '200 GB']);
const MARKS = ['<b>', '</b>', '<br>', '<mark', '</mark>', '*', '|'];
const count = (s, m) => s.split(m).length - 1;

let failed = 0;
for (const lang of process.argv.slice(2).length ? process.argv.slice(2) : ALL) {
  const table = (await import(new URL(`../src/i18n/${lang}.js`, import.meta.url))).default;
  const problems = [];
  for (const [en, tr] of Object.entries(table)) {
    const where = `"${en.slice(0, 50)}"`;
    if (!tr.trim()) problems.push(`${where}: empty`);
    const a = MARKS.map((m) => count(en, m)); const b = MARKS.map((m) => count(tr, m));
    if (a.join() !== b.join()) problems.push(`${where}: markup ${a} in English, ${b} here`);
    for (const n of en.match(/\d[\d,.]*\d|\d/g) || []) if (!tr.includes(n)) problems.push(`${where}: the number ${n} is missing`);
    for (const w of tr.replace(/<[^>]+>/g, ' ').match(/[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*/g) || []) {
      if (!LATIN_OK.has(w) && !en.includes(w)) problems.push(`${where}: Latin "${w}"`);
    }
    if (tr === en && !SAME_OK.has(en)) problems.push(`${where}: still in English`);
    for (const bad of FORBIDDEN[lang]) if (tr.includes(bad)) problems.push(`${where}: forbidden word "${bad}"`);
  }
  console.log(`${lang}: ${Object.keys(table).length} strings, ${problems.length ? `${problems.length} problem(s)` : 'all pass'}`);
  for (const p of problems) console.log(`  ${p}`);
  failed += problems.length;
}
process.exit(failed ? 1 : 0);
