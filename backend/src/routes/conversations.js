import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB, persistDB, queryAll, queryOne } from '../db/database.js';

const router = Router();

// ── GET /conversations ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT * FROM conversations`;
    const params = [];
    if (status) { sql += ` WHERE status = ?`; params.push(status); }
    sql += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));
    const conversations = queryAll(sql, params);
    res.json({ conversations, total: conversations.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /conversations/:id ─────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const conv = queryOne('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const messages = queryAll(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ conversation: conv, messages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /conversations ────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const db  = getDB();
    const { title = 'New Conversation', provider = 'gemini', model = 'gemini-2.5-flash' } = req.body;
    const id  = uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO conversations (id,title,provider,model,status,created_at,updated_at)
       VALUES (?,?,?,?,'active',?,?)`,
      [id, title, provider, model, now, now]
    );
    persistDB();
    const conv = queryOne('SELECT * FROM conversations WHERE id = ?', [id]);
    res.status(201).json({ conversation: conv });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /conversations/:id ───────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  try {
    const db  = getDB();
    const now = new Date().toISOString();
    const { title, status } = req.body;
    if (title  !== undefined) db.run('UPDATE conversations SET title=?,updated_at=? WHERE id=?',  [title, now, req.params.id]);
    if (status !== undefined) db.run('UPDATE conversations SET status=?,updated_at=? WHERE id=?', [status, now, req.params.id]);
    persistDB();
    const conv = queryOne('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
    if (!conv) return res.status(404).json({ error: 'Not found' });
    res.json({ conversation: conv });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /conversations/:id  (cancel) ────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const db = getDB();
    db.run(
      `UPDATE conversations SET status='cancelled', updated_at=? WHERE id=?`,
      [new Date().toISOString(), req.params.id]
    );
    persistDB();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
