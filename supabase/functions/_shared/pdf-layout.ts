// ─── A PDF page's text, laid out as a reader sees it ───────────
//
// The pure half of pdf-text.ts (whose header says why a PDF needs this):
// positioned pieces of text in, lines, columns and paragraphs out. Shared by
// the server's reader and the app's, which reads locked documents on the
// phone (docs/end-to-end-encryption.md); pdf-text.ts loads PDF.js from a URL,
// which the app cannot import, so the rules live here.
// ────────────────────────────────────────────────────────────────

/** One piece of text as PDF.js reports it: the string and where it sits. */
export interface TextPiece {
  str: string;
  /** Left edge, in PDF units (1/72 inch), origin bottom-left. */
  x: number;
  /** Baseline, in PDF units. Larger is further UP the page. */
  y: number;
  /** Rendered width, used to tell a word space from a column gap. */
  width: number;
  /** Font size, used as the tolerance for "same line". */
  height: number;
  /** PDF.js's own hint that a line ended here. */
  hasEOL?: boolean;
}

/** Pieces closer than this fraction of the font size share a baseline. */
const LINE_TOLERANCE = 0.5;
/** A gap wider than this many times the font size is a column boundary. */
const COLUMN_GAP = 0.9;
/** A vertical step larger than this many TYPICAL line steps starts a
 *  paragraph. Measured against the page's own median step rather than the
 *  font size: a table set on 22-unit rows in 10-point type is not a page full
 *  of paragraphs, it is a table, and judging by font size alone says it is. */
const PARAGRAPH_GAP = 1.6;

/**
 * Rebuild readable text from positioned pieces. Pure and synchronous, so it
 * can be exercised without a PDF engine — the ordering rules are the part
 * that is easy to get wrong, not the parsing.
 */
export function reconstructLayout(pieces: TextPiece[]): string {
  const kept = pieces.filter(p => p.str && p.str.trim().length > 0);
  if (kept.length === 0) return '';

  // ── Group by baseline. Sorting by descending y walks down the page.
  const lines: TextPiece[][] = [];
  for (const piece of [...kept].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines[lines.length - 1];
    const tolerance = Math.max(1, (piece.height || 10) * LINE_TOLERANCE);
    if (line && Math.abs(line[0].y - piece.y) <= tolerance) line.push(piece);
    else lines.push([piece]);
  }

  const rendered: { text: string; y: number; height: number }[] = [];

  for (const line of lines) {
    line.sort((a, b) => a.x - b.x);

    let text = '';
    let cursor: number | null = null;
    for (const piece of line) {
      if (cursor !== null) {
        const gap = piece.x - cursor;
        const size = piece.height || 10;
        if (gap > size * COLUMN_GAP) {
          // A visible gap. Two spaces, so the boundary survives into the
          // stored text and a reader (or a model) sees separate cells.
          text += '  ';
        } else if (gap > size * 0.12 && !/\s$/.test(text)) {
          text += ' ';
        }
      }
      text += piece.str;
      cursor = piece.x + (piece.width || 0);
    }

    const trimmed = text.replace(/[ \t]+/g, m => (m.length > 1 ? '  ' : ' ')).trim();
    if (trimmed) {
      rendered.push({ text: trimmed, y: line[0].y, height: line[0].height || 10 });
    }
  }

  // ── Join lines, opening a paragraph where the page leaves a real space.
  const typicalStep = medianStep(rendered.map(r => r.y));
  let out = '';
  for (let i = 0; i < rendered.length; i++) {
    if (i > 0) {
      const step = rendered[i - 1].y - rendered[i].y;
      out += step > typicalStep * PARAGRAPH_GAP ? '\n\n' : '\n';
    }
    out += rendered[i].text;
  }
  return out.trim();
}

/** The page's own usual line spacing, so the paragraph rule adapts to it. */
function medianStep(baselines: number[]): number {
  const steps: number[] = [];
  for (let i = 1; i < baselines.length; i++) {
    const step = baselines[i - 1] - baselines[i];
    if (step > 0.5) steps.push(step);
  }
  if (steps.length === 0) return 12;
  steps.sort((a, b) => a - b);
  return steps[Math.floor(steps.length / 2)];
}
