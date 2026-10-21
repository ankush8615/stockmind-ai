import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendChat, type Msg } from './api';

type Chat = { id: string; title: string; messages: Msg[] };
type Failed = { text: string; base: Msg[]; id: string | null };

const KEY = 'stockmind.chats';
const SUGGESTIONS = ['What is the stock market?', 'Explain the P/E ratio.', 'What is the difference between NSE and BSE?',
  'Explain fundamental vs technical analysis.', 'How does a stop-loss work?', 'What is the Nifty 50?'];
const DISCLAIMER = 'StockMind AI provides educational information and market analysis for informational purposes only. It does not guarantee investment returns. Verify financial information independently before making investment decisions.';
const btn = 'bg-gray-900 text-white rounded px-3 py-2 text-sm disabled:opacity-40';
const outline = 'border border-gray-200 rounded px-3 py-2 text-sm text-left';

export default function App() {
  const [chats, setChats] = useState<Chat[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState<Failed | null>(null);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const messages = chats.find((c) => c.id === activeId)?.messages ?? [];

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(chats)); } catch { /* storage unavailable */ }
  }, [chats]);
  useEffect(() => {
    end.current?.scrollIntoView();
  }, [messages.length, loading]);

  const upsert = (id: string, title: string, msgs: Msg[]) =>
    setChats((c) => (c.some((x) => x.id === id) ? c.map((x) => (x.id === id ? { ...x, messages: msgs } : x)) : [{ id, title, messages: msgs }, ...c]));

  async function ask(text: string, base: Msg[] = messages, id: string | null = activeId) {
    const q = text.trim();
    if (!q || loading) return;
    const chatId = id ?? crypto.randomUUID();
    const next: Msg[] = [...base, { role: 'user', content: q }];
    setActiveId(chatId); upsert(chatId, q.slice(0, 40), next);
    setInput(''); setError(''); setFailed(null); setLoading(true);
    try {
      upsert(chatId, q.slice(0, 40), [...next, { role: 'assistant', content: await sendChat(next) }]);
    } catch (e) {
      setError((e as Error).message); setFailed({ text: q, base, id: chatId });
    } finally { setLoading(false); }
  }

  const newChat = () => { setActiveId(null); setError(''); setFailed(null); setMenu(false); };

  return (
    <div className="flex h-screen bg-white text-gray-900">
      <aside className={`${menu ? 'flex' : 'hidden'} md:flex w-64 shrink-0 flex-col border-r border-gray-200 p-3 gap-3 absolute md:static inset-y-0 left-0 bg-white z-10`}>
        <div className="font-semibold">StockMind AI</div>
        <button className={btn} onClick={newChat}>New chat</button>
        <nav aria-label="Chat history" className="flex-1 overflow-y-auto flex flex-col gap-1">
          {chats.map((c) => (
            <button key={c.id} onClick={() => { setActiveId(c.id); setMenu(false); }}
              className={`text-sm text-left rounded px-2 py-1.5 truncate ${c.id === activeId ? 'bg-gray-100' : ''}`}>{c.title}</button>
          ))}
        </nav>
        <p className="text-xs text-gray-500">Supports stock-market questions only.</p>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button className="md:hidden border border-gray-200 rounded px-2 py-1 text-sm" aria-label="Toggle sidebar" onClick={() => setMenu(!menu)}>Menu</button>
          <div>
            <h1 className="font-semibold leading-tight">StockMind AI</h1>
            <p className="text-sm text-gray-500">Your AI assistant for stock market learning and analysis.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto flex flex-col gap-5">
            {messages.length === 0 && (
              <div className="text-center mt-10">
                <h2 className="text-xl font-semibold">Ask anything about the stock market</h2>
                <p className="text-sm text-gray-500 mt-1 mb-5">Pick a question to start, or type your own.</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s) => <button key={s} className={outline} onClick={() => ask(s)}>{s}</button>)}
                </div>
              </div>
            )}
            {messages.map((m, i) => m.role === 'user' ? (
              <div key={i} className="self-end bg-gray-100 rounded px-3 py-2 max-w-[85%] whitespace-pre-wrap">{m.content}</div>
            ) : (
              <div key={i}>
                <div className="md text-[15px] leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                <button className="text-xs text-gray-500 mt-1" onClick={() => { navigator.clipboard.writeText(m.content); setCopied(i); }}>
                  {copied === i ? 'Copied' : 'Copy answer'}
                </button>
              </div>
            ))}
            {loading && <p className="text-sm text-gray-500" role="status">Thinking…</p>}
            {error && (
              <div className="border border-gray-200 rounded p-3 text-sm" role="alert">
                {error}{' '}
                {failed && <button className="underline" onClick={() => ask(failed.text, failed.base, failed.id)}>Retry</button>}
              </div>
            )}
            <div ref={end} />
          </div>
        </div>

        <div className="border-t border-gray-200 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <textarea rows={2} maxLength={2000} value={input} onChange={(e) => setInput(e.target.value)} aria-label="Your question"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
                placeholder="Ask a stock-market question…" className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-900" />
              <button className={btn} disabled={loading || !input.trim()} onClick={() => ask(input)}>{loading ? 'Sending…' : 'Send'}</button>
            </div>
            <p className="text-xs text-gray-500 mt-2">{DISCLAIMER}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
