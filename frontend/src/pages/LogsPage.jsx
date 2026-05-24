import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw, Search } from 'lucide-react';

function StatusBadge({ status }) {
  const ok = status === 'success';
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'2px 8px', borderRadius:4, fontSize:10, fontWeight:700,
      textTransform:'uppercase', letterSpacing:'.04em',
      background: ok ? 'rgba(34,211,160,.12)' : 'rgba(255,85,102,.12)',
      color:       ok ? 'var(--green)'         : 'var(--red)',
    }}>
      {ok ? <CheckCircle size={9}/> : <XCircle size={9}/>}
      {status}
    </span>
  );
}

function LatencyBadge({ ms }) {
  if (!ms) return <span style={{ color:'var(--text-muted)' }}>—</span>;
  const color = ms > 5000 ? 'var(--red)' : ms > 2000 ? 'var(--yellow)' : 'var(--green)';
  return <span style={{ color, fontFamily:'JetBrains Mono,monospace', fontSize:11 }}>{ms}ms</span>;
}

function LogRow({ log }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr onClick={() => setOpen(o => !o)} style={{
        borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background .1s',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <td style={{ padding:'9px 12px', fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>
          {new Date(log.created_at).toLocaleTimeString()}
        </td>
        <td style={{ padding:'9px 12px' }}><StatusBadge status={log.status} /></td>
        <td style={{ padding:'9px 12px', fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--text-secondary)' }}>
          {log.model}
        </td>
        <td style={{ padding:'9px 12px' }}><LatencyBadge ms={log.latency_ms} /></td>
        <td style={{ padding:'9px 12px', fontSize:11, fontFamily:'JetBrains Mono,monospace', color:'var(--text-muted)' }}>
          {log.total_tokens ?? '—'}
        </td>
        <td style={{ padding:'9px 12px', maxWidth:220 }}>
          <div style={{ fontSize:11, color:'var(--text-secondary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {log.input_preview || '—'}
          </div>
        </td>
        <td style={{ padding:'9px 12px', textAlign:'center' }}>
          {open ? <ChevronUp size={12} color="var(--text-muted)"/> : <ChevronDown size={12} color="var(--text-muted)"/>}
        </td>
      </tr>

      {open && (
        <tr style={{ background:'var(--bg-surface)' }}>
          <td colSpan={7} style={{ padding:'14px 16px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:12 }}>
              {[
                ['Log ID',          log.id,                  true ],
                ['Conversation ID', log.conversation_id,     true ],
                ['Request ID',      log.request_id || '—',   true ],
                ['Provider',        log.provider,            false],
                ['Streaming',       log.is_streaming ? 'Yes (SSE)' : 'No', false],
                ['Tokens (in/out/total)',
                  `${log.prompt_tokens ?? '—'} / ${log.completion_tokens ?? '—'} / ${log.total_tokens ?? '—'}`, false],
              ].map(([label, value, mono]) => (
                <div key={label}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily: mono ? 'JetBrains Mono,monospace' : 'inherit', wordBreak:'break-all' }}>
                    {value}
                  </div>
                </div>
              ))}

              {log.error_message && (
                <div style={{ gridColumn:'1/-1' }}>
                  <div style={{ fontSize:10, color:'var(--red)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Error</div>
                  <div style={{ fontSize:11, color:'var(--red)', background:'rgba(255,85,102,.08)', padding:'7px 10px', borderRadius:6 }}>
                    [{log.error_code}] {log.error_message}
                  </div>
                </div>
              )}

              {log.input_preview && (
                <div style={{ gridColumn:'1/-1' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Input Preview</div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'JetBrains Mono,monospace', lineHeight:1.6,
                    background:'var(--bg-base)', padding:'7px 10px', borderRadius:6, border:'1px solid var(--border)' }}>
                    {log.input_preview}
                  </div>
                </div>
              )}
              {log.output_preview && (
                <div style={{ gridColumn:'1/-1' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Output Preview</div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'JetBrains Mono,monospace', lineHeight:1.6,
                    background:'var(--bg-base)', padding:'7px 10px', borderRadius:6, border:'1px solid var(--border)' }}>
                    {log.output_preview}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function LogsPage() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (filter !== 'all') params.status = filter;
      const { logs } = await api.logs.list(params);
      setLogs(logs ?? []);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const visible = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.model ?? '').toLowerCase().includes(q)
      || (l.input_preview ?? '').toLowerCase().includes(q)
      || (l.conversation_id ?? '').toLowerCase().includes(q)
      || (l.error_message ?? '').toLowerCase().includes(q);
  });

  const TH = ({ children }) => (
    <th style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontWeight:700,
      textTransform:'uppercase', letterSpacing:'.06em', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
      {children}
    </th>
  );

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:20, margin:0 }}>Inference Logs</h1>
            <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>
              {visible.length} entries · click row to expand
            </p>
          </div>
          <button onClick={load} style={{
            display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
            background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:8,
            color:'var(--text-secondary)', fontSize:12, cursor:'pointer', fontFamily:'inherit',
          }}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:1, position:'relative' }}>
            <Search size={13} color="var(--text-muted)" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
            <input placeholder="Search model, input, conversation ID, error…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width:'100%', padding:'7px 12px 7px 30px',
                background:'var(--bg-surface)', border:'1px solid var(--border)',
                borderRadius:8, color:'var(--text-primary)', fontSize:12,
                fontFamily:'inherit', outline:'none', transition:'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          {['all','success','error'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding:'7px 14px', borderRadius:8, fontSize:12, fontFamily:'inherit', cursor:'pointer',
              background: filter === f ? 'var(--accent-dim)' : 'var(--bg-surface)',
              border:     `1px solid ${filter === f ? 'rgba(108,99,255,.35)' : 'var(--border)'}`,
              color:      filter === f ? 'var(--accent-light)' : 'var(--text-secondary)',
              textTransform:'capitalize',
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex:1, overflowY:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)', position:'sticky', top:0, zIndex:1 }}>
              <TH>Time</TH><TH>Status</TH><TH>Model</TH>
              <TH>Latency</TH><TH>Tokens</TH><TH>Input Preview</TH><TH></TH>
            </tr>
          </thead>
          <tbody>
            {loading && Array(8).fill(0).map((_, i) => (
              <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                {[90,60,120,60,50,180,24].map((w, j) => (
                  <td key={j} style={{ padding:'12px' }}>
                    <div className="shimmer" style={{ height:11, borderRadius:3, width:w }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding:'48px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
                  No logs yet — send a message in Chat to see inference logs here.
                </td>
              </tr>
            )}
            {!loading && visible.map(l => <LogRow key={l.id} log={l} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
