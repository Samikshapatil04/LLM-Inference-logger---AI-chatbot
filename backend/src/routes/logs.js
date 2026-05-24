import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, persistDB, queryAll, queryOne } from '../db/database.js';

const router = Router();

// ── GET /logs/analytics  (must come before /:id) ───────────────────────────
router.get('/analytics', (req, res) => {
  try {
    const hours = Number(req.query.hours ?? 24);
    const since = new Date(Date.now() - hours * 3_600_000).toISOString();

    const overall = queryOne(
      `SELECT
         COUNT(*)                                              AS total_requests,
         SUM(CASE WHEN status='success' THEN 1 ELSE 0 END)   AS successful,
         SUM(CASE WHEN status='error'   THEN 1 ELSE 0 END)   AS errors,
         AVG(latency_ms)                                      AS avg_latency_ms,
         MAX(latency_ms)                                      AS max_latency_ms,
         MIN(latency_ms)                                      AS min_latency_ms,
         SUM(total_tokens)                                    AS total_tokens,
         SUM(prompt_tokens)                                   AS total_prompt_tokens,
         SUM(completion_tokens)                               AS total_completion_tokens
       FROM inference_logs WHERE created_at >= ?`, [since]
    );

    const throughput = queryAll(
      `SELECT
         strftime('%Y-%m-%dT%H:00:00', created_at) AS hour,
         COUNT(*)                                   AS requests,
         AVG(latency_ms)                            AS avg_latency,
         SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errors
       FROM inference_logs WHERE created_at >= ?
       GROUP BY hour ORDER BY hour ASC`, [since]
    );

    const byModel = queryAll(
      `SELECT model, provider,
         COUNT(*)    AS requests,
         AVG(latency_ms) AS avg_latency,
         SUM(total_tokens) AS tokens,
         SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errors
       FROM inference_logs WHERE created_at >= ?
       GROUP BY model, provider ORDER BY requests DESC`, [since]
    );

    // Latency percentiles
    const lats = queryAll(
      `SELECT latency_ms FROM inference_logs
       WHERE created_at >= ? AND latency_ms IS NOT NULL AND status='success'
       ORDER BY latency_ms`, [since]
    ).map(r => r.latency_ms);

    const pct = (arr, p) => arr.length ? arr[Math.floor(arr.length * p)] : null;

    const convStats = queryOne(
      `SELECT COUNT(*) AS total,
         SUM(CASE WHEN status='active'    THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled
       FROM conversations`
    );

    const recentErrors = queryAll(
      `SELECT id,model,provider,error_message,error_code,created_at,input_preview
       FROM inference_logs WHERE status='error'
       ORDER BY created_at DESC LIMIT 10`
    );

    const total = Number(overall?.total_requests ?? 0);
    const errs  = Number(overall?.errors ?? 0);

    res.json({
      period_hours: hours,
      overall: {
        ...overall,
        error_rate:   total ? ((errs / total) * 100).toFixed(2) : '0.00',
        success_rate: total ? (((total - errs) / total) * 100).toFixed(2) : '0.00',
      },
      latency_percentiles: { p50: pct(lats, 0.5), p90: pct(lats, 0.9), p99: pct(lats, 0.99) },
      throughput,
      by_model: byModel,
      conversations: convStats,
      recent_errors: recentErrors,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /logs ──────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { conversation_id, status, limit = 100, offset = 0 } = req.query;
    let sql = `SELECT * FROM inference_logs WHERE 1=1`;
    const params = [];
    if (conversation_id) { sql += ` AND conversation_id=?`; params.push(conversation_id); }
    if (status)          { sql += ` AND status=?`;          params.push(status); }
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));
    const logs = queryAll(sql, params).map(l => {
      try { l.metadata = JSON.parse(l.metadata || '{}'); } catch {}
      return l;
    });
    res.json({ logs, total: logs.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /logs  (external ingestion endpoint) ──────────────────────────────
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const p  = req.body;
    if (!p.conversation_id || !p.provider || !p.model)
      return res.status(400).json({ error: 'conversation_id, provider, model are required' });

    const id  = p.id || uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO inference_logs
       (id,conversation_id,message_id,provider,model,status,
        latency_ms,prompt_tokens,completion_tokens,total_tokens,
        input_preview,output_preview,error_message,error_code,
        is_streaming,request_id,created_at,metadata)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, p.conversation_id, p.message_id ?? null,
        p.provider, p.model, p.status ?? 'success',
        p.latency_ms ?? null,
        p.prompt_tokens ?? null, p.completion_tokens ?? null, p.total_tokens ?? null,
        p.input_preview  ? String(p.input_preview).slice(0, 200)  : null,
        p.output_preview ? String(p.output_preview).slice(0, 200) : null,
        p.error_message ?? null, p.error_code ?? null,
        p.is_streaming ? 1 : 0, p.request_id ?? null,
        p.created_at ?? now, JSON.stringify(p.metadata ?? {}),
      ]
    );
    persistDB();
    res.status(201).json({ success: true, id, ingested_at: now });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
