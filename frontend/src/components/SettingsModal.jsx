import { useState } from 'react';
import { setApiKey, getApiKey } from '../lib/api.js';
import { X, Key, Eye, EyeOff, ExternalLink, CheckCircle } from 'lucide-react';

export default function SettingsModal({ onClose }) {
  const [key,   setKey]   = useState(getApiKey());
  const [show,  setShow]  = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setApiKey(key.trim());
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:'fixed', inset:0, zIndex:200,
        background:'rgba(0,0,0,.72)', backdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      }}
    >
      <div className="animate-in" style={{
        background:'var(--bg-elevated)', border:'1px solid var(--border-bright)',
        borderRadius:16, padding:28, width:440, maxWidth:'100%',
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ background:'var(--accent-dim)', borderRadius:8, padding:8 }}>
              <Key size={16} color="var(--accent-light)" />
            </div>
            <div>
              <div style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:16 }}>Settings</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>Configure your AI provider</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'none', border:'none', cursor:'pointer',
            color:'var(--text-muted)', padding:4, borderRadius:6,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Free tier callout */}
        <div style={{
          background:'var(--bg-surface)', border:'1px solid var(--border)',
          borderRadius:10, padding:14, marginBottom:18,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={{ fontSize:16 }}>✨</span>
            <span style={{ fontWeight:600, fontSize:13 }}>Google Gemini — Free Tier</span>
            <span style={{
              marginLeft:'auto', background:'rgba(34,211,160,.15)',
              color:'var(--green)', fontSize:10, fontWeight:700,
              padding:'2px 7px', borderRadius:4, letterSpacing:'.04em',
            }}>FREE</span>
          </div>
          <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>
            Gemini 1.5 Flash is <strong>free</strong> with no credit card needed.
            15 req/min · 1M tokens/day via Google AI Studio.
          </div>
          <a href="https://aistudio.google.com/app/apikey"
            target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:9,
              fontSize:12, color:'var(--accent-light)', textDecoration:'none' }}
          >
            <ExternalLink size={12} />
            Get your free key at aistudio.google.com
          </a>
        </div>

        {/* Key input */}
        <label style={{ display:'block', marginBottom:6, fontSize:11, fontWeight:700,
          textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-muted)' }}>
          Gemini API Key
        </label>
        <div style={{ position:'relative', marginBottom:18 }}>
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="AIzaSy..."
            style={{
              width:'100%', padding:'10px 40px 10px 14px',
              background:'var(--bg-base)', border:'1px solid var(--border-bright)',
              borderRadius:8, color:'var(--text-primary)',
              fontFamily:'JetBrains Mono,monospace', fontSize:13,
              outline:'none', transition:'border-color .15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e  => e.target.style.borderColor = 'var(--border-bright)'}
          />
          <button onClick={() => setShow(!show)} style={{
            position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
            background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)',
          }}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose} style={{
            flex:1, padding:'10px', background:'transparent',
            border:'1px solid var(--border)', borderRadius:8,
            color:'var(--text-secondary)', cursor:'pointer', fontSize:13,
          }}>
            Cancel
          </button>
          <button onClick={save} style={{
            flex:2, padding:'10px',
            background: saved ? 'var(--green)' : 'var(--accent)',
            border:'none', borderRadius:8, color:'#fff',
            cursor:'pointer', fontSize:13, fontWeight:600,
            display:'flex', alignItems:'center', justifyContent:'center', gap:6,
            transition:'background .2s',
          }}>
            {saved ? <><CheckCircle size={14}/> Saved!</> : 'Save API Key'}
          </button>
        </div>

        <p style={{
          marginTop:14, padding:'9px 13px',
          background:'var(--bg-surface)', borderRadius:8,
          fontSize:11, color:'var(--text-muted)', lineHeight:1.6,
        }}>
          🔒 Stored in <code style={{ color:'var(--accent-light)' }}>localStorage</code> only.
          Alternatively set <code style={{ color:'var(--accent-light)' }}>GEMINI_API_KEY</code> in your backend <code>.env</code>.
        </p>
      </div>
    </div>
  );
}
