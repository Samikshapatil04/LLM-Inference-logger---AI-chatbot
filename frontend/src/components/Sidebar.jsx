import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import {
  MessageSquare, BarChart2, FileText, Settings, Plus,
  Trash2, Play, ChevronRight, Zap, Circle,
} from 'lucide-react';

const NAV = [
  { id: 'chat',      label: 'Chat',      Icon: MessageSquare },
  { id: 'dashboard', label: 'Dashboard', Icon: BarChart2     },
  { id: 'logs',      label: 'Logs',      Icon: FileText      },
];

const STATUS_COLOR = { active: 'var(--green)', cancelled: 'var(--red)' };

export default function Sidebar({ page, setPage, activeConvId, setActiveConvId, onSettings, refreshKey, onRefresh }) {
  const [convs,   setConvs]   = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchConvs = useCallback(async () => {
    setLoading(true);
    try {
      const { conversations } = await api.conversations.list({ limit: 40 });
      setConvs(conversations ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConvs(); }, [fetchConvs, refreshKey]);

  const openConv = (id) => { setActiveConvId(id); setPage('chat'); };

  const cancelConv = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Cancel this conversation?')) return;
    await api.conversations.cancel(id);
    if (activeConvId === id) setActiveConvId(null);
    fetchConvs(); onRefresh();
  };

  const resumeConv = async (e, id) => {
    e.stopPropagation();
    await api.conversations.update(id, { status: 'active' });
    fetchConvs(); onRefresh();
  };

  return (
    <aside style={{
      width:240, minWidth:240, background:'var(--bg-elevated)',
      borderRight:'1px solid var(--border)',
      display:'flex', flexDirection:'column', height:'100vh', flexShrink:0,
    }}>
      {/* Logo */}
      <div style={{ padding:'18px 14px 14px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <div style={{
            width:34, height:34, background:'var(--accent)', borderRadius:10,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <Zap size={17} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:15, letterSpacing:'-.01em' }}>
              Inference
            </div>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:-1 }}>Logger v1.0</div>
          </div>
        </div>

        {NAV.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setPage(id)} style={{
            display:'flex', alignItems:'center', gap:9, width:'100%',
            padding:'8px 10px', marginBottom:2, borderRadius:8, cursor:'pointer',
            background:  page === id ? 'var(--accent-dim)'                 : 'transparent',
            border:      page === id ? '1px solid rgba(108,99,255,.28)'    : '1px solid transparent',
            color:       page === id ? 'var(--accent-light)'               : 'var(--text-secondary)',
            fontSize:13, fontWeight:500, fontFamily:'inherit',
            transition:'all .13s',
          }}>
            <Icon size={15} />
            <span style={{ flex:1, textAlign:'left' }}>{label}</span>
            {page === id && <ChevronRight size={12} />}
          </button>
        ))}
      </div>

      {/* Conversations */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', minHeight:0 }}>
        <div style={{
          padding:'10px 14px 6px', display:'flex',
          alignItems:'center', justifyContent:'space-between',
        }}>
          <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--text-muted)' }}>
            Conversations
          </span>
          <button
            onClick={() => { setActiveConvId(null); setPage('chat'); }}
            title="New conversation"
            style={{
              width:22, height:22, background:'var(--accent)', border:'none',
              borderRadius:6, cursor:'pointer', color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}
          >
            <Plus size={13} />
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'0 6px 8px' }}>
          {loading && convs.length === 0 &&
            [1,2,3,4].map(i => (
              <div key={i} className="shimmer" style={{ height:48, borderRadius:8, marginBottom:3 }} />
            ))
          }
          {!loading && convs.length === 0 && (
            <p style={{ padding:'16px 8px', textAlign:'center', color:'var(--text-muted)', fontSize:12, lineHeight:1.6 }}>
              No conversations yet.<br/>Hit <strong style={{ color:'var(--accent-light)' }}>+</strong> to start one!
            </p>
          )}
          {convs.map(c => (
            <div key={c.id} onClick={() => openConv(c.id)} style={{
              padding:'8px 9px', borderRadius:8, marginBottom:2, cursor:'pointer',
              background: activeConvId === c.id ? 'var(--bg-surface)' : 'transparent',
              border:     `1px solid ${activeConvId === c.id ? 'var(--border-bright)' : 'transparent'}`,
              display:'flex', alignItems:'flex-start', gap:7,
              transition:'all .12s',
            }}
              onMouseEnter={e => { if (activeConvId !== c.id) e.currentTarget.style.background = 'var(--bg-surface)'; }}
              onMouseLeave={e => { if (activeConvId !== c.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <Circle size={6} fill={STATUS_COLOR[c.status] ?? 'var(--text-muted)'}
                color={STATUS_COLOR[c.status] ?? 'var(--text-muted)'}
                style={{ marginTop:5, flexShrink:0 }}
              />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{
                  fontSize:12.5, fontWeight:500, color:'var(--text-primary)',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>
                  {c.title ?? 'New Conversation'}
                </div>
                <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:1 }}>
                  {c.message_count ?? 0} msgs · {c.model?.replace('gemini-','gem-') ?? 'gemini'}
                </div>
              </div>
              <div style={{ display:'flex', gap:1, flexShrink:0 }}>
                {c.status === 'cancelled' && (
                  <button onClick={e => resumeConv(e, c.id)} title="Resume"
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--green)', padding:2 }}>
                    <Play size={11} />
                  </button>
                )}
                {c.status === 'active' && (
                  <button onClick={e => cancelConv(e, c.id)} title="Cancel"
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding:'10px 8px', borderTop:'1px solid var(--border)' }}>
        <button onClick={onSettings} style={{
          display:'flex', alignItems:'center', gap:8, width:'100%',
          padding:'8px 10px', borderRadius:8, cursor:'pointer',
          background:'transparent', border:'1px solid transparent',
          color:'var(--text-secondary)', fontSize:13, fontFamily:'inherit',
          transition:'all .12s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Settings size={14} /> Settings &amp; API Key
        </button>
      </div>
    </aside>
  );
}
