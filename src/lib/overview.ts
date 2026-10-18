// What the business overview (056) does with what ingest read: amounts as
// written on the page ("1,18,000.00"), dates in the forms dates.ts reads,
// money grouped by month, and rupees written the Indian way. Pure, so the
// screen stays about the screen.

import { parseDocumentDate } from './dates';

/** "1,18,000.00" → 118000; null when nothing readable. */
export function parseAmount(text: string | null | undefined): number | null {
  if (!text) return null;
  const n = Number(text.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 118000 → "₹1,18,000": lakhs and crores, rounded to the rupee. */
export function formatRupees(n: number): string {
  const whole = Math.round(n).toString();
  if (whole.length <= 3) return `₹${whole}`;
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `₹${rest},${last3}`;
}

/** 118000 → "₹1.2L", 45000 → "₹45K": for an axis, never for a value someone reads alone. */
export function compactRupees(n: number): string {
  if (n >= 1e7) return `₹${trim(n / 1e7)}Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)}L`;
  if (n >= 1e3) return `₹${trim(n / 1e3)}K`;
  return `₹${Math.round(n)}`;
}

function trim(x: number): string {
  return (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10).toString();
}

/** Whole days from today (midnight) to the date; negative once it has passed. */
export function daysFromToday(d: Date, today = new Date()): number {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return Math.round((x.getTime() - t.getTime()) / 86_400_000);
}

/** "Today", "Tomorrow", "In 12 days", "2 days ago". */
export function whenText(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Mar 2027". */
export function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export interface MoneyRow {
  kind: 'in' | 'out';
  /** The invoice's own date where ingest read one, else when it was added. */
  date: Date;
  amount: number | null;
}

export interface MonthTotals {
  /** "Oct" */
  label: string;
  year: number;
  month: number;
  in: number;
  out: number;
}

/** The last `months` calendar months, oldest first, each with what came in and went out. */
export function monthlyTotals(rows: MoneyRow[], months = 6, today = new Date()): MonthTotals[] {
  const out: MonthTotals[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push({ label: MONTHS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), in: 0, out: 0 });
  }
  for (const r of rows) {
    if (r.amount == null) continue;
    const slot = out.find((m) => m.year === r.date.getFullYear() && m.month === r.date.getMonth());
    if (slot) slot[r.kind] += r.amount;
  }
  return out;
}

/** Since 1 April, India's financial year: what came in and went out. */
export function financialYearTotals(rows: MoneyRow[], today = new Date()): { from: Date; in: number; out: number } {
  const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const from = new Date(year, 3, 1);
  let inSum = 0;
  let outSum = 0;
  for (const r of rows) {
    if (r.amount == null || r.date < from || r.date > today) continue;
    if (r.kind === 'in') inSum += r.amount; else outSum += r.amount;
  }
  return { from, in: inSum, out: outSum };
}

/** A date as ingest stored it, or the fallback. */
export function readDate(text: string | null | undefined, fallback: Date): Date {
  return (text ? parseDocumentDate(text) : null) ?? fallback;
}
