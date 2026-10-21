import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { llmChat, LlmError, type ChatMsg } from './llm';
import { CLASSIFIER_PROMPT, MIXED_NOTE, REJECTION, SYSTEM_PROMPT, decide } from './domain';

const app = express();
app.use(express.json({ limit: '20kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a minute and try again.' } }));

const llmClassify = async (text: string) => {
  const out = await llmChat(
    [{ role: 'system', content: CLASSIFIER_PROMPT }, { role: 'user', content: text }],
    { temperature: 0, maxTokens: 30 });
  return /"verdict"\s*:\s*"allow"/i.test(out) ? ('allow' as const) : ('reject' as const);
};

app.post('/api/chat', async (req, res) => {
  const msgs = req.body?.messages;
  const valid = Array.isArray(msgs) && msgs.length > 0 && msgs.length <= 12 &&
    msgs.every((m: any) => m && (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string' && m.content.trim().length > 0 && m.content.length <= 2000) &&
    msgs[msgs.length - 1].role === 'user';
  if (!valid) return res.status(400).json({ error: 'Invalid message. Send 1–2000 characters per message.' });

  const history: ChatMsg[] = msgs.map((m: any) => ({ role: m.role, content: m.content }));
  const last = history[history.length - 1];
  try {
    const verdict = await decide(last.content, llmClassify);
    if (verdict === 'reject') return res.json({ reply: REJECTION, rejected: true });
    const sys = verdict === 'mixed' ? `${SYSTEM_PROMPT}\n${MIXED_NOTE}` : SYSTEM_PROMPT;
    const prompt: ChatMsg[] = [{ role: 'system', content: sys }, ...history.slice(0, -1), last];
    res.json({ reply: await llmChat(prompt) });
  } catch (e) {
    const err = e instanceof LlmError ? e : new LlmError(500, 'Something went wrong. Please try again.');
    if (!(e instanceof LlmError)) console.error('chat error:', (e as Error).message);
    res.status(err.status).json({ error: err.message });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`StockMind AI API on http://localhost:${port}`));
