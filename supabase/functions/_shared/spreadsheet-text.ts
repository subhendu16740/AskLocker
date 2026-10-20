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
// ────────────────────────────────────────────────────────────────

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

/** A header is two or more words in a row, none of them a number or a date. */
function wordsOnly(cells: string[]): boolean {
  const filled = cells.filter(Boolean);
  return filled.length >= 2 && !filled.some(isValue);
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
      if (next && wordsOnly(all[i]) && valuesUnder(all[i], next)) { firstHeader = i; break; }
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
    for (let i = 0; i < all.length; i++) {
      const row = all[i];
      if (!row.some(Boolean)) { afterBlank = true; continue; }
      // A second table further down, after a blank row, has its own header.
      const next = nextFilled(i);
      if (i === firstHeader || (afterBlank && header && next && wordsOnly(row) && valuesUnder(row, next))) {
        header = row;
        afterBlank = false;
        continue;
      }
      afterBlank = false;
      const filled = row.map((c, j) => [c, j] as const).filter(([c]) => !!c);
      let line: string;
      if (header && filled.length >= 2) {
        line = filled.map(([c, j]) => `${header![j] || columnName(j)}: ${c}`).join(' | ');
        rows++;
      } else {
        line = filled.map(([c]) => c).join(' | ');
      }
      if (several) line = `[${sheet.name || 'Sheet'}] ${line}`;
      if (!push(line)) {
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
