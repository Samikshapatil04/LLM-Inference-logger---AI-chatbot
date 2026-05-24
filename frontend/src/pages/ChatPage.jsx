import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api.js';
import { renderMarkdown } from '../lib/markdown.js';
import {
  Send, Plus, Bot, User, Clock, Zap,
  AlertCircle, StopCircle, Info,
} from 'lucide-react';

/* ── Sub-components ─────────────────────────────────────────────────────── */
function TypingDots() {
  return (
    <div style={{ display:'flex', gap:4, padding:'10px 0 4px' }}>
      {[0,1,2].map(i => <div key={i} className="typing-dot" style={{ flexShrink:0 }} />)}
    </div>
  );
}

function InferenceMeta({ log }) {
  if (!log) return null;
  return (
    <div style={{ display:'flex', gap:10, marginTop:5, fontSize:10, color:'var(--text-muted)' }}>
      {log.latencyMs     && <span style={{ display:'flex', alignItems:'center', gap:3 }}><Clock size={9}/>{log.latencyMs}ms</span>}
      {log.usage?.totalTokens && <span style={{ display:'flex', alignItems:'center', gap:3 }}><Zap size={9}/>{log.usage.totalTokens} tok</span>}
    </div>
  );
}

function Bubble({ msg, isStreaming }) {
  const isUser = msg.role === 'user';
  return (
    <div className="animate-in" style={{
      display:'flex', gap:10, padding:'10px 0',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems:'flex-start',
    }}>
      {/* Avatar */}
      <div style={{
        width:30, height:30, borderRadius:8, flexShrink:0,
        background: isUser ? 'var(--accent-dim)'  : 'var(--bg-overlay)',
        border:     `1px solid ${isUser ? 'rgba(108,99,255,.3)' : 'var(--border)'}`,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        {isUser
          ? <User size={13} color="var(--accent-light)" />
          : <Bot  size={13} color="var(--green)" />
        }
      </div>

      {/* Bubble */}
      <div style={{ flex:1, maxWidth:'76%' }}>
        <div style={{
          background: isUser ? 'var(--accent-dim)'  : 'var(--bg-surface)',
          border:     `1px solid ${isUser ? 'rgba(108,99,255,.22)' : 'var(--border)'}`,
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          padding:'10px 14px',
        }}>
          {isUser
            ? <p style={{ margin:0, fontSize:13, lineHeight:1.65 }}>{msg.content}</p>
            : msg.content
              ? <div className="msg-content" style={{ fontSize:13 }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
              : <TypingDots />
          }
          {isStreaming && msg.content && <span className="cursor-blink" />}
        </div>
        {msg._log && <InferenceMeta log={msg._log} />}
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function ChatPage({ activeConvId, setActiveConvId, onConversationChange }) {
  const [conv,      setConv]      = useState(null);
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamId,  setStreamId]  = useState(null);
  const [error,     setError]     = useState(null);
  const [model,     setModel]     = useState('gemini-2.5-flash');

  const bottomRef    = useRef(null);
  const inputRef     = useRef(null);
  const cancelRef    = useRef(null);
  const streamBufRef = useRef('');

  const scrollBot = useCallback(() =>
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  , []);

  /* Load conversation when activeConvId changes */
  useEffect(() => {
    if (!activeConvId) { setConv(null); setMessages([]); setError(null); return; }
    (async () => {
      try {
        const { conversation, messages: msgs } = await api.conversations.get(activeConvId);
        setConv(conversation);
        setMessages(msgs);
        setModel(conversation.model ?? 'gemini-2.5-flash');
        setError(null);
      } catch (e) { setError(e.message); }
    })();
  }, [activeConvId]);

  useEffect(() => { scrollBot(); }, [messages, streamId]);

  /* Send a message */
  async function send() {
    if (!input.trim() || streaming) return;
    const text = input.trim();
    setInput('');
    setError(null);

    /* Create conversation if needed */
    let cid = activeConvId;
    if (!cid) {
      try {
        const { conversation } = await api.conversations.create({ model });
        cid = conversation.id;
        setActiveConvId(cid);
        setConv(conversation);
        onConversationChange();
      } catch (e) { setError('Could not create conversation: ' + e.message); setInput(text); return; }
    }

    /* Optimistic user message */
    const uid = `u-${Date.now()}`;
    setMessages(prev => [...prev, { id:uid, role:'user', content:text }]);

    /* Streaming placeholder */
    const sid = `s-${Date.now()}`;
    streamBufRef.current = '';
    setStreamId(sid);
    setStreaming(true);
    setMessages(prev => [...prev, { id:sid, role:'assistant', content:'' }]);

    cancelRef.current = api.chat.sendStream(
      cid, text,
      /* onChunk */ chunk => {
        streamBufRef.current += chunk;
        const buf = streamBufRef.current;
        setMessages(prev => prev.map(m => m.id === sid ? { ...m, content: buf } : m));
        scrollBot();
      },
      /* onDone */ data => {
        setStreaming(false); setStreamId(null);
        setMessages(prev => prev.map(m =>
          m.id === sid ? { ...m, id: data.messageId ?? sid, _log: data } : m
        ));
        onConversationChange();
      },
      /* onError */ err => {
        setStreaming(false); setStreamId(null);
        setError(err);
        setMessages(prev => prev.filter(m => m.id !== sid));
      },
    );
  }

  const cancelled = conv?.status === 'cancelled';

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* ── Header ── */}
      <div style={{
        padding:'14px 22px', borderBottom:'1px solid var(--border)',
        background:'var(--bg-elevated)', display:'flex', alignItems:'center', gap:12,
        flexShrink:0,
      }}>
        <Bot size={17} color="var(--accent-light)" />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>
            {conv?.title ?? 'New Conversation'}
          </div>
          {conv && (
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
              {conv.model} · {conv.message_count ?? 0} messages
              {cancelled && <span style={{ color:'var(--red)', marginLeft:6 }}>· Cancelled</span>}
            </div>
          )}
        </div>

        {/* Model picker (only when no active conv) */}
        {!activeConvId && (
          <select value={model} onChange={e => setModel(e.target.value)} style={{
            background:'var(--bg-surface)', border:'1px solid var(--border)',
            borderRadius:7, padding:'5px 10px', color:'var(--text-secondary)',
            fontSize:12, fontFamily:'inherit', cursor:'pointer',
          }}>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Free)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          </select>
        )}

        <button onClick={() => { setActiveConvId(null); setConv(null); setMessages([]); }} style={{
          display:'flex', alignItems:'center', gap:6,
          background:'var(--accent)', border:'none', borderRadius:8,
          padding:'7px 14px', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600,
        }}>
          <Plus size={13} /> New
        </button>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'8px 22px' }}>
        {messages.length === 0 && (
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            height:'100%', gap:14, color:'var(--text-muted)',
          }}>
            <div style={{
              width:60, height:60, background:'var(--bg-surface)',
              border:'1px solid var(--border)', borderRadius:18,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Bot size={26} color="var(--accent)" />
            </div>
            <div style={{ textAlign:'center', maxWidth:300 }}>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:20, color:'var(--text-primary)', marginBottom:6 }}>
                Start chatting
              </div>
              <div style={{ fontSize:13, lineHeight:1.7 }}>
                Powered by Gemini (free). Every inference is logged — latency, tokens, errors — in real time.
              </div>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginTop:4 }}>
              {['Explain quantum entanglement', 'Write a Python quicksort', 'What is RAG in LLMs?'].map(s => (
                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }} style={{
                  padding:'7px 14px', background:'var(--bg-surface)', border:'1px solid var(--border)',
                  borderRadius:20, color:'var(--text-secondary)', fontSize:12, cursor:'pointer',
                  fontFamily:'inherit', transition:'all .13s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <Bubble key={msg.id} msg={msg} isStreaming={msg.id === streamId && streaming} />
        ))}

        {error && (
          <div style={{
            display:'flex', alignItems:'flex-start', gap:9,
            background:'rgba(255,85,102,.09)', border:'1px solid rgba(255,85,102,.28)',
            borderRadius:9, padding:'11px 14px', margin:'8px 0',
          }}>
            <AlertCircle size={14} color="var(--red)" style={{ flexShrink:0, marginTop:1 }} />
            <span style={{ fontSize:12, color:'var(--red)' }}>{error}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div style={{
        padding:'14px 22px 18px', background:'var(--bg-elevated)',
        borderTop:'1px solid var(--border)', flexShrink:0,
      }}>
        {cancelled && (
          <div style={{
            display:'flex', alignItems:'center', gap:7, marginBottom:10,
            background:'rgba(255,85,102,.08)', border:'1px solid rgba(255,85,102,.22)',
            borderRadius:8, padding:'8px 12px', fontSize:12, color:'var(--red)',
          }}>
            <Info size={13} />
            Conversation cancelled — resume it from the sidebar or start a new one.
          </div>
        )}

        <div style={{
          display:'flex', gap:8, alignItems:'flex-end',
          background:'var(--bg-surface)', border:'1px solid var(--border-bright)',
          borderRadius:12, padding:'9px 11px', transition:'border-color .15s',
        }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--accent)'}
          onBlurCapture={e  => e.currentTarget.style.borderColor = 'var(--border-bright)'}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={streaming || cancelled}
            placeholder={cancelled ? 'Conversation cancelled…' : 'Message Gemini… (Enter ↵ to send)'}
            rows={1}
            style={{
              flex:1, background:'transparent', border:'none', outline:'none',
              color:'var(--text-primary)', fontSize:13, fontFamily:'inherit',
              resize:'none', lineHeight:1.6, maxHeight:120, overflow:'auto',
            }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
          />

          {streaming
            ? (
              <button onClick={() => cancelRef.current?.()} style={{
                width:34, height:34, flexShrink:0,
                background:'var(--red)', border:'none', borderRadius:8,
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
              }}>
                <StopCircle size={15} color="#fff" />
              </button>
            ) : (
              <button onClick={send} disabled={!input.trim() || cancelled} style={{
                width:34, height:34, flexShrink:0,
                background: (input.trim() && !cancelled) ? 'var(--accent)' : 'var(--bg-overlay)',
                border:'none', borderRadius:8,
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor: (input.trim() && !cancelled) ? 'pointer' : 'not-allowed',
                transition:'background .13s',
              }}>
                <Send size={14} color="#fff" />
              </button>
            )
          }
        </div>

        <p style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:5, textAlign:'center' }}>
          Gemini 2.5 Flash · free tier · every inference logged in real time
        </p>
      </div>
    </div>
  );
}
