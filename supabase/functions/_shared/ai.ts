// ─── Claude first, Groq if Claude can't answer ──────────────────
//
// With ANTHROPIC_API_KEY set, every model step in rag-search (the judge,
// the rewrite of a follow-up or a translation, and the answer) asks Claude
// first: Haiku unless CLAUDE_MODEL, CLAUDE_CONDENSE_MODEL or
// CLAUDE_RERANK_MODEL says otherwise. Groq answers when Claude cannot — no
// key, no credit left, an error, a refusal — so running out of credit
// slows nothing down for long and breaks nothing. Without the key this is
// groq.ts, unchanged.
//
// Claude's reply comes back in Groq's shape (claude-shape.ts), so the
// callers read one kind of response whichever model answered, and
// debug.models says which did.
// ────────────────────────────────────────────────────────────────

import Anthropic from 'npm:@anthropic-ai/sdk@1.1.0';
import { groqChat, hasGroqKey, type GroqChatResult } from './groq.ts';
import {
  CLAUDE_DEFAULT_MODEL, CLAUDE_ROLE_ENV, claudeCanTake, claudeShouldRest, claudeText, claudeUsable,
  groqStyleReply, toClaudeRequest, type AiRole, type GroqStyleBody, type JsonSchema,
} from './claude-shape.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')?.trim() ?? '';

export const hasClaudeKey = ANTHROPIC_API_KEY.length > 0;

/** Some model can be asked: Claude, Groq or both. */
export const hasAiKey = hasClaudeKey || hasGroqKey;

// One retry, and a timeout well inside the function's own limit, so a slow
// Claude still leaves time for Groq.
const client = hasClaudeKey
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY, maxRetries: 1, timeout: 30_000 })
  : null;

/** After a refusal Claude will repeat (no credit, no key), Groq answers for this long. */
const REST_MS = 10 * 60 * 1000;
let restUntil = 0;
let restReason = '';

/** Why Claude is being left alone right now, or null when it is being asked. */
export function claudeRestReason(): string | null {
  return client && Date.now() < restUntil ? restReason : null;
}

function claudeModel(role: AiRole): string {
  return Deno.env.get(CLAUDE_ROLE_ENV[role])?.trim() || CLAUDE_DEFAULT_MODEL;
}

/** An error that is Claude's, in a Response, for when there is no Groq to ask. */
function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * groqChat's job, Claude first. `schema` is the JSON the step expects, for
 * the steps that ask Groq for `json_object`: Claude needs a schema to keep
 * to. The Response is unconsumed, as groqChat's is.
 */
export async function aiChat(
  role: AiRole,
  body: GroqStyleBody,
  opts: { schema?: JsonSchema } = {},
): Promise<GroqChatResult> {
  if (!client || claudeRestReason()) return groqChat(role, body as unknown as Record<string, unknown>);

  const wantsJson = body.response_format?.type === 'json_object';
  const model = claudeModel(role);
  const request = toClaudeRequest(body, model, wantsJson ? opts.schema : undefined);
  let failure = { status: 502, message: 'Claude gave no answer' };

  if (claudeCanTake(request)) {
    try {
      const message = await client.messages.create(request);
      const text = claudeText(message.content);
      if (claudeUsable(message.stop_reason, text, wantsJson)) {
        const reply = groqStyleReply(text, message.stop_reason, message.usage);
        return {
          response: new Response(JSON.stringify(reply), { status: 200, headers: { 'Content-Type': 'application/json' } }),
          model: message.model,
        };
      }
      failure = { status: 502, message: `Claude stopped (${message.stop_reason ?? 'no reason'}) with ${text ? 'an unusable' : 'no'} answer` };
      console.warn(`[ai] ${role}: ${failure.message}; asking Groq`);
    } catch (err) {
      // APIConnectionError is an APIError with no status: a network fault.
      const status = err instanceof Anthropic.APIError ? err.status : undefined;
      const text = err instanceof Error ? err.message : String(err);
      failure = { status: status ?? 502, message: `Claude ${status ?? 'unreachable'}: ${text.slice(0, 200)}` };
      if (claudeShouldRest(status)) {
        restUntil = Date.now() + REST_MS;
        restReason = failure.message;
        console.error(`[ai] ${failure.message}. Groq answers for the next ${REST_MS / 60000} minutes.`);
      } else {
        console.warn(`[ai] ${role}: ${failure.message}; asking Groq`);
      }
    }
  }

  if (hasGroqKey) return groqChat(role, body as unknown as Record<string, unknown>);
  return { response: errorResponse(failure.status, failure.message), model };
}
