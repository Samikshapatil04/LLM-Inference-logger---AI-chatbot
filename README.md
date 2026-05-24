# 🔍 LLM Inference Logger

> A full-stack, production-grade system for multi-turn LLM chat with real-time inference logging, analytics dashboards, and a clean ingestion pipeline.

**Built with:** Google Gemini (free API) · Node.js/Express · React · SQLite · Recharts · Docker

---

## ✨ Feature Checklist

| Feature | Status |
|---|---|
| 🤖 Multi-turn chatbot (Gemini free tier) | ✅ |
| 📡 Streaming responses via SSE | ✅ |
| 🧰 SDK/wrapper capturing latency, tokens, status | ✅ |
| 🔄 Ingestion pipeline (POST /api/logs) | ✅ |
| 💾 SQLite storage with proper schema & indexes | ✅ |
| 📊 Dashboard — throughput, latency, error charts | ✅ |
| 💬 List / resume / cancel conversations | ✅ |
| 🔒 PII redaction on log previews | ✅ |
| 🐳 Docker Compose one-command setup | ✅ |
| 🌐 Multi-provider SDK architecture | ✅ (Gemini; extensible) |

---

## 🚀 Quick Start

### Option A — Docker (recommended, zero setup)

```bash
git clone https://github.com/YOUR_USERNAME/llm-inference-logger.git
cd llm-inference-logger

# Add your FREE Gemini key (https://aistudio.google.com/app/apikey)
echo "GEMINI_API_KEY=AIzaSy..." > .env

docker-compose up --build
```

Open → **http://localhost:3000**

### Option B — Local (Node 18+)

```bash
git clone https://github.com/YOUR_USERNAME/llm-inference-logger.git
cd llm-inference-logger

cp .env.example .env
# Edit .env — add your GEMINI_API_KEY

chmod +x start.sh && ./start.sh
```

Or manually:

```bash
# Terminal 1 — Backend
cd backend
npm install
GEMINI_API_KEY=AIzaSy... node src/index.js
# → http://localhost:3001

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## 🔑 Getting a Free Gemini API Key

1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with Google → click **Create API Key**
3. No credit card required

**Free tier limits:**
- Gemini 1.5 Flash: 15 RPM, 1M tokens/day
- Gemini 2.0 Flash (Exp): 10 RPM, 1M tokens/day

You can enter the key in the app's **Settings modal** (bottom-left gear icon) — stored in `localStorage`. Or set it as `GEMINI_API_KEY` in your `.env`.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  BROWSER (React)                          │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  ChatPage │  │ DashboardPage│  │   LogsPage      │   │
│  │ SSE+MD   │  │  Recharts    │  │ filterable table │   │
│  └─────┬─────┘  └──────┬───────┘  └───────┬─────────┘   │
│        └───────────────┴──────────────────┘              │
│                        │ HTTP / SSE                       │
└────────────────────────┼─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                  EXPRESS API (Node.js)                     │
│                                                           │
│  POST /api/chat/:id/messages  ← SSE streaming endpoint   │
│  GET|POST|PATCH|DELETE /api/conversations                 │
│  GET|POST /api/logs                                       │
│  GET /api/logs/analytics                                  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │            LLM SDK Wrapper (sdk/llm-sdk.js)         │  │
│  │  • callLLM()  — provider-agnostic                  │  │
│  │  • Captures: start/end timestamp → latency_ms      │  │
│  │  • Reads: usage.promptTokenCount / candidatesToken │  │
│  │  • PII redaction before storing previews           │  │
│  │  • Streaming + non-streaming modes                  │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                 │
│  ┌──────────────────────▼─────────────────────────────┐  │
│  │          Ingestion Pipeline (routes/logs.js)        │  │
│  │  POST /api/logs ← validates payload → writes DB    │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                 │
│  ┌──────────────────────▼─────────────────────────────┐  │
│  │            SQLite via sql.js (in-process)           │  │
│  │   conversations  |  messages  |  inference_logs    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────┘
                           │
               ┌───────────▼──────────┐
               │   Google Gemini API  │
               │  (free tier)         │
               └──────────────────────┘
```

---

## 🗄️ Schema Design

### `conversations`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `title` | TEXT | Auto-set from first user message |
| `provider` | TEXT | `gemini` \| future: `openai`, `anthropic` |
| `model` | TEXT | e.g. `gemini-1.5-flash` |
| `status` | TEXT | `active` \| `cancelled` |
| `created_at` / `updated_at` | TEXT | ISO 8601 |
| `message_count` | INTEGER | **Denormalized** counter — avoids COUNT(*) on list view |
| `total_tokens` | INTEGER | Cumulative for budget tracking |
| `total_latency_ms` | INTEGER | Cumulative for monitoring |

### `messages`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `conversation_id` | TEXT FK | |
| `role` | TEXT | `user` \| `assistant` \| `system` |
| `content` | TEXT | Full message body |
| `content_preview` | TEXT | First 200 chars — used in list views to avoid full scan |

### `inference_logs`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID per log entry |
| `conversation_id` | TEXT FK | |
| `message_id` | TEXT | Links to the assistant message produced |
| `provider` | TEXT | `gemini` |
| `model` | TEXT | e.g. `gemini-1.5-flash` |
| `status` | TEXT | `success` \| `error` |
| `latency_ms` | INTEGER | Wall-clock from request start → full response |
| `prompt_tokens` | INTEGER | From provider usage metadata |
| `completion_tokens` | INTEGER | From provider usage metadata |
| `total_tokens` | INTEGER | Sum |
| `input_preview` | TEXT | PII-redacted, max 200 chars |
| `output_preview` | TEXT | PII-redacted, max 200 chars |
| `error_message` / `error_code` | TEXT | Populated on failure |
| `is_streaming` | INTEGER | 0/1 boolean |
| `request_id` | TEXT | UUID per request (for tracing) |
| `created_at` | TEXT | ISO 8601 |
| `metadata` | TEXT | JSON blob — extensible without migrations |

**Indexes:** `conversation_id` on both messages and logs, `created_at` on logs (range queries), `status` on conversations.

---

## 📡 Ingestion Flow

```
User sends message
  → POST /api/chat/:id/messages
  → Save user message to DB
  → Load last 20 messages (context window)
  → callLLM() — SDK wrapper:
      ↳ Record t0
      ↳ Call Gemini API (streaming or not)
      ↳ Stream SSE chunks to browser via res.write()
      ↳ Accumulate full response
      ↳ Record t1 → latency_ms = t1 - t0
      ↳ Extract token counts from usageMetadata
      ↳ Build inference_log object (PII-redacted previews)
  → Save assistant message to DB
  → Save inference_log to DB  ← ingestion step
  → Update conversation counters (tokens, latency, title)
  → Send {type:'done', logId, latencyMs, usage} over SSE

External systems can also push:
  → POST /api/logs { conversation_id, provider, model, ... }
  → Validated, stored, indexed
```

---

## ⚖️ Trade-offs Made

| Decision | Rationale | Trade-off |
|---|---|---|
| **sql.js (pure-JS SQLite)** | Works without native binaries — Docker-friendly, zero infra | In-memory with file persist; single-writer; not suited for >1 process |
| **SSE over WebSockets** | Simpler; HTTP/2 compatible; works through standard nginx/proxies with no upgrade handshake | No bidirectional streaming (not needed here) |
| **Synchronous log writes** | Guarantees no log loss on client disconnect | Adds ~1ms to response time per request |
| **Denormalized counters on conversations** | Fast sidebar list render without COUNT(*) joins | Counter drift possible if writes fail mid-transaction |
| **Client-side API key storage** | Great DX for demo; no auth layer needed | Production needs server-side key vault + JWT auth |
| **Context window = last 20 messages** | Prevents unbounded token cost | Long conversations lose early context |
| **metadata TEXT JSON column** | Schema flexibility without migrations | No indexed queries on metadata fields |

---

## 🔒 PII Redaction

The SDK redacts from **previews only** (not full message content):

| Pattern | Replacement |
|---|---|
| Email addresses | `[EMAIL]` |
| US phone numbers | `[PHONE]` |
| Social Security Numbers | `[SSN]` |
| Credit card numbers (Visa/MC) | `[CARD]` |
| `password=`, `api_key=`, `secret=` values | `[SECRET]` |

Full content stored unredacted — production deployments should add NLP-based redaction or encrypt at rest.

---

## 🔮 What I'd Improve With More Time

1. **Event-driven architecture** — Publish to Redis Streams/Kafka on each inference; fan out to multiple consumers (logging, alerting, cost tracking, billing).

2. **PostgreSQL + TimescaleDB** — Replace SQLite for production. TimescaleDB is purpose-built for time-series analytics on `inference_logs`.

3. **Auth layer** — JWT-based user accounts; conversations scoped to users; API key management per user.

4. **Multi-provider completeness** — Adapters for OpenAI, Anthropic, Groq, Ollama. The `callLLM()` interface supports this — just add new `if (provider === 'openai')` branches.

5. **Context summarization** — Summarize old turns before dropping them to stay within the model's context window without losing information.

6. **Cost tracking** — Map `(model, tokens)` → USD using published pricing tables; store and display per-conversation cost.

7. **Alerting** — Webhook/email/Slack alerts when error rate spikes or p99 exceeds an SLA threshold.

8. **OpenTelemetry** — Replace custom logging with OTEL spans/traces for standard distributed tracing (Jaeger, Grafana Tempo).

9. **k8s Helm chart** — Separate backend deployments with HPA, Redis sidecar for session state, PostgreSQL with read replicas, cert-manager for TLS.

10. **Streaming token-level latency** — Capture TTFT (time-to-first-token) separately from full response latency — critical metric for UX quality.

---

## 📁 Project Structure

```
llm-inference-logger/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   └── database.js          # sql.js init, schema, persist, helpers
│   │   ├── sdk/
│   │   │   └── llm-sdk.js           # Provider wrapper + PII redaction
│   │   ├── routes/
│   │   │   ├── conversations.js     # CRUD: list/get/create/update/cancel
│   │   │   ├── chat.js              # SSE streaming chat endpoint
│   │   │   └── logs.js              # Ingestion endpoint + analytics
│   │   └── index.js                 # Express app entry point
│   ├── data/                        # SQLite DB (git-ignored)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.js               # Typed API client + SSE helper
│   │   │   └── markdown.js          # Zero-dep markdown → HTML renderer
│   │   ├── components/
│   │   │   ├── Sidebar.jsx          # Nav + live conversation list
│   │   │   └── SettingsModal.jsx    # API key configuration
│   │   ├── pages/
│   │   │   ├── ChatPage.jsx         # Streaming chat UI
│   │   │   ├── DashboardPage.jsx    # Analytics with Recharts
│   │   │   └── LogsPage.jsx         # Expandable log table
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css                # Design tokens + animations
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── nginx.conf                   # For Docker frontend container
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── nginx.conf
├── docker-compose.yml
├── start.sh                         # Local dev quick-start
├── .env.example
├── .gitignore
└── README.md
```

---

## 📬 Submission

**Built for:** work@ollive.ai

- GitHub: [your-repo-url]
- Demo: [your-demo-url or Loom link]
