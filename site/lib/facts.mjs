// Every number and list the public site states, read from the code the app
// itself runs: prices and limits from supabase/functions/_shared/plan-text.ts
// (what the payments function charges), the file limit from limits.ts, the
// voice languages from src/lib/voice-languages.ts. Nothing here is typed in,
// so the site cannot disagree with the app (CLAUDE.md: numbers come from the
// constants).
//
// Node 22.18 and later read these .ts files directly, types stripped.

import {
  BUSINESS_PRICE,
  BUSINESS_YEAR_PRICE,
  DEFAULT_PLAN_LIMITS,
  PLUS_PRICE,
  PRO_PRICE,
  formatBytes,
} from '../../supabase/functions/_shared/plan-text.ts';
import { MAX_FILE_BYTES } from '../../supabase/functions/_shared/limits.ts';
import { VOICE_LANGUAGES } from '../../src/lib/voice-languages.ts';

export const SITE_URL = (process.env.SITE_URL || 'https://asklocker.com').replace(/\/+$/, '');
export const SUPPORT_EMAIL = 'support@asklocker.com';

const L = DEFAULT_PLAN_LIMITS;

/** 1000 -> "1,000"; rupees group in lakhs, as plan-text.ts does. */
export function grouped(amount, indian = true) {
  const digits = String(Math.round(amount));
  if (digits.length <= 3) return digits;
  let rest = digits.slice(0, -3);
  const groups = [];
  const size = indian ? 2 : 3;
  while (rest.length > size) {
    groups.unshift(rest.slice(-size));
    rest = rest.slice(0, -size);
  }
  groups.unshift(rest);
  return `${groups.join(',')},${digits.slice(-3)}`;
}

export const rupees = (n) => `₹${grouped(n, true)}`;
export const dollars = (n) => `$${grouped(n, false)}`;

function count(n) {
  return n == null ? 'No limit' : grouped(n, false);
}

/** The family plans as the Plans page shows them (src/app/plus.tsx, 067's rows). */
export const familyPlans = [
  {
    id: 'free',
    name: 'Free',
    price: { inr: 0, usd: 0 },
    yearly: null,
    people: L.members.free,
    space: `${formatBytes(L.freePerson)} per person`,
    questions: `${L.questions.free} per person`,
    expiry: '1 reminder',
    birthdays: false,
    shareDays: 7,
    languages: false,
    gmail: false,
  },
  {
    id: 'plus',
    name: 'Family Plus',
    price: PLUS_PRICE.monthly,
    yearly: PLUS_PRICE.yearly,
    people: L.members.plus,
    space: `${formatBytes(L.plus)} shared`,
    questions: `${count(L.familyQuestions)} shared`,
    expiry: 'For everyone',
    birthdays: true,
    shareDays: 30,
    languages: true,
    gmail: 'Beta',
  },
  {
    id: 'family_pro',
    name: 'Family Pro',
    price: PRO_PRICE.monthly,
    yearly: PRO_PRICE.yearly,
    people: L.familyPro.members,
    space: `${formatBytes(L.familyPro.storage)} shared`,
    questions: `${count(L.familyPro.questions)} shared`,
    expiry: 'For everyone',
    birthdays: true,
    shareDays: 30,
    languages: true,
    gmail: 'Beta',
  },
];

/** A business's plans, before GST, set up on request (051). */
export const businessPlans = [
  { id: 'business_plus', name: 'Plus', ...L.business.business_plus, price: BUSINESS_PRICE.business_plus, yearly: BUSINESS_YEAR_PRICE.business_plus },
  { id: 'business_pro', name: 'Pro', ...L.business.business_pro, price: BUSINESS_PRICE.business_pro, yearly: BUSINESS_YEAR_PRICE.business_pro },
  { id: 'business_enterprise', name: 'Enterprise', ...L.business.business_enterprise, price: BUSINESS_PRICE.business_enterprise, yearly: BUSINESS_YEAR_PRICE.business_enterprise },
];

export const facts = {
  limits: L,
  maxFileMb: MAX_FILE_BYTES / (1024 * 1024),
  freeQuestions: L.questions.free,
  freeMembers: L.members.free,
  freePersonSpace: formatBytes(L.freePerson),
  plus: { monthly: PLUS_PRICE.monthly, yearly: PLUS_PRICE.yearly, members: L.members.plus, space: formatBytes(L.plus), questions: L.familyQuestions },
  pro: { monthly: PRO_PRICE.monthly, yearly: PRO_PRICE.yearly, members: L.familyPro.members, space: formatBytes(L.familyPro.storage), questions: L.familyPro.questions },
  businessFrom: Math.min(...Object.values(BUSINESS_PRICE)),
  graceDays: L.graceDays,
  voiceLanguages: VOICE_LANGUAGES.map((l) => ({ code: l.code, native: l.native, english: l.english.replace(/ \(India\)$/, '') })),
  fileTypes: ['PDF', 'JPG', 'PNG', 'Excel (.xlsx)', 'CSV'],
};

/** "English, Hindi, Bengali, …, Malayalam and Punjabi". */
export function listOf(items) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/**
 * A business's plans as the app's Plans page shows them (src/app/plus.tsx,
 * businessRows()): Free beside Plus, Pro and Enterprise. Prices before GST.
 */
const shared = (b) => (b.questions == null ? 'No limit' : `${grouped(b.questions, false)} ${b.questionsShared ? 'shared' : 'per person'}`);
export const businessColumns = [
  {
    id: 'free', name: 'Free', price: 0, yearly: null,
    people: L.freeBusinessMembers,
    space: `${formatBytes(L.freePerson)} per person`,
    questions: `${L.questions.free} per person`,
    overview: false, money: false, reminders: false, languages: false,
  },
  ...businessPlans.map((b) => ({
    id: b.id, name: b.name, price: b.price, yearly: b.yearly,
    people: b.members,
    space: `${formatBytes(b.storage)} shared`,
    questions: shared(b),
    overview: true, money: b.id !== 'business_plus', reminders: true, languages: true,
  })),
];
