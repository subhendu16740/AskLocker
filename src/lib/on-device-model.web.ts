// Search vectors made on the phone, for locked vaults
// (docs/end-to-end-encryption.md, "A locked document"): gte-small through
// transformers.js, the library and model the lab measured on a real phone
// (/lab/e2e.html). Both are fetched the first time from public CDNs
// (jsDelivr, Hugging Face) and kept by the browser; what they read never
// leaves the phone. One thread: four would need the page cross-origin
// isolated, which would break Google's and Razorpay's windows.

const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';
const MODEL = 'Xenova/gte-small';
const BATCH = 8;

// Loaded by URL at run time, hidden from the bundler, which cannot follow it.
const importUrl = new Function('u', 'return import(u)') as (url: string) => Promise<any>;

let extractor: Promise<(texts: string[], opts: object) => Promise<{ tolist(): number[][] }>> | null = null;

function model() {
  if (!extractor) {
    extractor = (async () => {
      const T = await importUrl(LIB);
      T.env.allowLocalModels = false;
      T.env.backends.onnx.wasm.numThreads = 1;
      return T.pipeline('feature-extraction', MODEL, { dtype: 'q8' });
    })();
    extractor.catch(() => { extractor = null; });
  }
  return extractor;
}

/** Vectors for passages, normalised, 384 numbers each. */
export async function embedTexts(texts: string[], onProgress?: (done: number, total: number) => void): Promise<number[][]> {
  const run = await model();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    out.push(...(await run(batch, { pooling: 'mean', normalize: true })).tolist());
    onProgress?.(Math.min(texts.length, i + BATCH), texts.length);
  }
  return out;
}

/** A question's vector. */
export async function embedQuery(text: string): Promise<number[]> {
  return (await embedTexts([text]))[0];
}

export function onDeviceSearchAvailable(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly !== 'undefined';
}
