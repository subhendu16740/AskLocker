// ─── A spreadsheet as text: every row says what its numbers are ──
//
// Pure, so the app (which reads .xlsx and .csv itself, src/lib/spreadsheet.ts),
// the server (which reads a .csv sent without text, ingest.ts) and
// qa/tools/selftest.mjs all keep one set of rules.
//
// A table written out as plain lines loses two things, measured on 20
// October 2026: which column a number is in, once a cell is blank (is
// "1,240.00" a debit or a credit?), and the header, which stays in the first
// passage of a long table while search reads passages one by one. So each
// row carries its column names, and a workbook with several sheets names the
// sheet on every row:
//
//   Spreadsheet: Household expenses 2026.xlsx
//   Sheet: Expenses
//   Household expenses 2026
//   Month: Jan | Rent: 18000 | Groceries: 9420 | Total: 48230
//
// Blank cells are left out, so a row says only what it holds. Dates are
// written DD/MM/YYYY, as ingest's expiry reader expects (metadata.ts).
//
// A column named by a period is named as a person says it: "2025M01",
// "2025-01", "Jan-25" and Excel's month dates become "Jan 2025", so "the Jan
// 2025 figure" finds it. A row too long for one passage is written as
// several lines, each starting with what the row is ("Segment: Treasury |
// Country: India"), and chunking.ts never cuts a spreadsheet mid-line: on 20
// October 2026 a passage held the end of one row, its numbers without its
// name, beside the next row, and the answer read them as that row's.
// ────────────────────────────────────────────────────────────────

import { estimateTokens } from './tokens.ts';

export type SheetCell = string | number | boolean | Date | null | undefined;

export interface SheetInput {
  name: string;
  rows: SheetCell[][];
}

export interface SpreadsheetText {
  text: string;
  /** Sheets with something in them. */
  sheets: number;
  /** Rows written under a header: the table rows. */
  rows: number;
  /** Cut to `maxChars`: the rest of the workbook was not read. */
  truncated: boolean;
}

/** The spreadsheet kinds AskLocker reads. An old .xls is not one: Excel saves it as .xlsx. */
export const SPREADSHEET_TYPES = ['xlsx', 'csv'] as const;
export type SpreadsheetType = (typeof SPREADSHEET_TYPES)[number];

export function isSpreadsheetType(type: string | null | undefined): type is SpreadsheetType {
  return !!type && (SPREADSHEET_TYPES as readonly string[]).includes(type);
}

/** Leaves room under the server's 500,000 characters (limits.ts) for the lines around the rows. */
export const SPREADSHEET_TEXT_MAX = 400_000;

/** Every spreadsheet's text starts with this line; chunking.ts splits such text only between lines. */
const FIRST_LINE = 'Spreadsheet: ';

export function isSpreadsheetText(text: string): boolean {
  return text.startsWith(FIRST_LINE);
}

/**
 * The longest a line may be, in tokens (tokens.ts), so one fits in a passage
 * by itself: chunking.ts aims at 320. A row of numbers runs about 2
 * characters a token, so a wide one is written as several lines.
 */
export const MAX_ROW_TOKENS = 300;

const pad = (n: number) => String(n).padStart(2, '0');

/** One cell as a person would read it: dates DD/MM/YYYY, whole numbers without ".0", no float noise. */
export function cellText(value: SheetCell): string {
  if (value == null) return '';
  if (value instanceof Date) {
    const t = value.getTime();
    if (Number.isNaN(t)) return '';
    const time = `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
    // A time with no date is stored on Excel's day zero, 30 December 1899.
    if (value.getUTCFullYear() < 1900) return time;
    const day = `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`;
    return value.getUTCHours() || value.getUTCMinutes() ? `${day} ${time}` : day;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)));
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).replace(/\s+/g, ' ').trim();
}

// A number or an amount as a cell holds it: "18000", "1,09,510.00", "₹ 500", "-2.5", "12%".
const isNumberLike = (s: string) => /^[-+(]?[\d,]*\.?\d+\)?%?$/.test(s.replace(/[₹$€£\s]|Rs\.?|INR/gi, ''));
const isDateLike = (s: string) => /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}( \d{1,2}:\d{2})?$/.test(s) || /^\d{1,2}:\d{2}$/.test(s);
const isValue = (s: string) => isNumberLike(s) || isDateLike(s);
const isYear = (s: string) => /^(19|20)\d{2}$/.test(s);

/** Two or more words in a row, none of them a number or a date. */
function wordsOnly(cells: string[]): boolean {
  const filled = cells.filter(Boolean);
  return filled.length >= 2 && !filled.some(isValue);
}

/**
 * A header names its columns: words, or periods over the numbers under them
 * ("Segment | Jan 2025 | Feb 2025" saved as Excel dates, "Item | 2023 |
 * 2024"). A row of dates over dates, or with amounts in it, is data.
 */
function headerLike(cells: string[], next: string[] | null): boolean {
  if (wordsOnly(cells)) return true;
  if (!next) return false;
  const values = cells.map((c, i) => [c, i] as const).filter(([c]) => !!c && isValue(c));
  return values.length >= 2
    && values.every(([c, i]) => (isDateLike(c) || isYear(c)) && (!next[i] || isNumberLike(next[i])))
    && values.some(([, i]) => !!next[i]);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const monthIndex = (word: string) => {
  const w = word.toLowerCase();
  return w.length < 3 ? -1 : MONTH_NAMES.findIndex((m) => m.startsWith(w));
};
const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/**
 * A column named by a period in a code, as a person says it: "2025M01",
 * "2025-01", "01/2025", "Jan-25" → "Jan 2025"; "2025Q1", "Q1-25" →
 * "Q1 2025". Anything else stays as written: "January 2025", a financial
 * year ("2011-12"), and "Dec 31", which may be a day.
 */
export function periodLabel(label: string): string {
  const s = label.trim();
  const month = (y: number, mo: number) => (mo >= 1 && mo <= 12 && y >= 1900 && y <= 2100 ? `${MONTHS[mo - 1]} ${y}` : s);
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})\s*[-/. ]?\s*M(\d{1,2})$/i))) return month(+m[1], +m[2]);
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})$/))) {
    return (+m[1] + 1) % 100 === +m[2] && m[2].length === 2 ? s : month(+m[1], +m[2]);
  }
  if ((m = s.match(/^(\d{1,2})[-/.](\d{4})$/))) return month(+m[2], +m[1]);
  if ((m = s.match(/^([A-Za-z]{3,9})\.?(?:\s*[-'’_/.]\s*)?(\d{2}|\d{4})$/))) {
    const i = monthIndex(m[1]);
    if (i >= 0) return `${MONTHS[i]} ${fullYear(m[2])}`;
  }
  if ((m = s.match(/^(\d{4})\s*[-/ ]?\s*Q([1-4])$/i))) return `Q${m[2]} ${m[1]}`;
  if ((m = s.match(/^Q([1-4])\s*[-/ '’]?\s*(\d{2}|\d{4})$/i))) return `Q${m[1]} ${fullYear(m[2])}`;
  return s;
}

/**
 * A header's names as rows will carry them. Dates across a header that all
 * fall on the 1st, or all on the last day of their month, are months, as
 * Excel shows a column formatted "Jan-25".
 */
function headerLabels(header: string[]): string[] {
  const dates = header.map((c) => c.match(/^(\d{2})\/(\d{2})\/(\d{4})$/));
  const found = dates.filter((d): d is RegExpMatchArray => !!d);
  const lastDay = (d: RegExpMatchArray) => +d[1] === new Date(Date.UTC(+d[3], +d[2], 0)).getUTCDate();
  const monthly = found.length >= 2 && (found.every((d) => d[1] === '01') || found.every(lastDay));
  return header.map((c, i) => {
    const d = dates[i];
    return d && monthly ? `${MONTHS[+d[2] - 1]} ${d[3]}` : periodLabel(c);
  });
}

/** The row under a header holds a number or a date where the header holds a word. */
function valuesUnder(header: string[], row: string[]): boolean {
  return row.some((c, i) => !!c && isValue(c) && !!header[i]);
}

function columnName(i: number): string {
  let n = i + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return `Column ${s}`;
}

/**
 * One row as lines of at most MAX_ROW_TOKENS: usually one. A wider row is
 * written as several, each opening with what the row is, its leading words
 * ("RowId: FIN-035 | Segment: Treasury | Country: India | Metric: Loans"), so
 * no line holds numbers without the row they belong to.
 */
function splitRow(parts: (readonly [text: string, value: string])[], prefix: string): string[] {
  const whole = prefix + parts.map(([t]) => t).join(' | ');
  if (estimateTokens(whole) <= MAX_ROW_TOKENS) return [whole];
  if (parts.length === 1) return slices(parts[0][0], MAX_ROW_TOKENS - estimateTokens(prefix)).map((t) => prefix + t);
  let named = 0;
  while (named < parts.length - 1 && named < 4 && !isValue(parts[named][1])) named++;
  let start = Math.max(1, named);
  let head = prefix + parts.slice(0, start).map(([t]) => t).join(' | ');
  if (estimateTokens(head) > MAX_ROW_TOKENS / 4) {
    // A name too long to repeat: its opening names each line, and it is
    // written in full on the lines.
    head = prefix + parts[0][0].slice(0, 120);
    start = 0;
  }
  // A cell too long for a line with the name (a paragraph of notes) is
  // written across several.
  const room = MAX_ROW_TOKENS - estimateTokens(head) - 2;
  const pieces = parts.slice(start).flatMap(([t]) => slices(t, room));
  const lines: string[] = [];
  let line = head;
  let has = false;
  for (const piece of pieces) {
    if (has && estimateTokens(`${line} | ${piece}`) > MAX_ROW_TOKENS) {
      lines.push(line);
      line = head;
      has = false;
    }
    line = `${line} | ${piece}`;
    has = true;
  }
  if (has || !lines.length) lines.push(line);
  return lines;
}

/** Text cut on spaces into pieces of no more than `room` tokens. */
function slices(text: string, room: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (estimateTokens(rest) > room) {
    const fit = Math.max(20, Math.floor((room * rest.length) / estimateTokens(rest)));
    const space = rest.lastIndexOf(' ', fit);
    const cut = space > fit / 2 ? space : fit;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * A workbook as text: its name, each sheet's name, the lines above a table
 * as they are, and every table row as "Header: value | Header: value".
 */
export function spreadsheetText(fileName: string, input: SheetInput[], maxChars = SPREADSHEET_TEXT_MAX): SpreadsheetText {
  const sheets = input
    .map((s) => ({ name: cellText(s.name), rows: s.rows.map((r) => (r ?? []).map(cellText)) }))
    .filter((s) => s.rows.some((r) => r.some(Boolean)));
  const lines: string[] = [`Spreadsheet: ${cellText(fileName)}`];
  let length = lines[0].length + 1;
  let rows = 0;
  let truncated = false;
  let left = 0;
  const several = sheets.length > 1;

  for (const sheet of sheets) {
    const all = sheet.rows;
    if (truncated) { left += all.filter((r) => r.some(Boolean)).length; continue; }
    const push = (line: string) => {
      if (length + line.length + 1 > maxChars) { truncated = true; return false; }
      lines.push(line);
      length += line.length + 1;
      return true;
    };
    // A CSV has one sheet and no name for it: no Sheet line.
    if (sheet.name && !push(`Sheet: ${sheet.name}`)) { left += all.filter((r) => r.some(Boolean)).length; continue; }

    // The next row with something in it, after index i.
    const nextFilled = (i: number) => {
      for (let j = i + 1; j < all.length; j++) if (all[j].some(Boolean)) return all[j];
      return null;
    };
    // The first header: words over values within the first 20 rows; else
    // words over anything, for an all-words list (names and relations).
    let firstHeader = -1;
    let seen = 0;
    for (let i = 0; i < all.length && seen < 20; i++) {
      if (!all[i].some(Boolean)) continue;
      seen++;
      const next = nextFilled(i);
      if (next && headerLike(all[i], next) && valuesUnder(all[i], next)) { firstHeader = i; break; }
    }
    if (firstHeader < 0) {
      seen = 0;
      for (let i = 0; i < all.length && seen < 20; i++) {
        if (!all[i].some(Boolean)) continue;
        seen++;
        if (wordsOnly(all[i]) && nextFilled(i)) { firstHeader = i; break; }
      }
    }

    let header: string[] | null = null;
    let afterBlank = false;
    const prefix = several ? `[${sheet.name || 'Sheet'}] ` : '';
    for (let i = 0; i < all.length; i++) {
      const row = all[i];
      if (!row.some(Boolean)) { afterBlank = true; continue; }
      // A second table further down, after a blank row, has its own header.
      const next = nextFilled(i);
      if (i === firstHeader || (afterBlank && header && next && headerLike(row, next) && valuesUnder(row, next))) {
        header = headerLabels(row);
        afterBlank = false;
        continue;
      }
      afterBlank = false;
      const filled = row.map((c, j) => [c, j] as const).filter(([c]) => !!c);
      let rowLines: string[];
      if (header && filled.length >= 2) {
        rowLines = splitRow(filled.map(([c, j]) => [`${header![j] || columnName(j)}: ${c}`, c] as const), prefix);
        rows++;
      } else {
        rowLines = splitRow(filled.map(([c]) => [c, c] as const), prefix);
      }
      if (!rowLines.every(push)) {
        left += all.slice(i).filter((r) => r.some(Boolean)).length;
        break;
      }
    }
  }
  if (truncated) lines.push(`(${left} more rows not read)`);
  return { text: lines.join('\n'), sheets: sheets.length, rows, truncated };
}

/**
 * A CSV file's rows: RFC 4180 quoting ("a, b", doubled quotes, line breaks in
 * a quoted cell), and whichever of comma, semicolon, tab or bar the first
 * line uses most. Excel in some regions saves CSV with semicolons.
 */
export function parseCsv(text: string, maxRows = 50_000): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.search(/\r?\n/) < 0 ? undefined : src.search(/\r?\n/));
  const unquoted = firstLine.replace(/"[^"]*"/g, '');
  const delimiter = [',', ';', '\t', '|']
    .map((d) => [d, unquoted.split(d).length - 1] as const)
    .sort((a, b) => b[1] - a[1])[0];
  const sep = delimiter[1] > 0 ? delimiter[0] : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
      if (rows.length >= maxRows) return rows;
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
