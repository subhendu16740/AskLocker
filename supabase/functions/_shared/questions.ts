// ─── Questions each month: the allowance, and the words for it (049) ─
//
// A question is the most expensive thing AskLocker does, so each person has
// a monthly allowance: 20 on Free (plan_limits.questions_per_month), and on
// Family Plus no monthly limit for one person, but 200 a month shared by the
// whole family (053: family_questions_per_month; 500 each before). A month
// is a calendar month in India time.
//
// rag-search counts one through claim_question() before it answers, and
// gives it back when no answer came; Ask shows what question_status() says.
// Since 050 each try is counted for the day too (10 a day on Free, 100 on
// Plus), answered or not, and a try is never given back.
// Shared by both, so the app and the answer say the same thing. Pure
// TypeScript: no Deno, no React, so the QA self-test pins it in Node.
// ────────────────────────────────────────────────────────────────

/** What claim_question() / question_status() report for the person asking. */
export interface QuestionAllowance {
  /** Questions asked this month. */
  used: number;
  /** The plan's monthly number; null on a plan without one (Family Plus). */
  limit: number | null;
  /** The most that can be asked this month: the monthly number, or fair use. Null: no ceiling at all. */
  ceiling: number | null;
  /** Left of the ceiling. Null: no ceiling at all. */
  left: number | null;
  /** In a vault on Family Plus. */
  plus: boolean;
  /** The day the count starts again, YYYY-MM-DD. */
  resetsOn: string | null;
  /** Why a question was refused (050): the month's answers, the day's tries, or the family's month (053). */
  reason?: 'month' | 'tries' | 'family' | null;
  /** Questions tried today, and the most a day (050). */
  tries?: number | null;
  triesLimit?: number | null;
  /** The questions the person's family shares this month, and what is left of them (053). */
  familyLimit?: number | null;
  familyUsed?: number | null;
  familyLeft?: number | null;
}

const num = (v: unknown): number | null => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** The database's answer, or null when it is not one (before 049, an error). */
export function parseAllowance(raw: unknown): QuestionAllowance | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!('ceiling' in r) && !('limit' in r)) return null;
  const used = num(r.used) ?? 0;
  const ceiling = num(r.ceiling);
  const left = 'left' in r ? num(r.left) : ceiling == null ? null : Math.max(ceiling - used, 0);
  return {
    used,
    limit: num(r.limit),
    ceiling,
    left,
    plus: r.plus === true,
    resetsOn: typeof r.resets_on === 'string' ? r.resets_on.slice(0, 10) : null,
    // 050's, only when the database said them.
    ...(r.reason === 'tries' || r.reason === 'month' || r.reason === 'family' ? { reason: r.reason } : {}),
    ...(num(r.tries) != null ? { tries: num(r.tries) } : {}),
    ...(num(r.tries_limit) != null ? { triesLimit: num(r.tries_limit) } : {}),
    // 053's, only when the person's family shares a number.
    ...(num(r.family_limit) != null ? {
      familyLimit: num(r.family_limit),
      familyUsed: num(r.family_used) ?? 0,
      familyLeft: num(r.family_left) ?? Math.max((num(r.family_limit) ?? 0) - (num(r.family_used) ?? 0), 0),
    } : {}),
  };
}

const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
} as const;

/** "2026-11-01" → "1 November" (or "1 नवंबर"); null when it cannot be read. */
export function resetDay(resetsOn: string | null, language: 'en' | 'hi' = 'en'): string | null {
  const m = resetsOn?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return null;
  return `${Number(m[3])} ${MONTHS[language][month]}`;
}

const isHindi = (language?: string) => (language ?? 'en').split('-')[0].toLowerCase() === 'hi';

/**
 * What the person reads, and hears, when this month's questions are used up:
 * on Free, that they start again on the 1st and that Family Plus gives more;
 * on Plus, that they asked the most one person can, or that the family's
 * shared month is used up (053).
 */
export function questionLimitMessage(a: QuestionAllowance, language?: string): string {
  const hi = isHindi(language);
  if (a.reason === 'tries') {
    // The day's tries (050): answered or not, so asking again and again
    // cannot spend the AI service's day for everyone.
    const t = a.triesLimit ?? a.tries ?? 0;
    if (hi) {
      return a.plus
        ? `आज के लिए ${t} सवालों की सीमा पूरी हो गई। कल फिर से पूछ सकते हैं।`
        : `Free में आज के लिए ${t} सवालों की सीमा पूरी हो गई। हर सवाल गिना जाता है, जवाब मिले या नहीं। कल फिर से पूछ सकते हैं।`;
    }
    return a.plus
      ? `You've reached today's limit of ${t} questions. You can ask again tomorrow.`
      : `You've reached today's limit of ${t} questions on Free. Every question counts, answered or not. You can ask again tomorrow.`;
  }
  const day = resetDay(a.resetsOn, hi ? 'hi' : 'en');
  if (a.reason === 'family') {
    // The family's shared month (053): one number for everyone in it.
    const f = a.familyLimit ?? a.familyUsed ?? 0;
    if (hi) return `आपके परिवार के इस महीने के ${f} सवाल पूरे हो गए।${day ? ` ये ${day} को फिर से मिलेंगे।` : ' ये अगले महीने फिर से मिलेंगे।'}`;
    return `Your family has used its ${f} questions for this month.${day ? ` They start again on ${day}.` : ' They start again next month.'}`;
  }
  const n = a.ceiling ?? a.used;
  if (hi) {
    const again = day ? ` ये ${day} को फिर से मिलेंगे।` : ' ये अगले महीने फिर से मिलेंगे।';
    return a.plus
      ? `इस महीने के लिए ${n} सवालों की सीमा पूरी हो गई।${again}`
      : `इस महीने के आपके ${n} मुफ़्त सवाल पूरे हो गए।${again} Family Plus में आपके परिवार को और सवाल मिलते हैं।`;
  }
  const again = day ? ` They start again on ${day}.` : ' They start again next month.';
  return a.plus
    ? `You've reached the fair-use limit of ${n} questions this month.${again}`
    : `You've used your ${n} free questions for this month.${again} Family Plus gives your family more.`;
}

/**
 * The line Ask shows: "12 of 20 free questions left this month", or null when
 * there is nothing worth saying (Family Plus, below the fair-use ceiling).
 */
export function questionsLeftText(a: QuestionAllowance): string | null {
  if (a.familyLimit != null && a.familyLeft != null && (a.left == null || a.familyLeft <= a.left)) {
    // Family Plus (053): the family's shared month, once it is close.
    if (a.familyLeft > 50) return null;
    return a.familyLeft === 0
      ? `Your family has used its ${a.familyLimit} questions this month`
      : `${a.familyLeft} of ${a.familyLimit} family questions left this month`;
  }
  if (a.limit == null) {
    // Plus: say nothing until fair use is close.
    if (a.ceiling == null || a.left == null || a.left > 50) return null;
    return a.left === 0
      ? `You've reached this month's fair-use limit`
      : `${a.left} of ${a.ceiling} questions left this month`;
  }
  const left = a.left ?? Math.max(a.limit - a.used, 0);
  if (left === 0) return `You've used your ${a.limit} free questions this month`;
  return `${left} of ${a.limit} free question${a.limit === 1 ? '' : 's'} left this month`;
}

/** The allowance after one question was given back (no answer came of it). */
export function givenBack(a: QuestionAllowance): QuestionAllowance {
  const used = Math.max(a.used - 1, 0);
  const family = a.familyLimit == null ? {} : {
    familyUsed: Math.max((a.familyUsed ?? 0) - 1, 0),
    familyLeft: Math.min((a.familyLeft ?? 0) + 1, a.familyLimit),
  };
  const personLeft = a.ceiling == null ? null : Math.max(a.ceiling - used, 0);
  const left = 'familyLeft' in family && family.familyLeft != null
    ? Math.min(personLeft ?? family.familyLeft, family.familyLeft)
    : personLeft;
  return { ...a, ...family, used, left };
}

/** As the database writes it, for a response the app reads with parseAllowance(). */
export function allowanceJson(a: QuestionAllowance): Record<string, unknown> {
  return {
    used: a.used, limit: a.limit, ceiling: a.ceiling, left: a.left, plus: a.plus, resets_on: a.resetsOn,
    ...(a.reason ? { reason: a.reason } : {}),
    ...(a.tries != null ? { tries: a.tries } : {}),
    ...(a.triesLimit != null ? { tries_limit: a.triesLimit } : {}),
    ...(a.familyLimit != null ? { family_limit: a.familyLimit, family_used: a.familyUsed ?? 0, family_left: a.familyLeft ?? 0 } : {}),
  };
}
