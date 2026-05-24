import express    from 'express';
import cors       from 'cors';
import morgan     from 'morgan';
import { initDB } from './db/database.js';
import conversationsRouter from './routes/conversations.js';
import chatRouter          from './routes/chat.js';
import logsRouter          from './routes/logs.js';

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin:  process.env.FRONTEND_URL || '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-api-key'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.json({ status:'ok', timestamp: new Date().toISOString(), version:'1.0.0' })
);

// ── API index ─────────────────────────────────────────────────────────────
app.get('/api', (_req, res) => res.json({
  name: 'LLM Inference Logger API',
  version: '1.0.0',
  endpoints: {
    'GET  /health':                          'Health check',
    'GET  /api/conversations':               'List conversations',
    'POST /api/conversations':               'Create conversation',
    'GET  /api/conversations/:id':           'Get conversation + messages',
    'PATCH /api/conversations/:id':          'Update title / status',
    'DELETE /api/conversations/:id':         'Cancel conversation',
    'POST /api/chat/:conversationId/messages':'Send message (SSE streaming)',
    'GET  /api/logs':                        'Get inference logs',
    'POST /api/logs':                        'Ingest external log',
    'GET  /api/logs/analytics':              'Dashboard analytics',
  },
}));

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/conversations', conversationsRouter);
app.use('/api/chat',          chatRouter);
app.use('/api/logs',          logsRouter);

// ── 404 ───────────────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` })
);

// ── Error handler ─────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────
async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`\n🚀  LLM Inference Logger API → http://localhost:${PORT}`);
    console.log(`📊  Analytics  → http://localhost:${PORT}/api/logs/analytics`);
    console.log(`💬  Chat API   → http://localhost:${PORT}/api/chat/:id/messages`);
    console.log(`📋  Logs       → http://localhost:${PORT}/api/logs`);
    if (!process.env.GEMINI_API_KEY) {
      console.log(`\n⚠️   GEMINI_API_KEY not set — pass it via x-api-key header or .env`);
    }
  });
}

start().catch(console.error);

export default app;
