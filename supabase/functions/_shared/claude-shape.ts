// ─── Claude requests in Groq's shape, and back ──────────────────
//
// rag-search was written against Groq's chat completions: system messages
// in the list, `response_format: json_object`, and a reply read from
// `choices[0].message.content`. When ANTHROPIC_API_KEY is set, ai.ts sends
// the same request to Claude first; this file is the translation both ways,
// pure (no Deno, no SDK), so the QA self-test can pin it.
//
// Rules Claude keeps that Groq does not:
//   - System text is one `system` field, not messages.
//   - The first message is the user's, and no message is empty.
//   - No `temperature` (the 2026-10-21 API version refuses every sampling
//     parameter) and no assistant message last (a prefill, refused on the
//     current models).
//   - JSON comes from a schema (structured outputs), not a mode, so every
//     JSON call names its schema.
// ────────────────────────────────────────────────────────────────

/** The steps that call a model, as groq.ts names them. */
export type AiRole = 'answer' | 'condense' | 'rerank';

/** Haiku: the fast, cheap model, for every step unless a secret says otherwise. */
export const CLAUDE_DEFAULT_MODEL = 'claude-haiku-5-5';

/** The secret that picks each step's Claude model. */
export const CLAUDE_ROLE_ENV: Record<AiRole, string> = {
  answer: 'CLAUDE_MODEL',
  condense: 'CLAUDE_CONDENSE_MODEL',
  rerank: 'CLAUDE_RERANK_MODEL',
};

/**
 * Room to answer. Thinking is adaptive on the current models and counts
 * towards max_tokens, so Groq's numbers (sized for a reply alone) are a
 * floor, not the limit. Unused room costs nothing.
 */
export const CLAUDE_MIN_MAX_TOKENS = 4096;

export interface GroqStyleMessage {
  role: string;
  content: string;
}

export interface GroqStyleBody {
  messages: GroqStyleMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: string };
}

export type JsonSchema = Record<string, unknown>;

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: ClaudeMessage[];
  output_config: {
    effort: 'low';
    format?: { type: 'json_schema'; schema: JsonSchema };
  };
}

/**
 * The Groq request as Claude takes it. Low effort: these are short reads of
 * a few passages, and effort is the one control every current model accepts
 * (Haiku and Sonnet can turn thinking off, Opus cannot).
 */
export function toClaudeRequest(body: GroqStyleBody, model: string, schema?: JsonSchema): ClaudeRequest {
  const system = body.messages
    .filter((m) => m.role === 'system' && m.content.trim())
    .map((m) => m.content)
    .join('\n\n');

  const messages: ClaudeMessage[] = body.messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim())
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  // A conversation that opens with the assistant (an older app's history)
  // would be refused: the first message is the user's.
  while (messages.length && messages[0].role !== 'user') messages.shift();

  return {
    model,
    max_tokens: Math.max(body.max_tokens ?? 0, CLAUDE_MIN_MAX_TOKENS),
    ...(system ? { system } : {}),
    messages,
    output_config: {
      effort: 'low',
      ...(schema ? { format: { type: 'json_schema' as const, schema } } : {}),
    },
  };
}

/** Whether a request can go to Claude as it is: something to answer, ending with the user. */
export function claudeCanTake(request: ClaudeRequest): boolean {
  const last = request.messages[request.messages.length - 1];
  return !!last && last.role === 'user';
}

/** The answer's text: every text block, in order. Thinking blocks are not the answer. */
export function claudeText(content: { type: string; text?: string }[]): string {
  return content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
    .trim();
}

/**
 * Whether Claude's reply can be used, or Groq should be asked instead.
 * A refusal is no answer. JSON cut off at max_tokens does not parse, so it
 * is no answer either; a written answer that ran long still reads.
 */
export function claudeUsable(stopReason: string | null | undefined, text: string, wantsJson: boolean): boolean {
  if (!text) return false;
  if (stopReason === 'refusal') return false;
  if (wantsJson && stopReason === 'max_tokens') return false;
  return true;
}

/** Claude's reply in the shape rag-search reads from Groq. */
export function groqStyleReply(
  text: string,
  stopReason: string | null | undefined,
  usage?: { input_tokens?: number; output_tokens?: number },
): Record<string, unknown> {
  return {
    choices: [{
      message: { role: 'assistant', content: text },
      finish_reason: stopReason === 'max_tokens' ? 'length' : 'stop',
    }],
    usage: { prompt_tokens: usage?.input_tokens ?? 0, completion_tokens: usage?.output_tokens ?? 0 },
  };
}

/**
 * The HTTP statuses after which Claude is left alone for a while: no key,
 * no credit, no such model, or a request it will never take. Asking again on
 * every question would only add a wasted call before Groq's answer. A rate
 * limit, an overload or a passing fault (429, 5xx) is tried again next time.
 */
export function claudeShouldRest(status: number | undefined): boolean {
  return status === 400 || status === 401 || status === 402 || status === 403 || status === 404;
}
