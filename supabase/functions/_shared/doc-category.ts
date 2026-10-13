// ─── A category to suggest for a new document (051) ─────────────
//
// Upload picks a category from the file's name and, where the browser has
// read the page already (a photo, OCR'd on the device), its text. Only a
// suggestion: the person can tap another, and it is never sent anywhere.
// It suggests only from the vault's own list — a business's for a business
// vault, a family's otherwise: a laptop bill in a family vault is not a
// Sales Invoice.
//
// Pure: the app imports it, and qa/tools/selftest.mjs pins every rule.
// Names are the built-in categories' names exactly (document_categories,
// migrations 003 and 051); the app maps a name to its row.
// ────────────────────────────────────────────────────────────────

export type CategoryAudience = 'family' | 'business';

export interface CategoryClue {
  fileName?: string | null;
  text?: string | null;
  audience: CategoryAudience;
}

type Rule = [pattern: RegExp, category: string];

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

const FAMILY_RULES: Rule[] = [
  [/passport/, 'Passport'],
  [/\bitr ?[1-7]?\b|income tax return|form ?16a?\b|\b26as\b/, 'Tax Returns'],
  [/aadhaa?r|\buidai\b/, 'National ID / Aadhaar'],
  [/\bpan card\b|\be ?pan\b|permanent account number/, 'PAN Card'],
  [/driving licen[cs]e|\bdl no\b/, 'Driving License'],
  [/voter|election commission|\bepic\b/, 'Voter ID'],
  [/birth certificate/, 'Birth Certificate'],
  [/marriage certificate/, 'Marriage Certificate'],
  [/death certificate/, 'Death Certificate'],
  [/health insurance|mediclaim|hospitali[sz]ation/, 'Health Insurance'],
  [/life insurance|term (?:plan|insurance)|sum assured/, 'Life Insurance'],
  [/motor insurance|vehicle insurance|car insurance|two ?wheeler|chassis/, 'Vehicle Insurance'],
  [/prescription|\brx\b/, 'Prescriptions'],
  [/discharge summary|lab report|blood test|medical report|diagnos/, 'Medical Records'],
  [/bank statement|account statement|passbook/, 'Bank Statements'],
  [/electricity bill|water bill|gas bill|broadband|mobile bill|utility/, 'Utility Bills'],
  [/\bvisa\b|boarding pass|e ?ticket|itinerary|\bpnr\b/, 'Visa / Travel Docs'],
  [/mark ?sheet|\bdegree\b|diploma|certificate of (?:passing|completion)|transcript/, 'Educational Certificates'],
  [/offer letter|appointment letter|salary slip|pay ?slip|relieving letter/, 'Employment Letters'],
  [/sale deed|property|\bkhata\b|registry/, 'Property Documents'],
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
  for (const [pattern, category] of rules) {
    if (pattern.test(haystack)) return category;
  }
  return null;
}

/**
 * The built-in category a document most likely belongs to, or null. The
 * file's name speaks first (a person named it), then the start of its text.
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
