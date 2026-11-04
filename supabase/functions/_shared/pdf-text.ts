// ─── Reading text out of a PDF, with the page layout intact ─────
//
// A PDF has no lines, no paragraphs and no table rows. It has glyphs at
// coordinates, written to the content stream in whatever order the
// producing program felt like. Read that stream in order and a table comes
// out column by column: every label, then every figure in the first column,
// then every figure in the second. That is what happened to this vault's
// placements report — the question "80% CTC range for Operations" was
// unanswerable because "Operations" and "27 - 44" ended up 200 characters
// apart with nine other functions and twenty other numbers in between.
//
// So this does what a reader's eye does: take each piece of text with its
// position, group pieces that share a baseline into a line, order them left
// to right, and put a run of spaces where there is a visible gap. The table
// comes back as rows:
//
//     Operations    28,73,765    31,61,743    27 - 44
//
// which the answering model, the relevance judge and keyword search can all
// use. Prose is unaffected — it was already in reading order — but it gains
// real line and paragraph breaks, which the chunker needs to split on
// sensible boundaries.
//
// PDF.js does the parsing. `pdfjs-serverless` is a single-file build of it
// for runtimes without Node's filesystem, which is what an Edge Function is.
// ────────────────────────────────────────────────────────────────

import { MAX_DOCUMENT_TEXT } from './limits.ts';

import { reconstructLayout, type TextPiece } from './pdf-layout.ts';

export { reconstructLayout, type TextPiece };

/**
 * Extract every page of a PDF as laid-out text, with the page count.
 *
 * The COUNT is what tells a real text layer from a scan. "Did any text come
 * out?" cannot: a scanned policy carries a digital-signature stamp, and one
 * line of "Digitally Signed by …" per page looks exactly like a document
 * that was read successfully. Per page, the two are not close — a page of
 * prose or a table runs to hundreds of characters, a stamp to a few dozen.
 *
 * Throws rather than returning something plausible-but-wrong, so the caller
 * can fall back to the older extractor and then to OCR. A PDF that is purely
 * scanned images has no text pieces at all and comes back empty, which is
 * the signal to try OCR.
 */
export async function extractPdfLayoutText(
  bytes: Uint8Array,
): Promise<{ text: string; pages: number }> {
  const { getDocument } = await import('https://esm.sh/pdfjs-serverless@1.3.1');

  const doc = await getDocument({
    data: bytes,
    useSystemFonts: true,
    // Nothing is being drawn, and both of these fetch assets we cannot reach.
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;

  // A document keeps at most MAX_DOCUMENT_TEXT characters (050), so reading
  // stops there: a long file is not read page after page into memory for
  // text that is thrown away. `pages` is then the pages read, so the
  // characters per page (hasTextLayer) are counted over the same pages.
  const pages: string[] = [];
  let length = 0;
  let read = 0;
  for (let n = 1; n <= doc.numPages && length < MAX_DOCUMENT_TEXT; n++) {
    read = n;
    const page = await doc.getPage(n);
    const content = await page.getTextContent();

    const pieces: TextPiece[] = (content.items as Record<string, unknown>[])
      .filter(item => typeof item.str === 'string')
      .map(item => {
        // transform is [a, b, c, d, e, f]; e and f are the position, and d
        // is the vertical scale, which is the effective font size.
        const t = (item.transform ?? [1, 0, 0, 10, 0, 0]) as number[];
        return {
          str: item.str as string,
          x: t[4],
          y: t[5],
          width: (item.width as number) ?? 0,
          height: Math.abs(t[3]) || (item.height as number) || 10,
          hasEOL: item.hasEOL as boolean | undefined,
        };
      });

    const text = reconstructLayout(pieces);
    if (text) {
      pages.push(text);
      length += text.length + 2;
    }
  }

  // Page breaks are paragraph breaks as far as chunking is concerned.
  return { text: pages.join('\n\n'), pages: read };
}
