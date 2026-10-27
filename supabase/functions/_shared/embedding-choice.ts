// ─── Which model makes the search vectors, and the arithmetic ───
//
// Pure: no Deno, no network, so the QA self-test runs it in Node.
// embeddings.ts reads the secrets and does the calls.
//
// Three providers, one column (vector(384)):
//
//   gte-small    Supabase's own model, run inside the Edge Function. Free,
//                no outside service, no key. English only. The default.
//   cloudflare   Cloudflare Workers AI, when CLOUDFLARE_ACCOUNT_ID and
//                CLOUDFLARE_AI_TOKEN are set. Free up to Cloudflare's daily
//                allowance. Qwen3-Embedding-0.6B reads 100+ languages, the
//                Indian ones included. Its 1,024 numbers are cut to 384 and
//                scaled back to length 1, which Matryoshka-trained models
//                allow (the first numbers carry the most meaning). Only such
//                a model may be named in CLOUDFLARE_EMBEDDING_MODEL.
//   huggingface  multilingual-e5-small, only when EMBEDDING_PROVIDER says
//                so. Its free credit is $0.10 a month and ran out on DEV.
//
// The id recorded for an index names the provider and the model, so
// changing either makes every vault's index stale, and the rebuild
// (reembed.ts) re-makes its vectors by itself.
// ────────────────────────────────────────────────────────────────

export type EmbeddingProvider = 'gte-small' | 'cloudflare' | 'huggingface';

export const EMBEDDING_DIMS = 384;

/** The HuggingFace model, and its id in family_embedding_state. */
export const HUGGINGFACE_MODEL = 'intfloat/multilingual-e5-small';

/**
 * What a vault with no family_embedding_state row was embedded with. No row
 * meant "made after migration 013, so on the current model", and the model
 * then was multilingual-e5-small. With any other model such a vault is due a
 * rebuild, not ready.
 */
export const UNRECORDED_MODEL = HUGGINGFACE_MODEL;

export const GTE_SMALL_MODEL_ID = 'supabase/gte-small';

export const CLOUDFLARE_DEFAULT_MODEL = '@cf/qwen/qwen3-embedding-0.6b';

/** Cloudflare's Qwen3 embedding takes at most 32 texts a call. */
export const CLOUDFLARE_BATCH = 32;

/** A Cloudflare call is tried twice at most, this long apart. */
export const CLOUDFLARE_ATTEMPTS = 2;
export const CLOUDFLARE_RETRY_MS = 400;

/**
 * Whether a failed Cloudflare call is worth one more try: Cloudflare's own
 * fault (any 5xx; on 27 October 2026 PROD met a 503 "Unknown internal
 * error", code 3048, between calls that worked) or "Capacity temporarily
 * exceeded, please try again" (429, code 3040). Not the day's free
 * allowance used up (429, code 3036), which lasts until 00:00 UTC, and not
 * a request Cloudflare refuses (4xx), which would fail the same way again.
 */
export function cloudflareRetryable(status: number, body: string): boolean {
  if (status >= 500) return true;
  return status === 429 && /"code"\s*:\s*3040\b/.test(body);
}

/**
 * Qwen3-Embedding reads a question better with a task line in front of it
 * (its model card: 1–5% better retrieval). Passages go in as they are.
 */
export const QUERY_INSTRUCTION =
  'Given a question about a family\'s or a business\'s documents, retrieve the passages that answer it';

export interface EmbeddingEnv {
  EMBEDDING_PROVIDER?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_AI_TOKEN?: string;
  CLOUDFLARE_EMBEDDING_MODEL?: string;
}

/**
 * Cloudflare when its two secrets are set, else gte-small. HuggingFace only
 * when asked for by name, and Cloudflare asked for without its secrets is
 * gte-small: a choice that cannot work must not leave search with nothing.
 */
export function chooseEmbeddingProvider(env: EmbeddingEnv): EmbeddingProvider {
  const asked = (env.EMBEDDING_PROVIDER ?? '').trim().toLowerCase();
  const cloudflareReady = !!env.CLOUDFLARE_ACCOUNT_ID?.trim() && !!env.CLOUDFLARE_AI_TOKEN?.trim();
  if (asked === 'huggingface') return 'huggingface';
  if (asked === 'gte-small') return 'gte-small';
  return cloudflareReady ? 'cloudflare' : 'gte-small';
}

export function cloudflareModel(env: EmbeddingEnv): string {
  return env.CLOUDFLARE_EMBEDDING_MODEL?.trim() || CLOUDFLARE_DEFAULT_MODEL;
}

/** The id an index records: which provider, which model, how many numbers. */
export function embeddingModelId(provider: EmbeddingProvider, env: EmbeddingEnv = {}): string {
  if (provider === 'huggingface') return HUGGINGFACE_MODEL;
  if (provider === 'cloudflare') return `cloudflare/${cloudflareModel(env)}@${EMBEDDING_DIMS}`;
  return GTE_SMALL_MODEL_ID;
}

/**
 * Cloudflare's request body. Qwen3 names questions and passages apart and
 * takes the task line itself; EmbeddingGemma wants its own prefixes in the
 * text (its model card); any other model gets the text as it is.
 */
export function cloudflareBody(model: string, kind: 'query' | 'passage', texts: string[]): Record<string, unknown> {
  if (/qwen3-embedding/i.test(model)) {
    return kind === 'query' ? { queries: texts, instruction: QUERY_INSTRUCTION } : { documents: texts };
  }
  if (/embeddinggemma/i.test(model)) {
    const prefix = kind === 'query' ? 'task: search result | query: ' : 'title: none | text: ';
    return { text: texts.map(t => prefix + t) };
  }
  return { text: texts };
}

/** Scaled to length 1. A zero or broken vector is returned as it is. */
export function normalise(vector: number[]): number[] {
  let sum = 0;
  for (const v of vector) sum += v * v;
  const norm = Math.sqrt(sum);
  if (!norm || !Number.isFinite(norm)) return vector;
  return vector.map(v => v / norm);
}

/**
 * The first `dims` numbers, scaled back to length 1 (Matryoshka). Null when
 * the vector is shorter than that, or not numbers: storing it would break
 * the column, or rank by noise.
 */
export function truncateAndNormalise(vector: unknown, dims = EMBEDDING_DIMS): number[] | null {
  if (!Array.isArray(vector) || vector.length < dims) return null;
  const head = vector.slice(0, dims);
  if (!head.every(v => typeof v === 'number' && Number.isFinite(v))) return null;
  return normalise(head as number[]);
}

export function meanPool(tokenEmbeddings: number[][]): number[] {
  if (tokenEmbeddings.length === 0) return [];
  const dims = tokenEmbeddings[0].length;
  const result = new Array(dims).fill(0);
  for (const emb of tokenEmbeddings) {
    for (let i = 0; i < dims; i++) result[i] += emb[i];
  }
  for (let i = 0; i < dims; i++) result[i] /= tokenEmbeddings.length;
  return result;
}

export interface BudgetedResult<T> {
  /** One per input, in order: the result, or null where it failed or was not tried. */
  results: (T | null)[];
  /** How many inputs, from the first, were tried. The rest are left for later. */
  attempted: number;
  /** Time spent on them. */
  spentMs: number;
}

/**
 * Run `work` on the inputs in order while the time spent stays inside the
 * budget. An Edge Function may use about 2 seconds of CPU a request, and a
 * model run inside it spends that CPU; going over ends the function midway,
 * with nothing saved. So: the first input whenever there is any budget (so
 * every call makes progress), then another only while the average so far
 * says it fits. A budget of 0 tries nothing.
 * Whatever is not tried stays null, and the caller leaves it for later.
 */
export async function runWithinBudget<I, T>(
  inputs: I[],
  work: (input: I) => Promise<T | null>,
  budgetMs: number,
  now: () => number = () => Date.now(),
): Promise<BudgetedResult<T>> {
  const results: (T | null)[] = inputs.map(() => null);
  let spentMs = 0;
  let attempted = 0;
  // No budget at all: nothing is tried, and everything is left for later.
  if (!(budgetMs > 0)) return { results, attempted, spentMs };
  for (let i = 0; i < inputs.length; i++) {
    if (i > 0 && spentMs + spentMs / i > budgetMs) break;
    const started = now();
    try {
      results[i] = await work(inputs[i]);
    } catch {
      results[i] = null;
    }
    spentMs += Math.max(0, now() - started);
    attempted = i + 1;
  }
  return { results, attempted, spentMs };
}
