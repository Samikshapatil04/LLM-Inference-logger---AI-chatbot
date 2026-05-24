/**
 * LLM Inference SDK / Wrapper
 * Wraps provider calls, captures rich metadata, redacts PII from previews.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

// ─── PII Redaction ────────────────────────────────────────────────────────────
const PII_RULES = [
  { re: /\b[\w.+\-]+@[\w\-]+\.[a-z]{2,}\b/gi,          sub: '[EMAIL]'   },
  { re: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,           sub: '[PHONE]'   },
  { re: /\b\d{3}-\d{2}-\d{4}\b/g,                        sub: '[SSN]'     },
  { re: /\b4[0-9]{12}(?:[0-9]{3})?\b/g,                  sub: '[CARD]'    },
  { re: /\b5[1-5][0-9]{14}\b/g,                          sub: '[CARD]'    },
  { re: /(?:password|passwd|secret|api[_-]?key)\s*[=:]\s*\S+/gi, sub: '[SECRET]' },
];

export function redactPII(text) {
  if (!text) return '';
  let out = String(text);
  for (const { re, sub } of PII_RULES) out = out.replace(re, sub);
  return out;
}

function preview(text, max = 200) {
  const s = redactPII(String(text || '').trim());
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ─── Core LLM call ────────────────────────────────────────────────────────────
export async function callLLM({ provider, model, messages, stream = false, apiKey, onChunk }) {
  const t0        = Date.now();
  const requestId = uuidv4();

  const log = {
    id:               uuidv4(),
    request_id:       requestId,
    provider,
    model,
    status:           'success',
    latency_ms:       null,
    prompt_tokens:    null,
    completion_tokens:null,
    total_tokens:     null,
    input_preview:    preview(messages.at(-1)?.content),
    output_preview:   null,
    error_message:    null,
    error_code:       null,
    is_streaming:     stream ? 1 : 0,
    created_at:       new Date().toISOString(),
    metadata:         {},
  };

  try {
    let result;
    if (provider === 'gemini') {
      result = await _callGemini({ model, messages, stream, apiKey, onChunk });
    } else {
      throw Object.assign(new Error(`Unsupported provider: ${provider}`), { code: 'UNSUPPORTED_PROVIDER' });
    }

    log.latency_ms      = Date.now() - t0;
    log.output_preview  = preview(result.content);
    if (result.usage) {
      log.prompt_tokens      = result.usage.promptTokenCount     ?? null;
      log.completion_tokens  = result.usage.candidatesTokenCount ?? null;
      log.total_tokens       = result.usage.totalTokenCount      ?? null;
    }
    return { content: result.content, log };

  } catch (err) {
    log.latency_ms    = Date.now() - t0;
    log.status        = 'error';
    log.error_message = err.message;
    log.error_code    = err.code || err.status || String(err.statusCode || 'UNKNOWN');
    throw { error: err, log };
  }
}

// ─── Gemini adapter ───────────────────────────────────────────────────────────
async function _callGemini({ model, messages, stream, apiKey, onChunk }) {
  const genAI       = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  // Convert messages → Gemini history (all but last)
  const history = messages.slice(0, -1).map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const lastMsg = messages.at(-1).content;
  const chat    = geminiModel.startChat({ history });

  if (stream && typeof onChunk === 'function') {
    const streamResult = await chat.sendMessageStream(lastMsg);
    let full = '';
    for await (const chunk of streamResult.stream) {
      const txt = chunk.text();
      full += txt;
      onChunk(txt);
    }
    const final = await streamResult.response;
    return { content: full, usage: final.usageMetadata };
  }

  const result   = await chat.sendMessage(lastMsg);
  const response = await result.response;
  return { content: response.text(), usage: response.usageMetadata };
}

// ─── Provider catalogue ───────────────────────────────────────────────────────
export const PROVIDERS = {
  gemini: {
    name:         'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Free)', free: true  },
      { id: 'gemini-2.5-pro',   name: 'Gemini 2.5 Pro',          free: false },
    ],
  },
};
