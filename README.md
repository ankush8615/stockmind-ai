# StockMind AI

```
backend/   Express API, domain filter, LLM service, tests  (port 3000)
frontend/  React + TypeScript + Tailwind UI                 (port 5173)
```

## Run
1. Backend: `cd backend && npm install && cp .env.example .env`, edit `.env` (see below), then `npm run dev`. Tests: `npm test`.
2. Frontend (second terminal): `cd frontend && npm install && npm run dev` → http://localhost:5173 (proxies `/api` to the backend).

## Free API keys (you must create your own; free limits change often)
Set `LLM_PROVIDER` and `LLM_API_KEY` in `backend/.env`:
- `gemini` – key from https://aistudio.google.com/apikey (free tier, no card; Flash models only)
- `groq` – https://console.groq.com/keys
- `openrouter` – https://openrouter.ai/keys (use a `:free` model)
- `cerebras` – https://cloud.cerebras.ai
If a model name is rejected, set `LLM_MODEL` to a current one from that provider's docs. The backend terminal prints the provider's real error.
