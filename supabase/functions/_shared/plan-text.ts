// ─── What a family may keep, and the words for a full vault (038–041) ─
//
// Shared by the app (src/lib/plans.ts) and Gmail import, so both say the same
// thing when a family's storage is full. Pure TypeScript: no Deno, no React.
//
// Three family plans, each with a limit (039, 048, 064, 066):
//
//   Free          50 MB a vault, family or personal; 50 MB for each person
//                 to add, across their free vaults (060); 2 members
//   Family Plus   500 MB (1 GB before 066), either kind of vault; 4 members;
//                 500 questions a month shared by the family — in India ₹99
//                 a month or ₹999 a year, elsewhere $10 a month or $99 a year
//   Family Pro    2 GB (10 GB before 066); 8 members; 2,000 questions a
//                 month shared — in India ₹199 a month or ₹1,999 a year,
//                 elsewhere $20 a month or $199 a year
//
// Members are the people who sign in; anyone can be in the family tree. Each
// person on Free has 20 questions a month (049), and 10 tries a day; on Plus
// and Pro 50 tries a day each (050). Voice has no limit, in any language, on
// every plan (066; 10 on Free in English before). A share link lasts 1 or 7
// days on Free, and up to 30 days on a paid plan (049). Expiry and birthday
// reminders (048, 064) and Gmail import are for Plus and Pro; reading
// documents in Indian languages for Pro alone (066). On Free a person creates
// one family and one business besides their personal vault (059).
//
// A year costs about ten months. The yearly price is shown against twelve
// months at the monthly price, crossed out (₹1,188 → ₹999, ₹2,388 → ₹1,999),
// with what it saves (₹189) — both worked out here, never typed in: a
// crossed-out price must be one a family could really pay. How a family pays
// never changes what it may keep.
//
// When Family Plus ends (040), a vault above its free limit has 30 days to
// renew or delete documents; then the newest documents above it are removed.
//
// Business vaults (051) have plans of their own, never Family Plus, given by
// hand for now (billed by us, GST on top):
//
//   Free         2 people, 100 MB, 20 questions each a month
//   Plus         5 people,   5 GB, 1,000 questions a month — ₹499 a month
//   Pro         10 people,  25 GB, 5,000 questions a month — ₹999 a month
//   Enterprise  50 people, 100 GB, no monthly limit        — ₹3,999 a month
//
// A business's questions are shared by everyone in it (066; 100 each
// before). A year costs about ten months (₹4,999, ₹9,999, ₹39,999). Reading
// documents in Indian languages comes with Pro and Enterprise. A small
// business may start in a family vault and make it a business vault later,
// keeping everything (054). Nothing is ever removed from a business: when a
// paid plan ends it keeps every record and adds nothing until it is renewed
// ("closed"); a trial that ends puts it back on Free.
//
// The limits live in the database (public.plan_limits), and the server keeps
// them: the documents bucket refuses a new file once a family's files reach
// its plan's limit. The numbers here are only the words used when the
// database cannot be asked. The price is shown, not charged: what is charged
// is the payment company's plan.
// ────────────────────────────────────────────────────────────────

export type BusinessPlan = 'business_plus' | 'business_pro' | 'business_enterprise';
/** A family's paid plans: Family Plus, and Family Pro (064). */
export type FamilyPlan = 'plus' | 'family_pro';
export type PlanName = 'free' | FamilyPlan | BusinessPlan;

export const FAMILY_PLANS: readonly FamilyPlan[] = ['plus', 'family_pro'];

export function isFamilyPlan(plan: string | null | undefined): plan is FamilyPlan {
  return (FAMILY_PLANS as readonly string[]).includes(plan ?? '');
}

export const BUSINESS_PLANS: readonly BusinessPlan[] = ['business_plus', 'business_pro', 'business_enterprise'];

export function isBusinessPlan(plan: string | null | undefined): plan is BusinessPlan {
  return (BUSINESS_PLANS as readonly string[]).includes(plan ?? '');
}

/** A vault's plan and its room, as family_storage_status() reports them. */
export interface StorageRoom {
  plan: PlanName;
  limitBytes: number;
  usedBytes: number;
  /** A personal vault (046), which the words call "your personal vault"; a family otherwise. */
  personal?: boolean;
  /** A business (051), which the words call "your business". */
  business?: boolean;
  /** A business whose paid plan ended: it keeps every record and adds nothing until renewed (051). */
  closed?: boolean;
}

/** A business plan's numbers (051). */
export interface BusinessPlanLimits {
  storage: number;
  members: number;
  /** Questions a month: shared by everyone in the business since 066 (100 each before); null: no monthly limit. */
  questions: number | null;
  /** Whether `questions` is the business's month together (066), not each person's. */
  questionsShared: boolean;
  questionTriesPerDay: number | null;
  uploadsPerDay: number | null;
  invitesPerDay: number;
}

export interface PlanLimits {
  /** What a family may keep on Free, everyone together. */
  free: number;
  /** What a personal vault may keep on Free (048). */
  freePersonal: number;
  /** What a business may keep on Free, everyone together (060; the family number before it). */
  freeBusiness: number;
  /** What one person may add across the vaults they are in on Free (060); null: no number per person. */
  freePerson: number | null;
  /** What a vault may keep on Family Plus, either kind. */
  plus: number;
  /** Family Pro (064): what a vault may keep, its members, and the questions the family shares a month (066; null: no monthly limit). Every other number is Plus's. */
  familyPro: { storage: number; members: number; questions: number | null };
  /** Days a family keeps what is above the free limit after Plus ends (040). */
  graceDays: number;
  /** Members — people who sign in — a family may have, per plan (041). The family tree has no limit. */
  members: { free: number; plus: number };
  /** People a business may have on Free (064's own number; 2 since 066, 4 before). */
  freeBusinessMembers: number;
  /** Voice chats each person gets, per plan; null: no limit (041; per person since 043; none on any plan since 066). */
  voiceAnswers: { free: number | null; plus: number | null };
  /** Questions each person may ask a month, per plan; null: no monthly limit (049). */
  questions: { free: number | null; plus: number | null };
  /** The most one person may ask in a month where there is no monthly limit (049); null: no ceiling (064). */
  questionsFairUse: number | null;
  /** The questions everyone in a vault on Family Plus shares in a month (053; 500 since 066); null: no family number. */
  familyQuestions: number | null;
  /** Questions each person may try in a day, answered or not, per plan; null: no limit (050). */
  questionTriesPerDay: { free: number | null; plus: number | null };
  /** Documents each person may add in a day, per plan; null: no limit (050). */
  uploadsPerDay: { free: number | null; plus: number | null };
  /** Families one person may create on Free, besides their personal vault (050); null: no limit. */
  familiesPerPerson: number | null;
  /** Businesses one person may create on Free (051), apart from families; null: no limit. */
  businessesPerPerson: number | null;
  /** Vaults, families and businesses together, one person may create on Free besides their personal vault (054); null: no combined limit. */
  vaultsPerPerson: number | null;
  /** Notes one person may keep in a business vault, on Free and on a paid plan (056); null: no limit. */
  notesPerPerson: { free: number | null; paid: number | null };
  /** Invitations a vault may send in a day, per plan (050, 051). */
  invitesPerDay: { free: number; plus: number };
  /** A business's plans: Plus, Pro and Enterprise (051). */
  business: Record<BusinessPlan, BusinessPlanLimits>;
}

const GB = 1024 ** 3;

const MB = 1024 ** 2;

/** What 039–066 set; plan_limits is the truth. */
export const DEFAULT_PLAN_LIMITS: PlanLimits = {
  free: 50 * MB,
  freePersonal: 50 * MB,
  freeBusiness: 100 * MB,
  freePerson: 50 * MB,
  plus: 500 * MB,
  familyPro: { storage: 2 * GB, members: 8, questions: 2000 },
  graceDays: 30,
  members: { free: 2, plus: 4 },
  freeBusinessMembers: 2,
  voiceAnswers: { free: null, plus: null },
  questions: { free: 20, plus: null },
  questionsFairUse: 500,
  familyQuestions: 500,
  questionTriesPerDay: { free: 10, plus: 50 },
  uploadsPerDay: { free: 50, plus: 100 },
  familiesPerPerson: 1,
  businessesPerPerson: 1,
  vaultsPerPerson: null,
  notesPerPerson: { free: 20, paid: 500 },
  invitesPerDay: { free: 20, plus: 20 },
  business: {
    business_plus: { storage: 5 * GB, members: 5, questions: 1000, questionsShared: true, questionTriesPerDay: 30, uploadsPerDay: 300, invitesPerDay: 20 },
    business_pro: { storage: 25 * GB, members: 10, questions: 5000, questionsShared: true, questionTriesPerDay: 30, uploadsPerDay: 300, invitesPerDay: 20 },
    business_enterprise: { storage: 100 * GB, members: 50, questions: null, questionsShared: false, questionTriesPerDay: 30, uploadsPerDay: 300, invitesPerDay: 50 },
  },
};

export type PricePeriod = 'monthly' | 'yearly';
export type PriceCurrency = 'inr' | 'usd';
export type PlanPrice = Record<PricePeriod, Record<PriceCurrency, number>>;

/** What Family Plus costs, by the month or by the year (about ten months; 066). */
export const PLUS_PRICE: PlanPrice = {
  monthly: { inr: 99, usd: 10 },
  yearly: { inr: 999, usd: 99 },
};

/** What Family Pro costs (064), by the month or by the year (about ten months; 066). */
export const PRO_PRICE: PlanPrice = {
  monthly: { inr: 199, usd: 20 },
  yearly: { inr: 1999, usd: 199 },
};

/** A family plan's price: what every screen shows and the payments function charges. */
export function familyPrice(plan: FamilyPlan = 'plus'): PlanPrice {
  return plan === 'family_pro' ? PRO_PRICE : PLUS_PRICE;
}

/** "Family Plus" or "Family Pro" (064). */
export function familyPlanName(plan: FamilyPlan = 'plus'): string {
  return plan === 'family_pro' ? 'Family Pro' : 'Family Plus';
}

/** 1000 → "1,000"; in rupees, lakhs group in twos: 100000 → "1,00,000". */
function grouped(amount: number, indian: boolean): string {
  const digits = String(Math.round(amount));
  if (digits.length <= 3) return digits;
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  const size = indian ? 2 : 3;
  while (rest.length > size) {
    groups.unshift(rest.slice(-size));
    rest = rest.slice(0, -size);
  }
  groups.unshift(rest);
  return `${groups.join(',')},${digits.slice(-3)}`;
}

function formatMoney(currency: PriceCurrency, amount: number): string {
  return currency === 'inr' ? `₹${grouped(amount, true)}` : `$${grouped(amount, false)}`;
}

function money(currency: PriceCurrency, period: PricePeriod, plan: FamilyPlan = 'plus'): string {
  return formatMoney(currency, familyPrice(plan)[period][currency]);
}

/**
 * Whether Family Plus can be bought, until asked. Payments are switched on
 * per project, by setting its Razorpay keys (044): the app asks the payments
 * function, and the server reads its own secrets, and both pass the answer
 * as `forSale`. Where neither can tell, the words say "coming soon".
 */
export const PLUS_FOR_SALE = false;

// Each takes the plan last, Family Plus when not said.

/** "₹99 a month", "₹999 a year", "$10 a month", "$99 a year". */
export function plusPrice(currency: PriceCurrency, period: PricePeriod = 'monthly', plan: FamilyPlan = 'plus'): string {
  return `${money(currency, period, plan)} a ${period === 'monthly' ? 'month' : 'year'}`;
}

/** "₹99 a month or ₹999 a year". */
export function plusPrices(currency: PriceCurrency, plan: FamilyPlan = 'plus'): string {
  return `${plusPrice(currency, 'monthly', plan)} or ${plusPrice(currency, 'yearly', plan)}`;
}

/** The amount alone, "₹99" or "₹999", for a narrow column. */
export function plusAmount(currency: PriceCurrency, period: PricePeriod, plan: FamilyPlan = 'plus'): string {
  return money(currency, period, plan);
}

/**
 * Twelve months at the monthly price: "₹1,188", "$120". The yearly price is
 * shown against it, crossed out.
 */
export function plusTwelveMonths(currency: PriceCurrency, plan: FamilyPlan = 'plus'): string {
  return formatMoney(currency, 12 * familyPrice(plan).monthly[currency]);
}

/** "₹999 a year instead of ₹1,188", where a crossed-out price cannot be drawn or seen. */
export function plusYearlyOffer(currency: PriceCurrency, plan: FamilyPlan = 'plus'): string {
  return `${plusPrice(currency, 'yearly', plan)} instead of ${plusTwelveMonths(currency, plan)}`;
}

/** What paying by the year saves, in money: "Save ₹189", "Save $21". */
export function plusYearlySaving(currency: PriceCurrency, plan: FamilyPlan = 'plus'): string {
  const price = familyPrice(plan);
  return `Save ${formatMoney(currency, 12 * price.monthly[currency] - price.yearly[currency])}`;
}

/**
 * The plans with reading documents in Indian languages (066): Family Pro, and
 * a business's Pro and Enterprise. It happens on the device, so it is the
 * app's rule. Voice is in any language on every plan.
 */
export const INDIAN_LANGUAGE_PLANS: readonly PlanName[] = ['family_pro', 'business_pro', 'business_enterprise'];

/** Whether any of a person's plans brings Indian languages (066). */
export function plansHaveIndianLanguages(plans: readonly string[]): boolean {
  return plans.some((p) => (INDIAN_LANGUAGE_PLANS as readonly string[]).includes(p));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < GB) {
    const mb = bytes / 1024 ** 2;
    return `${mb < 100 ? +mb.toFixed(1) : Math.round(mb)} MB`;
  }
  return `${+(bytes / GB).toFixed(2)} GB`;
}

/** What the first paid plan is called in a vault: "Family Plus", or "Plus" in a business (051). */
export function plusName(business?: boolean): string {
  return business ? 'Plus' : 'Family Plus';
}

/** "Plus", "Pro" or "Enterprise": a business plan's name (051). */
export function businessPlanName(plan: BusinessPlan): string {
  return plan === 'business_enterprise' ? 'Enterprise' : plan === 'business_pro' ? 'Pro' : 'Plus';
}

export function planLabel(plan: PlanName, business?: boolean): string {
  if (plan === 'free') return 'the free plan';
  if (plan === 'family_pro') return familyPlanName(plan);
  return isBusinessPlan(plan) ? businessPlanName(plan) : plusName(business);
}

/**
 * What a person on Free may create besides their personal vault: "one family
 * and one business" (050's and 051's numbers, 059), or "one family or one
 * business" while 054's combined number is the tighter one. Null when
 * nothing is said: no limit, or none at all, which the server says itself.
 */
export function freeVaultsText(limits: Pick<PlanLimits, 'familiesPerPerson' | 'businessesPerPerson' | 'vaultsPerPerson'>): string | null {
  const { familiesPerPerson: f, businessesPerPerson: b, vaultsPerPerson: v } = limits;
  if (v === 0) return null;
  if (v != null && (f == null || b == null || v < f + b)) {
    return v === 1 ? 'one family or one business' : `${v} families or businesses in all`;
  }
  const parts = [
    f != null && f > 0 ? (f === 1 ? 'one family' : `${f} families`) : null,
    b != null && b > 0 ? (b === 1 ? 'one business' : `${b} businesses`) : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join(' and ') : null;
}

/**
 * What a business pays a month for each plan, in rupees, before GST (051;
 * 066's prices). Billed by hand for now, so shown, never charged by the app.
 */
export const BUSINESS_PRICE: Record<BusinessPlan, number> = {
  business_plus: 499,
  business_pro: 999,
  business_enterprise: 3999,
};

/** What a business pays for a year, about ten months (066). */
export const BUSINESS_YEAR_PRICE: Record<BusinessPlan, number> = {
  business_plus: 4999,
  business_pro: 9999,
  business_enterprise: 39999,
};

/** The amount alone, "₹999" (or a year's, "₹9,999"), for a narrow column. */
export function businessAmount(plan: BusinessPlan, period: PricePeriod = 'monthly'): string {
  return formatMoney('inr', period === 'yearly' ? BUSINESS_YEAR_PRICE[plan] : BUSINESS_PRICE[plan]);
}

/** "₹999 a month + GST". */
export function businessPrice(plan: BusinessPlan): string {
  return `${businessAmount(plan)} a month + GST`;
}

/** "₹9,999 a year + GST". */
export function businessYearPrice(plan: BusinessPlan): string {
  return `${businessAmount(plan, 'yearly')} a year + GST`;
}

/** The business plan above this one, if any: Free → Plus → Pro → Enterprise. */
export function nextBusinessPlan(plan: PlanName): BusinessPlan | null {
  if (plan === 'business_enterprise') return null;
  if (plan === 'business_pro') return 'business_enterprise';
  return plan === 'business_plus' ? 'business_pro' : 'business_plus';
}

/** "your personal vault", "your business" or "your family": how the words name a vault. */
function yours(room: StorageRoom): string {
  return room.personal ? 'your personal vault' : room.business ? 'your business' : 'your family';
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** For a business whose paid plan ended (051). */
export const CLOSED_MESSAGE = "Your business's plan has ended. Your records stay. To add new ones, renew the plan.";

/** Whether a file of this size fits in what the family has left. Nothing fits in a closed business (051). */
export function fits(room: StorageRoom, fileBytes: number): boolean {
  return !room.closed && room.usedBytes + fileBytes <= room.limitBytes;
}

export interface StorageMessageOptions {
  limits?: PlanLimits;
  /** Family Plus's price where the person is ("₹99 a month or ₹999 a year"); the server, which cannot tell, leaves it out. */
  price?: string;
  /** For a family whose Plus has ended: the day its documents above the free limit go ("4 Nov 2026"). */
  removalOn?: string;
  /** Whether Family Plus can be bought here (044); PLUS_FOR_SALE when not said. */
  forSale?: boolean;
}

/** Why a file does not fit, and what the vault's people can do about it. */
export function storageFullMessage(room: StorageRoom, fileBytes = 0, options: StorageMessageOptions = {}): string {
  const { limits = DEFAULT_PLAN_LIMITS, price, removalOn, forSale = PLUS_FOR_SALE } = options;
  if (room.closed) return CLOSED_MESSAGE;
  const left = Math.max(0, room.limitBytes - room.usedBytes);
  const head = left === 0 || fileBytes === 0
    ? `${room.personal ? 'Your personal vault' : room.business ? "Your business's storage" : "Your family's storage"} is full, with ${formatBytes(room.usedBytes)} of ${formatBytes(room.limitBytes)} used.`
    : `This file is ${formatBytes(fileBytes)}, but ${yours(room)} has only ${formatBytes(left)} left.`;

  const free = "Delete documents you don't need";
  const plus = `${formatBytes(limits.plus)}${price ? ` for ${price}` : ''}`;
  const name = plusName(room.business);
  let more: string;
  if (room.business) {
    // A business moves up a plan with us, not in the app (051).
    const next = nextBusinessPlan(room.plan);
    more = next
      ? `Delete records you don't need, or move to ${businessPlanName(next)} for ${formatBytes(limits.business[next].storage)}.`
      : "Delete records you don't need to make room.";
  } else if (room.plan === 'free' && removalOn) {
    more = `Family Plus has ended. On ${removalOn}, the newest documents over ${formatBytes(room.limitBytes)} will be removed. Renew, or delete documents to get under ${formatBytes(room.limitBytes)}.`;
  } else if (room.plan === 'free') {
    more = forSale
      ? `${free}, or move to ${name} and get ${plus}.`
      : `${free}. ${name} is coming soon, with ${plus}.`;
  } else if (room.plan === 'plus' && forSale && limits.familyPro.storage > room.limitBytes) {
    more = `${free}, or move to Family Pro and get ${formatBytes(limits.familyPro.storage)}.`;
  } else {
    more = `${free} to make room.`;
  }
  return `${head} ${more}`;
}

/** What one person on Free has added across their free vaults, and their number (060). */
export interface PersonRoom {
  usedBytes: number;
  limitBytes: number;
}

/** Whether a file of this size fits in what the person has left on Free (060). */
export function personFits(person: PersonRoom, fileBytes: number): boolean {
  return person.usedBytes + fileBytes <= person.limitBytes;
}

/**
 * Why a file does not fit in what one person may add on Free (060), and what
 * they can do: delete what they added, or move the vault to a paid plan,
 * where their files no longer count.
 */
export function personStorageFullMessage(
  person: PersonRoom, fileBytes = 0, options: { business?: boolean; forSale?: boolean } = {},
): string {
  const { business = false, forSale = PLUS_FOR_SALE } = options;
  const left = Math.max(0, person.limitBytes - person.usedBytes);
  const each = `the ${formatBytes(person.limitBytes)} each person can add on Free`;
  const head = left === 0 || fileBytes === 0
    ? `You've added ${formatBytes(person.usedBytes)} of ${each}.`
    : `This file is ${formatBytes(fileBytes)}, but you have only ${formatBytes(left)} left of ${each}.`;
  const name = plusName(business);
  const more = business
    ? "Delete records you added, or move this business to a paid plan."
    : forSale
      ? `Delete documents you added, or move this vault to ${name}.`
      : `Delete documents you added to make room. ${name} is coming soon.`;
  return `${head} ${more}`;
}

/**
 * Why a chat cannot be saved (042: saved chats take the family's storage
 * too), and what to do: Family Plus on the free plan, making room on Plus.
 */
export function chatStorageFullMessage(room: StorageRoom, options: Omit<StorageMessageOptions, 'removalOn'> = {}): string {
  const { limits = DEFAULT_PLAN_LIMITS, price, forSale = PLUS_FOR_SALE } = options;
  const head = `There's no room to save this chat. ${capital(yours(room))} has used ${formatBytes(room.usedBytes)} of ${formatBytes(room.limitBytes)}.`;
  if (room.business) {
    const next = nextBusinessPlan(room.plan);
    return next
      ? `${head} To save more, move to ${businessPlanName(next)} for ${formatBytes(limits.business[next].storage)}. Or delete records you don't need.`
      : `${head} Delete records or saved chats you don't need to make room.`;
  }
  if (room.plan === 'plus' && forSale && limits.familyPro.storage > room.limitBytes) {
    return `${head} To save more, move to Family Pro and get ${formatBytes(limits.familyPro.storage)}. Or delete documents you don't need.`;
  }
  if (room.plan !== 'free') return `${head} Delete documents or saved chats you don't need to make room.`;
  const plus = `${formatBytes(limits.plus)}${price ? ` for ${price}` : ''}`;
  const name = plusName(room.business);
  return forSale
    ? `${head} To save more, move to ${name} and get ${plus}. Or delete documents you don't need.`
    : `${head} ${name} is coming soon, with ${plus}. Until then, delete documents you don't need.`;
}
