// ─── Query & passage embeddings ─────────────────────────────────
//
// Which model makes the vectors is chosen from the secrets
// (embedding-choice.ts): Supabase's built-in gte-small by default, run
// inside this function, free and with no outside service; Cloudflare
// Workers AI (Qwen3-Embedding, 100+ languages) when CLOUDFLARE_ACCOUNT_ID
// and CLOUDFLARE_AI_TOKEN are set; HuggingFace's multilingual-e5-small only
// when EMBEDDING_PROVIDER=huggingface. All three give 384 numbers, so the
// vector column and the HNSW index never change.
//
// THREE RULES, all easy to get wrong:
//
// 1. Use embedPassages / embedQuery, never a provider directly. E5 needs a
//    "passage: " / "query: " prefix and Qwen3 a task line on questions;
//    without them retrieval quality drops sharply, and silently.
//
// 2. Query vectors and chunk vectors must come from the SAME model.
//    Mixing produces meaningless distances, so search degrades quietly
//    instead of failing. EMBEDDING_MODEL names provider and model, so
//    changing either makes every vault's index stale: rag-search searches
//    it by keywords and the rebuild (reembed.ts) re-makes its vectors.
//
// 3. FAILURES MUST BE LOUD. Every one of this vault's chunks sat with a
//    NULL embedding for the life of the project, because the endpoint we
//    called had been retired (api-inference.huggingface.co now answers
//    410 Gone; HuggingFace moved to router.huggingface.co) and the only
//    sign was a console warning nobody reads. So these functions return
//    the reason alongside the vectors, and callers surface it.
//
// gte-small spends this function's CPU, and an Edge Function may use about
// 2 seconds of it a request. So embedPassages takes a budget: past it, the
// rest come back not tried (`attempted`), and the caller leaves those
// chunks for later (the rebuild, or fillMissingVectors in reembed.ts).
// ────────────────────────────────────────────────────────────────

import {
  chooseEmbeddingProvider, cloudflareBody, cloudflareModel, embeddingModelId, meanPool, normalise,
  runWithinBudget, truncateAndNormalise, CLOUDFLARE_BATCH, EMBEDDING_DIMS, HUGGINGFACE_MODEL,
  type EmbeddingEnv, type EmbeddingProvider,
} from './embedding-choice.ts';

export { EMBEDDING_DIMS, UNRECORDED_MODEL } from './embedding-choice.ts';

const env: EmbeddingEnv = {
  EMBEDDING_PROVIDER: Deno.env.get('EMBEDDING_PROVIDER'),
  CLOUDFLARE_ACCOUNT_ID: Deno.env.get('CLOUDFLARE_ACCOUNT_ID'),
  CLOUDFLARE_AI_TOKEN: Deno.env.get('CLOUDFLARE_AI_TOKEN'),
  CLOUDFLARE_EMBEDDING_MODEL: Deno.env.get('CLOUDFLARE_EMBEDDING_MODEL'),
};

export const EMBEDDING_PROVIDER: EmbeddingProvider = chooseEmbeddingProvider(env);

/** What an index made now records: provider, model and size. */
export const EMBEDDING_MODEL = embeddingModelId(EMBEDDING_PROVIDER, env);

/** True when vectors are made here, on this function's CPU, so a budget applies. */
export const EMBEDS_LOCALLY = EMBEDDING_PROVIDER === 'gte-small';

const HF_API_TOKEN = Deno.env.get('HF_API_TOKEN') ?? '';

// Tried in order; the first that answers wins and is remembered for the
// life of the isolate. The router host is current, the rest are history —
// keeping them costs one failed request on a cold start and saves us from
// being wrong about the shape.
const ENDPOINTS = [
  `https://router.huggingface.co/hf-inference/models/${HUGGINGFACE_MODEL}/pipeline/feature-extraction`,
  `https://router.huggingface.co/hf-inference/models/${HUGGINGFACE_MODEL}`,
  `https://api-inference.huggingface.co/pipeline/feature-extraction/${HUGGINGFACE_MODEL}`,
  `https://api-inference.huggingface.co/models/${HUGGINGFACE_MODEL}`,
];

let workingEndpoint: string | null = null;

// Answers about the account, not the address: every address would say the
// same, so the first one ends the search and is reported in plain words.
const ACCOUNT_REFUSALS: Record<number, string> = {
  401: 'HuggingFace refused the token',
  402: 'HuggingFace credit is used up',
  403: 'the token may not call this model',
  429: 'HuggingFace rate limit',
};

export interface EmbedResult {
  /** One entry per input, in order. Null where that input could not be embedded. */
  vectors: (number[] | null)[];
  /** Why nothing came back. Absent on success. */
  error?: string;
  /**
   * How many inputs, from the first, were tried. Fewer than all when the
   * CPU budget ran out (gte-small only): the rest are null without having
   * failed, and the caller leaves those chunks for later.
   */
  attempted: number;
}

/** Embed a question. `vector` is null when embedding is unavailable, so
 *  callers can fall back to keyword-only retrieval instead of failing. */
export async function embedQuery(
  text: string,
): Promise<{ vector: number[] | null; error?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { vector: null, error: 'empty query' };
  const { vectors, error } = await embedWith([trimmed], 'query');
  return { vector: vectors[0] ?? null, error };
}

/**
 * Embed document chunks, in order. A failed entry comes back null so the
 * chunk can still be stored and found by keyword. `budgetMs` bounds the CPU
 * gte-small may spend here; the remote providers ignore it.
 */
export async function embedPassages(
  texts: string[],
  opts: { budgetMs?: number } = {},
): Promise<EmbedResult> {
  if (texts.length === 0) return { vectors: [], attempted: 0 };
  return await embedWith(texts.map(t => t.trim()), 'passage', opts.budgetMs);
}

function embedWith(texts: string[], kind: 'query' | 'passage', budgetMs?: number): Promise<EmbedResult> {
  if (EMBEDDING_PROVIDER === 'cloudflare') return embedCloudflare(texts, kind);
  if (EMBEDDING_PROVIDER === 'huggingface') return embedHuggingFace(texts.map(t => `${kind}: ${t}`));
  return embedGteSmall(texts, budgetMs);
}

// ─── gte-small, inside the Edge Function ─────────────────────────
//
// Supabase.ai is a global of the Edge Runtime (declared in
// @supabase/functions-js's edge-runtime.d.ts); it is not there under plain
// Deno, so it is looked up, not assumed. One session per isolate. gte-small
// reads at most 512 tokens and needs no prefix.

type AiSession = { run(input: string, options?: { mean_pool?: boolean; normalize?: boolean }): unknown };
let gteSession: AiSession | null = null;

/** A chunk is at most 400 tokens; this only guards the model's 512 against an odd one. */
const GTE_MAX_CHARS = 2_000;

function gteSmall(): AiSession | null {
  if (gteSession) return gteSession;
  const ai = (globalThis as { Supabase?: { ai?: { Session?: new (model: string) => AiSession } } }).Supabase?.ai;
  if (!ai?.Session) return null;
  gteSession = new ai.Session('gte-small');
  return gteSession;
}

async function embedGteSmall(texts: string[], budgetMs = Number.POSITIVE_INFINITY): Promise<EmbedResult> {
  const session = gteSmall();
  if (!session) {
    return { vectors: texts.map(() => null), attempted: texts.length, error: 'Supabase.ai is not available in this runtime' };
  }
  let lastError: string | undefined;
  const { results, attempted } = await runWithinBudget(texts, async (text) => {
    try {
      const output = await session.run(text.slice(0, GTE_MAX_CHARS), { mean_pool: true, normalize: true });
      const vector = Array.isArray(output) ? output : null;
      if (!vector || vector.length !== EMBEDDING_DIMS) {
        lastError = `gte-small gave ${vector ? vector.length : typeof output} numbers, not ${EMBEDDING_DIMS}`;
        return null;
      }
      return normalise(vector as number[]);
    } catch (err) {
      lastError = `gte-small failed: ${String(err).slice(0, 160)}`;
      return null;
    }
  }, budgetMs);
  const tried = results.slice(0, attempted);
  if (lastError) console.warn(`[embed] ${lastError}`);
  return {
    vectors: results,
    attempted,
    // An error only when nothing tried came back, as for the other providers.
    ...(tried.length && tried.every(v => v === null) ? { error: lastError ?? 'gte-small gave nothing' } : {}),
  };
}

// ─── Cloudflare Workers AI ───────────────────────────────────────
//
// POST /accounts/{id}/ai/run/{model} with a Workers AI token; the answer is
// { result: { data: number[][], shape }, success, errors }. Qwen3 takes 32
// texts a call. Its vectors are cut to 384 (truncateAndNormalise). Past the
// free daily allowance Cloudflare refuses, and search falls back to keywords
// until the next day (00:00 UTC).

const CLOUDFLARE_URL = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID?.trim()}/ai/run/${cloudflareModel(env)}`;

async function embedCloudflare(texts: string[], kind: 'query' | 'passage'): Promise<EmbedResult> {
  const vectors: (number[] | null)[] = texts.map(() => null);
  let error: string | undefined;
  for (let start = 0; start < texts.length; start += CLOUDFLARE_BATCH) {
    const batch = texts.slice(start, start + CLOUDFLARE_BATCH);
    try {
      const response = await fetch(CLOUDFLARE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.CLOUDFLARE_AI_TOKEN?.trim()}`,
        },
        body: JSON.stringify(cloudflareBody(cloudflareModel(env), kind, batch)),
      });
      if (!response.ok) {
        const text = (await response.text()).replace(/\s+/g, ' ').slice(0, 160);
        // "HTTP 429 …" first, as HuggingFace's are, so QA reads a used-up
        // allowance as an outside limit rather than a fault in the app.
        error = `HTTP ${response.status} (Cloudflare Workers AI${response.status === 429 ? ' allowance or rate limit' : ''}): ${text}`;
        console.warn(`[embed] ${error}`);
        break;
      }
      const payload = await response.json() as { result?: { data?: unknown[] }; data?: unknown[] };
      const data = payload.result?.data ?? payload.data;
      if (!Array.isArray(data) || data.length !== batch.length) {
        error = `Cloudflare gave ${Array.isArray(data) ? data.length : typeof data} vectors for ${batch.length} texts`;
        console.warn(`[embed] ${error}`);
        break;
      }
      data.forEach((v, i) => { vectors[start + i] = truncateAndNormalise(v); });
    } catch (err) {
      error = `Cloudflare unreachable: ${String(err).slice(0, 160)}`;
      console.warn(`[embed] ${error}`);
      break;
    }
  }
  return {
    vectors,
    attempted: texts.length,
    ...(vectors.every(v => v === null) ? { error: error ?? 'Cloudflare gave no usable vectors' } : {}),
  };
}

// ─── HuggingFace (only when EMBEDDING_PROVIDER=huggingface) ──────

/** POST to HF and normalise the response into one vector per input. */
async function embedHuggingFace(inputs: string[]): Promise<EmbedResult> {
  const empty = inputs.map(() => null);

  if (!HF_API_TOKEN) {
    // The router host requires a token; anonymous access ended with the old
    // endpoint. Say so plainly rather than reporting a generic failure.
    return { vectors: empty, attempted: inputs.length, error: 'HF_API_TOKEN is not set' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${HF_API_TOKEN}`,
  };
  const body = JSON.stringify({ inputs, options: { wait_for_model: true } });

  // A known-good endpoint goes first; everything else stays as a fallback in
  // case HuggingFace moves again.
  const candidates = workingEndpoint
    ? [workingEndpoint, ...ENDPOINTS.filter(e => e !== workingEndpoint)]
    : ENDPOINTS;

  let lastError = 'no endpoint answered';
  // An address that answered beats one that could not be reached. The retired
  // host's DNS failure, tried last, hid the router's "402, credit used up"
  // behind "dns error" in every report until this kept the real answer.
  let heard = false;

  for (const endpoint of candidates) {
    try {
      const response = await fetch(endpoint, { method: 'POST', headers, body });

      if (!response.ok) {
        const errText = (await response.text()).replace(/\s+/g, ' ').slice(0, 160);
        const account = ACCOUNT_REFUSALS[response.status];
        lastError = `HTTP ${response.status}${account ? ` (${account})` : ''}: ${errText}`;
        heard = true;
        console.warn(`[embed] ${lastError} at ${endpoint}`);
        if (account) break;
        continue;
      }

      const payload = await response.json();
      heard = true;
      if (!Array.isArray(payload) || payload.length !== inputs.length) {
        lastError = `expected ${inputs.length} vectors, got ${Array.isArray(payload) ? payload.length : typeof payload}`;
        console.warn(`[embed] ${lastError}`);
        continue;
      }

      // Feature-extraction returns either [dims] or [tokens][dims] per input.
      const vectors = payload.map((entry: number[] | number[][]) => {
        const vector = Array.isArray(entry[0])
          ? meanPool(entry as number[][])
          : (entry as number[]);
        if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMS) {
          console.warn(`[embed] Expected ${EMBEDDING_DIMS} dims, got ${vector?.length}`);
          return null;
        }
        return normalise(vector);
      });

      if (vectors.every(v => v === null)) {
        lastError = `every vector was the wrong shape (expected ${EMBEDDING_DIMS} dims)`;
        continue;
      }

      if (workingEndpoint !== endpoint) {
        console.log(`[embed] Using ${endpoint}`);
        workingEndpoint = endpoint;
      }
      return { vectors, attempted: inputs.length };
    } catch (err) {
      const reason = String(err).slice(0, 160);
      if (!heard) lastError = reason;
      console.warn(`[embed] Endpoint failed (${endpoint}): ${reason}`);
    }
  }

  console.warn(`[embed] All endpoints failed: ${lastError}`);
  return { vectors: empty, attempted: inputs.length, error: lastError };
}
