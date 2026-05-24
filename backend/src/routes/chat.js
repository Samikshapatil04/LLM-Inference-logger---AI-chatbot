import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, persistDB, queryAll, queryOne } from '../db/database.js';
import { callLLM } from '../sdk/llm-sdk.js';

const router = Router();

function saveMsg(db, { id, conversationId, role, content }) {
  const preview = content.length > 200 ? content.slice(0, 200) + '…' : content;
  db.run(
    `INSERT INTO messages (id,conversation_id,role,content,content_preview,created_at)
     VALUES (?,?,?,?,?,?)`,
    [id, conversationId, role, content, preview, new Date().toISOString()]
  );
}

function saveLog(db, { conversationId, messageId, log }) {
  db.run(
    `INSERT INTO inference_logs
     (id,conversation_id,message_id,provider,model,status,
      latency_ms,prompt_tokens,completion_tokens,total_tokens,
      input_preview,output_preview,error_message,error_code,
      is_streaming,request_id,created_at,metadata)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      log.id, conversationId, messageId ?? null,
      log.provider, log.model, log.status,
      log.latency_ms ?? null,
      log.prompt_tokens ?? null, log.completion_tokens ?? null, log.total_tokens ?? null,
      log.input_preview ?? null, log.output_preview ?? null,
      log.error_message ?? null, log.error_code ?? null,
      log.is_streaming ?? 0, log.request_id ?? null,
      log.created_at, JSON.stringify(log.metadata ?? {}),
    ]
  );
}

function updateConvStats(db, { id, tokens, latency, firstMessage }) {
  const now = new Date().toISOString();
  db.run(
    `UPDATE conversations SET
       updated_at      = ?,
       message_count   = message_count + 2,
       total_tokens    = total_tokens + ?,
       total_latency_ms= total_latency_ms + ?,
       title = CASE WHEN title = 'New Conversation' THEN ? ELSE title END
     WHERE id = ?`,
    [now, tokens ?? 0, latency ?? 0, firstMessage.slice(0, 60), id]
  );
}

// ── POST /chat/:conversationId/messages ────────────────────────────────────
router.post('/:conversationId/messages', async (req, res) => {
  const { conversationId } = req.params;
  const { content, stream = true } = req.body;

  if (!content?.trim())
    return res.status(400).json({ error: 'content is required' });

  const db = getDB();
  const conv = queryOne('SELECT * FROM conversations WHERE id = ?', [conversationId]);
  if (!conv)                        return res.status(404).json({ error: 'Conversation not found' });
  if (conv.status === 'cancelled')  return res.status(400).json({ error: 'Conversation is cancelled. Resume it first.' });

  const apiKey = req.headers['x-api-key'] || process.env.GEMINI_API_KEY || '';
  if (!apiKey)
    return res.status(400).json({
      error: 'Gemini API key required. Set GEMINI_API_KEY env var or send x-api-key header.'
    });

  // Save user message
  const userMsgId = uuidv4();
  saveMsg(db, { id: userMsgId, conversationId, role: 'user', content });

  // Build context (last 20 messages)
  const history = queryAll(
    `SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 20`,
    [conversationId]
  );

  const assistantMsgId = uuidv4();

  // ── Streaming (SSE) ──────────────────────────────────────────────────────
  if (stream) {
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    try {
      const { content: reply, log } = await callLLM({
        provider: conv.provider || 'gemini',
        model:    conv.model    || 'gemini-2.5-flash',
        messages: history,
        stream:   true,
        apiKey,
        onChunk:  (chunk) => send({ type: 'chunk', content: chunk }),
      });

      saveMsg(db, { id: assistantMsgId, conversationId, role: 'assistant', content: reply });
      saveLog(db, { conversationId, messageId: assistantMsgId, log });
      updateConvStats(db, { id: conversationId, tokens: log.total_tokens, latency: log.latency_ms, firstMessage: content });
      persistDB();

      send({
        type:      'done',
        messageId: assistantMsgId,
        logId:     log.id,
        latencyMs: log.latency_ms,
        usage:     { promptTokens: log.prompt_tokens, completionTokens: log.completion_tokens, totalTokens: log.total_tokens },
      });
      res.end();

    } catch ({ error, log }) {
      if (log) saveLog(db, { conversationId, messageId: null, log });
      persistDB();
      send({ type: 'error', error: error?.message ?? 'Unknown error' });
      res.end();
    }
    return;
  }

  // ── Non-streaming fallback ───────────────────────────────────────────────
  try {
    const { content: reply, log } = await callLLM({
      provider: conv.provider || 'gemini',
      model:    conv.model    || 'gemini-2.5-flash',
      messages: history,
      stream:   false,
      apiKey,
    });
    saveMsg(db, { id: assistantMsgId, conversationId, role: 'assistant', content: reply });
    saveLog(db, { conversationId, messageId: assistantMsgId, log });
    updateConvStats(db, { id: conversationId, tokens: log.total_tokens, latency: log.latency_ms, firstMessage: content });
    persistDB();
    res.json({ message: { id: assistantMsgId, role: 'assistant', content: reply }, log });
  } catch ({ error, log }) {
    if (log) saveLog(db, { conversationId, messageId: null, log });
    persistDB();
    res.status(500).json({ error: error?.message ?? 'LLM call failed' });
  }
});

export default router;
