const BASE = '/api';

let _apiKey = localStorage.getItem('gemini_api_key') || '';

export const setApiKey = (k) => { _apiKey = k; localStorage.setItem('gemini_api_key', k); };
export const getApiKey = ()  => _apiKey;

async function req(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(_apiKey ? { 'x-api-key': _apiKey } : {}),
    ...opts.headers,
  };
  const r = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!r.ok) {
    const e = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(e.error || `HTTP ${r.status}`);
  }
  return r.json();
}

function qs(p) { const q = new URLSearchParams(p).toString(); return q ? `?${q}` : ''; }

export const api = {
  conversations: {
    list:   (p = {}) => req(`/conversations${qs(p)}`),
    get:    (id)     => req(`/conversations/${id}`),
    create: (data)   => req('/conversations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, d)  => req(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    cancel: (id)     => req(`/conversations/${id}`, { method: 'DELETE' }),
  },

  chat: {
    /**
     * Stream a message via SSE.
     * Returns an abort function.
     */
    sendStream(conversationId, content, onChunk, onDone, onError) {
      const ctrl = new AbortController();

      fetch(`${BASE}/chat/${conversationId}/messages`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(_apiKey ? { 'x-api-key': _apiKey } : {}),
        },
        body:   JSON.stringify({ content, stream: true }),
        signal: ctrl.signal,
      }).then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          onError(e.error || `HTTP ${r.status}`);
          return;
        }
        const reader  = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const d = JSON.parse(line.slice(6));
              if      (d.type === 'chunk') onChunk(d.content);
              else if (d.type === 'done')  onDone(d);
              else if (d.type === 'error') onError(d.error);
            } catch {}
          }
        }
      }).catch(e => { if (e.name !== 'AbortError') onError(e.message); });

      return () => ctrl.abort();
    },
  },

  logs: {
    list:      (p = {}) => req(`/logs${qs(p)}`),
    analytics: (hours = 24) => req(`/logs/analytics?hours=${hours}`),
    ingest:    (data)  => req('/logs', { method: 'POST', body: JSON.stringify(data) }),
  },
};
