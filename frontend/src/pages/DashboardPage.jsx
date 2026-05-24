import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Activity, Zap, Clock, AlertTriangle, MessageSquare, TrendingUp, RefreshCw } from 'lucide-react';

/* ── Stat card ───────────────────────────────────────────────────────────── */
function Stat({ label, value, sub, color = 'var(--accent)', Icon }) {
  return (
    <div style={{
      background:'var(--bg-elevated)', border:'1px solid var(--border)',
      borderRadius:12, padding:'16px 18px',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:7 }}>{label}</div>
          <div style={{ fontSize:26, fontFamily:'Syne,sans-serif', fontWeight:700, color, lineHeight:1 }}>{value ?? '—'}</div>
          {sub && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>{sub}</div>}
        </div>
        {Icon && (
          <div style={{ background:`${color}18`, borderRadius:8, padding:8, flexShrink:0 }}>
            <Icon size={17} color={color} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Custom tooltip ──────────────────────────────────────────────────────── */
function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:'var(--bg-overlay)', border:'1px solid var(--border-bright)',
      borderRadius:8, padding:'8px 12px', fontSize:12,
    }}>
      <div style={{ color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color ?? 'var(--text-primary)' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(p.name.includes('latency') || p.name.includes('ms') ? 0 : 1) : p.value}
          {(p.name.includes('latency') || p.name.includes('ms')) ? 'ms' : ''}
        </div>
      ))}
    </div>
  );
}

/* ── Panel wrapper ───────────────────────────────────────────────────────── */
function Panel({ title, children, style = {} }) {
  return (
    <div style={{
      background:'var(--bg-elevated)', border:'1px solid var(--border)',
      borderRadius:12, padding:'16px 18px', ...style,
    }}>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:14, color:'var(--text-primary)' }}>{title}</div>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:160, color:'var(--text-muted)', fontSize:12 }}>
      No data yet — start chatting!
    </div>
  );
}

/* ── Main dashboard ──────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [hours,   setHours]   = useState(24);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.logs.analytics(hours)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [hours]);

  useEffect(() => { load(); }, [load]);
  // auto-refresh every 30 s
  useEffect(() => { const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  const o = data?.overall ?? {};
  const p = data?.latency_percentiles ?? {};
  const c = data?.conversations ?? {};

  const throughput = (data?.throughput ?? []).map(r => ({
    time:    (r.hour ?? '').split('T')[1]?.slice(0,5) ?? r.hour,
    reqs:    Number(r.requests),
    latency: Math.round(Number(r.avg_latency) || 0),
    errors:  Number(r.errors),
  }));

  const byModel = (data?.by_model ?? []).map(r => ({
    name: (r.model ?? '').replace('gemini-','').replace('-flash','fl').replace('-pro','pro'),
    reqs: Number(r.requests),
    toks: Number(r.tokens),
  }));

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:24 }}>
      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:22, margin:0 }}>Dashboard</h1>
          <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
            Inference metrics · auto-refreshes every 30 s
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select value={hours} onChange={e => setHours(Number(e.target.value))} style={{
            background:'var(--bg-surface)', border:'1px solid var(--border)',
            borderRadius:8, padding:'6px 12px', color:'var(--text-secondary)',
            fontSize:12, fontFamily:'inherit', cursor:'pointer',
          }}>
            {[1,6,24,168].map(h => <option key={h} value={h}>Last {h < 24 ? h+'h' : h === 24 ? '24h' : '7d'}</option>)}
          </select>
          <button onClick={load} disabled={loading} style={{
            background:'var(--bg-surface)', border:'1px solid var(--border)',
            borderRadius:8, padding:'6px 10px', cursor:'pointer',
            display:'flex', alignItems:'center', gap:5, color:'var(--text-secondary)', fontSize:12,
          }}>
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(175px,1fr))', gap:12, marginBottom:20 }}>
        <Stat label="Total Requests" value={o.total_requests ?? 0}
          sub={`${o.success_rate ?? 0}% success`} color="var(--accent)" Icon={Activity} />
        <Stat label="Avg Latency" value={o.avg_latency_ms ? Math.round(o.avg_latency_ms)+'ms' : '—'}
          sub={`p99: ${p.p99 ? Math.round(p.p99)+'ms' : '—'}`} color="var(--green)" Icon={Clock} />
        <Stat label="Total Tokens" value={o.total_tokens ? (Number(o.total_tokens)/1000).toFixed(1)+'K' : '0'}
          sub={`in ${Number(o.total_prompt_tokens||0).toLocaleString()} · out ${Number(o.total_completion_tokens||0).toLocaleString()}`}
          color="var(--yellow)" Icon={Zap} />
        <Stat label="Error Rate" value={`${o.error_rate ?? '0.00'}%`}
          sub={`${o.errors ?? 0} errors total`}
          color={Number(o.error_rate) > 5 ? 'var(--red)' : 'var(--text-muted)'} Icon={AlertTriangle} />
        <Stat label="Conversations" value={c.total ?? 0}
          sub={`${c.active ?? 0} active · ${c.cancelled ?? 0} cancelled`}
          color="var(--accent-light)" Icon={MessageSquare} />
        <Stat label="p50 / p90 Latency"
          value={p.p50 ? Math.round(p.p50)+'ms' : '—'}
          sub={`p90: ${p.p90 ? Math.round(p.p90)+'ms' : '—'}`}
          color="var(--green)" Icon={TrendingUp} />
      </div>

      {/* ── Charts row 1 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <Panel title="Request Throughput">
          {throughput.length
            ? <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={throughput}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--accent)" stopOpacity={.3}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={{ fontSize:10, fill:'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize:10, fill:'var(--text-muted)' }} />
                  <Tooltip content={<Tip />} />
                  <Area type="monotone" dataKey="reqs" name="requests" stroke="var(--accent)" fill="url(#g1)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            : <Empty />
          }
        </Panel>

        <Panel title="Avg Latency per Hour (ms)">
          {throughput.length
            ? <ResponsiveContainer width="100%" height={180}>
                <LineChart data={throughput}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" tick={{ fontSize:10, fill:'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize:10, fill:'var(--text-muted)' }} />
                  <Tooltip content={<Tip />} />
                  <Line type="monotone" dataKey="latency" name="latency (ms)" stroke="var(--green)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            : <Empty />
          }
        </Panel>
      </div>

      {/* ── Charts row 2 ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Panel title="Requests by Model">
          {byModel.length
            ? <ResponsiveContainer width="100%" height={160}>
                <BarChart data={byModel} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize:10, fill:'var(--text-muted)' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize:10, fill:'var(--text-muted)' }} width={70} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="reqs" name="requests" fill="var(--accent)" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            : <Empty />
          }
        </Panel>

        <Panel title="Recent Errors">
          {(data?.recent_errors?.length ?? 0) === 0
            ? <div style={{ color:'var(--green)', fontSize:13, padding:'20px 0', display:'flex', alignItems:'center', gap:8 }}>
                ✅ No errors detected
              </div>
            : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {data.recent_errors.slice(0,5).map(e => (
                  <div key={e.id} style={{
                    background:'rgba(255,85,102,.08)', border:'1px solid rgba(255,85,102,.2)',
                    borderRadius:8, padding:'8px 10px',
                  }}>
                    <div style={{ fontSize:11, color:'var(--red)', fontWeight:600 }}>{e.error_code}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, lineHeight:1.4 }}>
                      {(e.error_message ?? '').slice(0,90)}
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>
                      {e.model} · {new Date(e.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
          }
        </Panel>
      </div>
    </div>
  );
}
