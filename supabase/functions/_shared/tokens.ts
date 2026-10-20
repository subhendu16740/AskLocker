// ─── How many tokens a piece of text is worth ───────────────────
//
// Near enough to size a passage by (chunking.ts), a spreadsheet's line
// (spreadsheet-text.ts) and the judge's request (rag-search), which Groq
// refuses outright (413) when it is over the model's allowance for a minute.
//
// Latin text runs about 4 characters a token, Indic scripts closer to 2: the
// tokenizers were trained mostly on Latin text. Numbers cost more than
// either. Digits go in threes, and the space or sign beside a number is a
// token of its own. Measured against o200k on 20 October 2026, counting
// characters alone gave half the real count for a spreadsheet's rows (5,524
// for 10,472) and about 0.7 of it for documents, so a table of numbers sent
// the judge 8,660 tokens and Groq refused it. Counting numbers this way
// gives 0.84 to 1.0 of the real count.
// ────────────────────────────────────────────────────────────────

export function estimateTokens(text: string): number {
  let tokens = 0;
  for (const [run] of text.matchAll(/[0-9]+|[^0-9]+/g)) {
    const code = run.charCodeAt(0);
    if (code >= 48 && code <= 57) {
      tokens += Math.ceil(run.length / 3) + 1;
      continue;
    }
    for (const ch of run) tokens += ch.charCodeAt(0) < 128 ? 0.25 : 0.5;
  }
  return Math.ceil(tokens);
}
