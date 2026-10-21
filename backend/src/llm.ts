// Provider-specific logic lives only here. All listed providers expose an OpenAI-compatible chat API.
export class LlmError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

const PRESETS: Record<string, { url: string; model: string }> = {
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  cerebras: { url: 'https://api.cerebras.ai/v1/chat/completions', model: 'llama3.1-8b' },
};

export async function llmChat(messages: ChatMsg[], opts: { temperature?: number; maxTokens?: number } = {}) {
  const key = process.env.LLM_API_KEY;
  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
  const preset = PRESETS[provider];
  if (!preset) throw new LlmError(500, `Unknown LLM_PROVIDER "${provider}".`);
  if (!key || key.includes('your_api_key')) throw new LlmError(500, 'Server is missing LLM_API_KEY.');
  let res: Response;
  try {
    res = await fetch(preset.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || preset.model,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 900,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new LlmError(504, 'The AI service timed out or could not be reached. Please try again.');
  }
  if (!res.ok) console.error(`LLM error ${res.status} (${provider}):`, (await res.text().catch(() => '')).slice(0, 300));
  if (res.status === 401 || res.status === 403) throw new LlmError(500, "The server's API key was rejected. Check LLM_API_KEY.");
  if (res.status === 404 || res.status === 400) throw new LlmError(500, 'The AI model or request was rejected. Check LLM_MODEL in backend/.env.');
  if (res.status === 429) throw new LlmError(429, 'The AI service is busy or the free quota is used up. Retry shortly.');
  if (!res.ok) throw new LlmError(502, 'The AI service returned an error. Please try again.');
  const data: any = await res.json().catch(() => null);
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new LlmError(502, 'The AI returned an empty response. Please retry.');
  return text as string;
}
