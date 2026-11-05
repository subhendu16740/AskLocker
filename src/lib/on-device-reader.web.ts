// Reading a PDF on the phone, for locked vaults (docs/end-to-end-encryption.md,
// "A locked document"). PDF.js from jsDelivr, loaded the first time it is
// needed; the layout rules are the server's own (_shared/pdf-layout.ts). A
// page with almost no text (a scan, or a signature stamp alone) is drawn and
// read with Tesseract, as photos are, in the person's document languages.

import { reconstructLayout, type TextPiece } from '../../supabase/functions/_shared/pdf-layout';
import { MAX_DOCUMENT_TEXT } from '../../supabase/functions/_shared/limits';
import { extractTextFromImage } from './ocr';

const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
/** Fewer characters a page than this, on average, and the pages are read as pictures (the server's rule). */
const MIN_CHARS_PER_PAGE = 200;
/** At most this many scanned pages are read: about a minute and a half on a phone. */
const MAX_OCR_PAGES = 10;

const importUrl = new Function('u', 'return import(u)') as (url: string) => Promise<any>;

let pdfjs: Promise<any> | null = null;

function loadPdfJs() {
  if (!pdfjs) {
    pdfjs = (async () => {
      const lib = await importUrl(PDFJS);
      // A worker from another address cannot be started directly; one that
      // imports it can.
      const boot = URL.createObjectURL(new Blob([`import "${PDFJS_WORKER}";`], { type: 'text/javascript' }));
      lib.GlobalWorkerOptions.workerPort = new Worker(boot, { type: 'module' });
      return lib;
    })();
    pdfjs.catch(() => { pdfjs = null; });
  }
  return pdfjs;
}

export interface PdfReadProgress {
  stage: 'opening' | 'reading' | 'scanning';
  page: number;
  pages: number;
}

/** The text of a PDF, laid out as on the page; scanned pages read as pictures. */
export async function readPdfOnDevice(
  bytes: Uint8Array,
  languages?: string[],
  onProgress?: (p: PdfReadProgress) => void,
): Promise<{ text: string; pages: number; scanned: boolean }> {
  onProgress?.({ stage: 'opening', page: 0, pages: 0 });
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  const pages: string[] = [];
  let length = 0;
  for (let n = 1; n <= doc.numPages && length < MAX_DOCUMENT_TEXT; n++) {
    onProgress?.({ stage: 'reading', page: n, pages: doc.numPages });
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const pieces: TextPiece[] = (content.items as Record<string, unknown>[])
      .filter((item) => typeof item.str === 'string')
      .map((item) => {
        const t = (item.transform ?? [1, 0, 0, 10, 0, 0]) as number[];
        return {
          str: item.str as string,
          x: t[4], y: t[5],
          width: (item.width as number) ?? 0,
          height: Math.abs(t[3]) || (item.height as number) || 10,
          hasEOL: item.hasEOL as boolean | undefined,
        };
      });
    const text = reconstructLayout(pieces);
    pages.push(text);
    length += text.length + 2;
  }
  const layered = pages.join('\n\n').trim();
  const chars = layered.replace(/\s+/g, '').length;
  if (pages.length && chars / pages.length >= MIN_CHARS_PER_PAGE) {
    return { text: layered.slice(0, MAX_DOCUMENT_TEXT), pages: pages.length, scanned: false };
  }

  // A scan: draw each page and read it.
  const read: string[] = [];
  const total = Math.min(doc.numPages, MAX_OCR_PAGES);
  for (let n = 1; n <= total; n++) {
    onProgress?.({ stage: 'scanning', page: n, pages: total });
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
    const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This page could not be drawn.'))), 'image/png'));
    const url = URL.createObjectURL(blob);
    try {
      read.push(await extractTextFromImage(url, undefined, languages));
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const scannedText = read.join('\n\n').trim();
  // Keep whichever read more, as the server does.
  const text = scannedText.length > layered.length ? scannedText : layered;
  return { text: text.slice(0, MAX_DOCUMENT_TEXT), pages: doc.numPages, scanned: scannedText.length > layered.length };
}
