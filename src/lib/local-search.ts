// Search on the phone, for locked vaults (docs/end-to-end-encryption.md,
// "Search and Ask"). Pure: no network, no React, no browser — so QA's
// self-test pins it. The server's retrieval (rag_retrieve_chunks) blends
// meaning and words 0.7/0.3 and keeps at most 4 passages a document; this
// does the same over the passages the phone opened.

/** One passage of a locked document, as it is sealed and opened. */
export interface SealedPassage {
  /** Its place in the document. */
  i: number;
  /** Its text. */
  t: string;
  /** Its search vector, 384 numbers as 8-bit integers, base64url. */
  v: string;
}

export interface IndexedPassage {
  familyId: string;
  documentId: string;
  documentName: string;
  index: number;
  text: string;
  vector: Int8Array;
}

export interface RankedPassage extends IndexedPassage {
  score: number;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toB64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}

function fromB64(text: string): Uint8Array {
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    const a = B64.indexOf(text[i]), b = B64.indexOf(text[i + 1]);
    const c = i + 2 < text.length ? B64.indexOf(text[i + 2]) : 0;
    const d = i + 3 < text.length ? B64.indexOf(text[i + 3]) : 0;
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('This search index could not be read.');
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    out[o++] = (n >> 16) & 255;
    if (i + 2 < text.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < text.length) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

/** A normalised vector as 8-bit integers: 384 bytes, about the same ranking. */
export function packVector(vector: ArrayLike<number>): string {
  const bytes = new Uint8Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    const q = Math.max(-127, Math.min(127, Math.round(vector[i] * 127)));
    bytes[i] = q & 255;
  }
  return toB64(bytes);
}

export function unpackVector(text: string): Int8Array {
  const bytes = fromB64(text);
  return new Int8Array(bytes.buffer, bytes.byteOffset, bytes.length);
}

/** Cosine with a normalised question vector, for a passage's 8-bit one. */
export function similarity(passage: Int8Array, question: ArrayLike<number>): number {
  let dot = 0, norm = 0;
  for (let i = 0; i < passage.length; i++) {
    dot += passage[i] * question[i];
    norm += passage[i] * passage[i];
  }
  return norm > 0 ? dot / Math.sqrt(norm) : 0;
}

const STOP = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'was', 'what', 'when', 'where', 'which',
  'who', 'how', 'my', 'me', 'i', 'it', 'its', 'do', 'does', 'did', 'this', 'that', 'with', 'at', 'by', 'from', 'be',
  'our', 'we', 'you', 'your', 'can', 'will', 'show', 'tell', 'find', 'please', 'ka', 'ki', 'ke', 'hai', 'kya',
]);

/** The words of a text that count for keyword search: letters or digits, any script, two or more. */
export function searchTerms(text: string): string[] {
  const words = text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  return words.filter((w) => !STOP.has(w));
}

/**
 * The best passages for a question: 0.7 meaning, 0.3 words (BM25-like, each
 * word weighed by how rare it is among the passages), at most `perDocument`
 * from one document.
 */
export function rankPassages(
  passages: IndexedPassage[],
  question: ArrayLike<number> | null,
  questionText: string,
  opts: { limit?: number; perDocument?: number } = {},
): RankedPassage[] {
  const limit = opts.limit ?? 15;
  const perDocument = opts.perDocument ?? 4;
  if (!passages.length) return [];

  const terms = [...new Set(searchTerms(questionText))];
  const df = new Map<string, number>();
  const termSets = passages.map((p) => {
    const set = new Set(searchTerms(p.text));
    for (const t of terms) if (set.has(t)) df.set(t, (df.get(t) ?? 0) + 1);
    return set;
  });
  const n = passages.length;
  const keyword = passages.map((_, i) => {
    let s = 0;
    for (const t of terms) {
      if (!termSets[i].has(t)) continue;
      const d = df.get(t) ?? 0;
      s += Math.log(1 + (n - d + 0.5) / (d + 0.5));
    }
    return s;
  });
  const maxKeyword = Math.max(0, ...keyword);

  const scored: RankedPassage[] = passages.map((p, i) => {
    const meaning = question ? similarity(p.vector, question) : 0;
    const words = maxKeyword > 0 ? keyword[i] / maxKeyword : 0;
    return { ...p, score: question ? 0.7 * meaning + 0.3 * words : words };
  });
  scored.sort((a, b) => b.score - a.score);

  const perDoc = new Map<string, number>();
  const out: RankedPassage[] = [];
  for (const p of scored) {
    const key = `${p.familyId}/${p.documentId}`;
    const count = perDoc.get(key) ?? 0;
    if (count >= perDocument) continue;
    perDoc.set(key, count + 1);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}
