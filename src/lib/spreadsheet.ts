// ─── Reading a spreadsheet in the app ───────────────────────────
//
// A spreadsheet is read here, when it is added, as a photo is read by OCR
// (ocr.ts), and its rows go to the server as the document's text. The rules
// for that text, a row as "Header: value | Header: value", live in
// supabase/functions/_shared/spreadsheet-text.ts, which the server and the QA
// self-test share.
//
// .xlsx is read with read-excel-file (MIT; its "universal" build is plain
// JavaScript, loaded only when someone adds a spreadsheet); .csv with the
// shared parser. An old .xls is turned away before this (file-types.ts).
// The phone app reads the file the same way, with a fallback for a Blob
// without arrayBuffer(); it has not been tried on a phone build yet.
// ────────────────────────────────────────────────────────────────

import {
  parseCsv, spreadsheetText, type SheetCell, type SpreadsheetText, type SpreadsheetType,
} from '../../supabase/functions/_shared/spreadsheet-text';

export { isSpreadsheetType, type SpreadsheetText } from '../../supabase/functions/_shared/spreadsheet-text';

/** Couldn't be read: a broken file, or one with a password. Said as it comes. */
export class SpreadsheetReadError extends Error {}

function readerResult<T>(read: (reader: FileReader) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as T);
    reader.onerror = () => reject(reader.error);
    read(reader);
  });
}

async function bytesOf(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  try {
    return await readerResult<ArrayBuffer>((r) => r.readAsArrayBuffer(blob));
  } catch {
    // A phone's FileReader may only give a data: URL.
    const url = await readerResult<string>((r) => r.readAsDataURL(blob));
    const binary = atob(url.slice(url.indexOf(',') + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
}

async function textOf(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return readerResult<string>((r) => r.readAsText(blob));
}

/** A picked .xlsx or .csv as the text the server keeps, and what was in it. */
export async function readSpreadsheet(uri: string, fileName: string, type: SpreadsheetType): Promise<SpreadsheetText> {
  const blob = await (await fetch(uri)).blob();
  if (type === 'csv') {
    return spreadsheetText(fileName, [{ name: '', rows: parseCsv(await textOf(blob)) }]);
  }
  try {
    const { default: readXlsxFile } = await import('read-excel-file/universal');
    const sheets = await readXlsxFile(await bytesOf(blob));
    return spreadsheetText(fileName, sheets.map((s) => ({ name: s.sheet, rows: s.data as unknown as SheetCell[][] })));
  } catch (err) {
    console.warn('[spreadsheet] Could not read:', err);
    throw new SpreadsheetReadError(
      "Couldn't read this spreadsheet. If it has a password, remove it in Excel, save it, and add it again.",
    );
  }
}
