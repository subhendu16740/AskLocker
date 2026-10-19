// ─── What kind of document is this? (051, and the usage counts) ──
//
// Upload suggests a category from the file's name and, where the browser has
// read the page already (a photo, OCR'd on the device), its text. Only a
// suggestion, and never a default: nothing is picked when nothing says, so
// an unsorted document is never filed as whatever came first in the list (it
// once made every one a "Bank Statements"). The person can tap another, and
// the suggestion is never sent anywhere. It suggests only from the vault's
// own list — a business's for a business vault, a family's otherwise: a
// laptop bill in a family vault is not a Sales Invoice.
//
// Also the built-in names, Upload's order, and a category's name as the usage
// counts send it (countedCategory: built-in names only).
//
// Pure: the app imports it, and qa/tools/selftest.mjs pins every rule.
// Names are the built-in categories' names exactly (document_categories,
// migrations 003 and 051); the app maps a name to its row.
// ────────────────────────────────────────────────────────────────

export type CategoryAudience = 'family' | 'business';

/** A family's built-in categories (003). "Other" is in both lists. */
export const FAMILY_CATEGORIES = [
  'Passport', 'National ID / Aadhaar', 'PAN Card', 'Driving License', 'Voter ID',
  'Health Insurance', 'Vehicle Insurance', 'Life Insurance',
  'Bank Statements', 'Tax Returns', 'Property Documents', 'Medical Records', 'Prescriptions',
  'Birth Certificate', 'Marriage Certificate', 'Death Certificate',
  'Educational Certificates', 'Employment Letters', 'Legal Documents',
  'Utility Bills', 'Visa / Travel Docs', 'Warranty Cards', 'Other',
] as const;

/** A business's built-in categories (051), besides the shared "Other". */
export const BUSINESS_CATEGORIES = [
  'Sales Invoices', 'Purchase Bills', 'GST Returns', 'Contracts & Agreements', 'Licences & Registrations',
  'Bank & Loans', 'Business Insurance', 'Employee Records', 'Payroll', 'Lease & Property', 'Tax (ITR/TDS)',
] as const;

/** Every built-in category, by its name in document_categories. */
export const BUILT_IN_CATEGORIES: readonly string[] = [...FAMILY_CATEGORIES, ...BUSINESS_CATEGORIES];

/** Shown first on a family's Upload; a business's list keeps its own order. */
export const COMMON_CATEGORIES: readonly string[] = [
  'Passport', 'National ID / Aadhaar', 'PAN Card', 'Driving License',
  'Health Insurance', 'Vehicle Insurance', 'Bank Statements', 'Tax Returns',
  'Property Documents', 'Medical Records',
];

/**
 * Upload's order: a family's common ones, then its other built-ins, then a
 * business's in their own order, then a vault's own categories, "Other" last.
 */
export function categoryOrder(name: string): number {
  const common = COMMON_CATEGORIES.indexOf(name);
  if (common >= 0) return common;
  if (name === 'Other') return 1100;
  const family = (FAMILY_CATEGORIES as readonly string[]).indexOf(name);
  if (family >= 0) return 100 + family;
  const business = (BUSINESS_CATEGORIES as readonly string[]).indexOf(name);
  return business >= 0 ? 200 + business : 1000;
}

/** A category's name for counting: built-in names as they are, a vault's own "Other", none "None". */
export function countedCategory(name: string | null | undefined, isSystem?: boolean | null): string {
  if (!name) return 'None';
  return isSystem !== false && BUILT_IN_CATEGORIES.includes(name) ? name : 'Other';
}

export interface CategoryClue {
  fileName?: string | null;
  text?: string | null;
  audience: CategoryAudience;
}

type Rule = [pattern: RegExp | ((t: string) => boolean), category: string];

// Order matters: the first rule that matches decides. The more specific
// come first (a payslip mentions TDS, a lease is an agreement).
const BUSINESS_RULES: Rule[] = [
  [/\bgstr ?(?:1|2a|2b|3b|4|9|9c)\b|\bgst return/, 'GST Returns'],
  [/\bfssai\b|\budyam\b|\budyog aadhaa?r\b|shop (?:and|&) establishment|trade licen[cs]e|\breg ?06\b|registration certificate|certificate of registration|import export code|\biec\b|drug licen[cs]e|fire noc/, 'Licences & Registrations'],
  [/pay ?slip|salary (?:slip|register|sheet|statement)|payroll|wage register|\bpf (?:challan|ecr)\b|\becr\b|provident fund|\besic\b/, 'Payroll'],
  [/\bitr ?[1-7]?\b|income tax return|\btds\b|form ?16a?\b|\b26as\b|advance tax|challan 28[01]\b/, 'Tax (ITR/TDS)'],
  [/\blease\b|rent(?:al)? agreement|leave (?:and|&) licen[cs]e|tenancy|property tax|sale deed|\bkhata\b/, 'Lease & Property'],
  [/agreement|contract|\bmou\b|memorandum of understanding|\bnda\b|non ?disclosure|partnership deed/, 'Contracts & Agreements'],
  [/purchase (?:order|bill|invoice)|\bpo (?:no|number)\b|supplier|vendor (?:bill|invoice)|bill of supply|goods received|\bgrn\b/, 'Purchase Bills'],
  [/tax invoice|\binvoice\b|proforma|credit note|debit note|e ?way bill|delivery challan/, 'Sales Invoices'],
  [/bank statement|account statement|\bloan\b|sanction letter|\bemi\b|overdraft|cash credit|passbook|fixed deposit/, 'Bank & Loans'],
  [/insurance|policy schedule|sum insured/, 'Business Insurance'],
  [/offer letter|appointment letter|relieving letter|experience letter|joining|employee|resume|curriculum vitae|attendance/, 'Employee Records'],
];

// A visa names a passport, and an income-tax return names a PAN, so the
// specific comes first (a "Visa card" on a statement is not a visa). A PAN
// card's own words are often only "Income Tax Department" and the number.
const FAMILY_RULES: Rule[] = [
  [(t) => /boarding pass|\be ?ticket\b|itinerary|\bpnr\b|\birctc\b|electronic reservation slip/.test(t)
    || (/\bvisa\b/.test(t) && !/\bvisa (?:card|debit|credit|signature|platinum|classic|gold|infinite)\b/.test(t)), 'Visa / Travel Docs'],
  [/passport/, 'Passport'],
  [/\bitr ?[1-7]?\b|income tax return|form ?16a?\b|\b26as\b|assessment year/, 'Tax Returns'],
  [/aadhaa?r|\buidai\b/, 'National ID / Aadhaar'],
  [(t) => /\bpan card\b|\be ?pan\b|permanent account number/.test(t)
    || (/income tax department/.test(t) && /\b[a-z]{5}\d{4}[a-z]\b/.test(t)), 'PAN Card'],
  [/driving licen[cs]e|\bdl no\b/, 'Driving License'],
  [/voter|election commission|\bepic\b/, 'Voter ID'],
  [/birth certificate/, 'Birth Certificate'],
  [/marriage certificate/, 'Marriage Certificate'],
  [/death certificate/, 'Death Certificate'],
  [(t) => /health insurance|mediclaim|hospitali[sz]ation/.test(t)
    || (/insurance|policy/.test(t) && /\bhealth\b/.test(t)), 'Health Insurance'],
  [/life insurance|term (?:plan|insurance)|sum assured/, 'Life Insurance'],
  [/motor insurance|vehicle insurance|car insurance|two ?wheeler|chassis/, 'Vehicle Insurance'],
  [/prescription|\brx\b/, 'Prescriptions'],
  [/discharge summary|lab report|blood test|medical report|diagnos/, 'Medical Records'],
  [/bank statement|account statement|passbook|fixed deposit/, 'Bank Statements'],
  [/electricity bill|water bill|gas bill|broadband|mobile bill|utility|gas booking|\blpg\b|water tax/, 'Utility Bills'],
  [/mark ?sheet|\bdegree\b|diploma|certificate of (?:passing|completion)|transcript/, 'Educational Certificates'],
  [/offer letter|appointment letter|salary slip|pay ?slip|relieving letter/, 'Employment Letters'],
  [/sale deed|property|\bkhata\b|registry|rent(?:al)? agreement/, 'Property Documents'],
  [/warranty|guarantee card/, 'Warranty Cards'],
  [/affidavit|power of attorney|legal notice|\bcourt\b/, 'Legal Documents'],
];

/** "Sharma_Traders-Invoice.0042.pdf" → "sharma traders invoice 0042": words a rule can read. */
function words(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\.(pdf|jpe?g|png)$/i, '')
    .replace(/[_\-./\\()[\]{},:;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(rules: Rule[], haystack: string): string | null {
  for (const [rule, category] of rules) {
    if (typeof rule === 'function' ? rule(haystack) : rule.test(haystack)) return category;
  }
  return null;
}

/**
 * The built-in category a document most likely belongs to, or null when
 * nothing says. The file's name speaks first (a person named it), then the
 * start of its text.
 */
export function suggestCategory({ fileName, text, audience }: CategoryClue): string | null {
  const rules = audience === 'business' ? BUSINESS_RULES : FAMILY_RULES;
  for (const haystack of [words(fileName), words((text ?? '').slice(0, 4000))]) {
    const hit = haystack ? firstMatch(rules, haystack) : null;
    if (hit) return hit;
  }
  return null;
}

/** Every category name the rules can suggest, per list, for the self-test. */
export const SUGGESTED_CATEGORIES: Record<CategoryAudience, readonly string[]> = {
  business: [...new Set(BUSINESS_RULES.map(([, c]) => c))],
  family: [...new Set(FAMILY_RULES.map(([, c]) => c))],
};
