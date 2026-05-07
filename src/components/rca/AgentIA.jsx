// src/components/rca/AgentIA.jsx
// Agent IA — design identique au HTML original
// Header gradient navy + robot SVG + status EN LIGNE + context bar
// Messages bubbles + boutons rapides + input + attach

import { useState, useRef } from 'react'

const RobotSVG = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="10" width="24" height="18" rx="5" fill="rgba(255,255,255,.9)" stroke="rgba(96,165,250,.8)" strokeWidth="1.2"/>
    <rect x="13" y="16" width="5" height="4" rx="2" fill="#3b82f6"/>
    <rect x="22" y="16" width="5" height="4" rx="2" fill="#3b82f6"/>
    <rect x="14" y="17" width="1.5" height="1.5" rx=".5" fill="white" opacity=".8"/>
    <rect x="23" y="17" width="1.5" height="1.5" rx=".5" fill="white" opacity=".8"/>
    <rect x="14" y="23" width="12" height="2" rx="1" fill="#93c5fd"/>
    <rect x="14" y="23" width="8" height="2" rx="1" fill="#3b82f6"/>
    <line x1="20" y1="10" x2="20" y2="6" stroke="rgba(255,255,255,.8)" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="20" cy="5" r="2" fill="#60a5fa" stroke="rgba(255,255,255,.6)" strokeWidth="1"/>
    <rect x="5" y="17" width="3" height="6" rx="1.5" fill="rgba(255,255,255,.4)" stroke="rgba(96,165,250,.5)" strokeWidth="1"/>
    <rect x="32" y="17" width="3" height="6" rx="1.5" fill="rgba(255,255,255,.4)" stroke="rgba(96,165,250,.5)" strokeWidth="1"/>
    <rect x="17" y="28" width="6" height="3" rx="1" fill="rgba(255,255,255,.3)"/>
    <rect x="15" y="12" width="10" height="3" rx="1" fill="rgba(59,130,246,.3)" stroke="rgba(96,165,250,.4)" strokeWidth=".5"/>
  </svg>
)

const RobotSmall = () => (
  <svg width="16" height="16" viewBox="0 0 40 40" fill="none">
    <rect x="8" y="10" width="24" height="18" rx="5" fill="rgba(255,255,255,.9)"/>
    <rect x="13" y="16" width="5" height="4" rx="2" fill="#93c5fd"/>
    <rect x="22" y="16" width="5" height="4" rx="2" fill="#93c5fd"/>
    <rect x="14" y="23" width="8" height="2" rx="1" fill="#60a5fa"/>
    <line x1="20" y1="10" x2="20" y2="6" stroke="rgba(255,255,255,.8)" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="20" cy="5" r="2" fill="#93c5fd"/>
  </svg>
)

const INITIAL_MESSAGES_5WHY = [
  {
    role: 'assistant',
    content: null,
    html: `Bonjour&nbsp;! Je suis votre <strong>Agent RCA JESA</strong>. Je vous assisterai avec les <strong>causes racines probables</strong>, les <strong>actions correctives</strong> et le <strong>plan de maintenance</strong>.`,
  },
]

const INITIAL_MESSAGES_KAIZEN = [
  {
    role: 'assistant',
    content: null,
    html: `Bonjour&nbsp;! Je suis votre <strong>Agent RCA JESA</strong>. Je vous assisterai avec les causes racines possibles et les actions correctives.`,
  },
]

const QUICK_ACTIONS_5WHY = [
  { key: 'causes',  label: 'Causes probables',  bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ️' },
  { key: 'actions', label: 'Recommandations',   bg: '#e6f9f3', border: '#6ee7c8', color: '#059669', icon: '✅' },
  { key: 'resume',  label: 'Résumer WHY',        bg: '#faf5ff', border: '#ddd6fe', color: '#6d28d9', icon: '📝' },
]

const QUICK_ACTIONS_KAIZEN = [
  { key: 'pheno',   label: 'PROBLEM',         bg: '#FEFFD6', border: '#F2F724', color: '#8a8000',  badge: 'P',  badgeBg: '#F2F724' },
  { key: 'actions', label: 'POSSIBLE CAUSES', bg: '#e3f2fd', border: '#2980b9', color: '#1a5276',  badge: 'PC', badgeBg: '#2980b9' },
  { key: 'racine',  label: 'VERIFICATION',    bg: '#eaeff8', border: '#1a3a6b', color: '#1a3a6b',  badge: 'V',  badgeBg: '#1a3a6b' },
  { key: 'causes',  label: 'ACTIONS',         bg: '#e0f5f0', border: '#0aaa8a', color: '#0aaa8a',  badge: 'A',  badgeBg: '#0aaa8a' },
]

export default function AgentIA({ session, methode }) {
  const isKaizen = methode === 'kaizen'
  const [messages, setMessages] = useState(isKaizen ? INITIAL_MESSAGES_KAIZEN : INITIAL_MESSAGES_5WHY)
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [attachedFiles, setAF]  = useState([])
  const chatRef = useRef()

  const scrollDown = () => setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 50)

  const buildPrompt = (userMsg, quickKey) => {
    const equip = session.equipId || 'non précisé'
    const pheno = session.phenomene
    if (quickKey === 'causes') return `Pour l'équipement ${equip} avec le problème "${pheno}", donne 4-5 causes probables structurées. Réponds en français, format liste.`
    if (quickKey === 'actions') return `Pour ${equip} — problème "${pheno}", propose 4-5 actions correctives concrètes avec responsable type et délai indicatif. Français.`
    if (quickKey === 'resume') return `Résume l'analyse Arbre De Causes pour ${equip} de façon professionnelle en 3-4 lignes. Français.`
    if (quickKey === 'pheno') return `Reformule ce problème de façon précise QQOQCP pour ${equip} : "${pheno}". Français.`
    if (quickKey === 'racine') return `Aide à vérifier et confirmer la cause racine pour ${equip} — "${pheno}". Français.`
    return userMsg
  }

  const callAPI = async (userText, displayText, quickKey) => {
    setLoading(true)
    setMessages(m => [...m, { role: 'user', content: displayText }])
    scrollDown()

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: "Tu es un expert en fiabilité industrielle JESA (RCA, Arbre De Causes, AMDEC, Kaizen). Tu assistes un fiabiliste. Tu suggères des pistes SANS jamais valider automatiquement. Réponds de façon structurée et professionnelle en français.",
          messages: [
            ...messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-6).map(m => ({ role: m.role, content: m.content || m.html?.replace(/<[^>]+>/g, '') || '' })),
            { role: 'user', content: buildPrompt(userText, quickKey) },
          ],
        }),
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || "Réponse non disponible."
      setMessages(m => [...m, { role: 'assistant', content: text }])
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: `⚠️ Erreur : ${err.message}` }])
    } finally {
      setLoading(false)
      scrollDown()
    }
  }

  const handleSend = () => {
    if (!input.trim()) return
    const msg = input.trim()
    setInput('')
    callAPI(msg, msg, null)
  }

  const handleQuick = (key, label) => callAPI('', label, key)

  const quickActions = isKaizen ? QUICK_ACTIONS_KAIZEN : QUICK_ACTIONS_5WHY

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(15,30,53,.08)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', maxHeight: 820, minHeight: 480 }}>

      {/* ── Header gradient (identique HTML) */}
      <div style={{ background: 'linear-gradient(135deg,#0f1f3d 0%,#1a3a6b 50%,#1e4d8c 100%)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        {/* Circuit lines décoratives */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: .07 }}>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="20" x2="300" y2="20" stroke="white" strokeWidth="1"/>
            <line x1="0" y1="40" x2="200" y2="40" stroke="white" strokeWidth="1"/>
            <circle cx="80" cy="20" r="3" fill="white"/>
            <circle cx="160" cy="40" r="3" fill="white"/>
            <line x1="80" y1="20" x2="80" y2="40" stroke="white" strokeWidth="1"/>
          </svg>
        </div>
        {/* Avatar robot */}
        <div style={{ width: 42, height: 42, flexShrink: 0, position: 'relative' }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,rgba(96,165,250,.25),rgba(59,130,246,.15))', border: '1.5px solid rgba(96,165,250,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(96,165,250,.25)' }}>
            <RobotSVG size={26} />
          </div>
          <div style={{ position: 'absolute', inset: -4, borderRadius: 16, border: '1.5px solid rgba(96,165,250,.4)', animation: 'rcaPulse 2.5s ease-in-out infinite', pointerEvents: 'none' }}></div>
        </div>
        {/* Titre */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 12.5, color: '#fff', fontFamily: "'Sora',sans-serif" }}>Agent RCA</div>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>Intelligence artificielle · JESA</div>
        </div>
        {/* Status EN LIGNE */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 20, padding: '3px 8px', flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }}></div>
          <span style={{ fontSize: 9, color: 'rgba(34,197,94,.9)', fontWeight: 700, letterSpacing: '.5px' }}>EN LIGNE</span>
        </div>
      </div>

      {/* ── Context bar */}
      <div style={{ background: '#0f1f3d', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, borderBottom: '1px solid rgba(96,165,250,.12)' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(96,165,250,.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
        <span style={{ fontSize: 9.5, color: 'rgba(96,165,250,.7)', fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
          {session.equipId ? `${session.equipId} chargé` : 'RCA Manuelle'} — Analyse prête
        </span>
      </div>

      {/* ── Messages */}
      <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: '#f8fafd' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            {msg.role === 'assistant' ? (
              <>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#1a3a6b,#1e4d8c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <RobotSmall />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}>Agent RCA · JESA</div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '3px 14px 14px 14px', padding: '11px 14px', fontSize: 12, color: '#1e293b', lineHeight: 1.6, boxShadow: '0 2px 8px rgba(0,0,0,.05)', whiteSpace: 'pre-wrap' }}
                    dangerouslySetInnerHTML={msg.html ? { __html: msg.html } : undefined}>
                    {msg.html ? undefined : msg.content}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ marginLeft: 'auto', maxWidth: '80%', background: '#1a3a6b', color: '#fff', borderRadius: '14px 14px 3px 14px', padding: '9px 13px', fontSize: 12 }}>
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#1a3a6b,#1e4d8c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}><RobotSmall /></div>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '3px 14px 14px 14px', padding: '11px 14px', display: 'flex', gap: 5 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Boutons rapides */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #e8edf5', display: 'flex', flexWrap: 'wrap', gap: 5, background: 'linear-gradient(to bottom,#f8fafd,#fff)', flexShrink: 0 }}>
        <div style={{ width: '100%', fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>
          Actions {isKaizen ? 'QUICK KAIZEN' : ''} rapides
        </div>
        {quickActions.map(q => (
          <button key={q.key} onClick={() => handleQuick(q.key, q.badge ? `${q.badge} — ${q.label}` : q.label)}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: q.bg, border: `1.5px solid ${q.border}`, borderRadius: 20, fontSize: 11, cursor: 'pointer', color: q.color, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", opacity: loading ? 0.5 : 1 }}>
            {q.badge ? (
              <span style={{ background: q.badgeBg, color: '#fff', borderRadius: 3, padding: '1px 4px', fontSize: 9, fontWeight: 900 }}>{q.badge}</span>
            ) : (
              <span>{q.icon}</span>
            )}
            {q.label}
          </button>
        ))}
      </div>

      {/* ── Input */}
      <div style={{ display: 'flex', gap: 7, padding: '10px 12px', borderTop: '1px solid #e2e8f0', background: '#fff', flexShrink: 0, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 24, padding: '0 12px', transition: 'border-color .15s' }}
          onFocus={e => e.currentTarget.style.borderColor = '#1a3a6b'}
          onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Posez une question à l'agent RCA..."
            style={{ flex: 1, padding: '8px 0', border: 'none', background: 'transparent', fontSize: 12, color: '#0f172a', outline: 'none', fontFamily: "'DM Sans',sans-serif" }}
          />
        </div>
        {/* Attach */}
        <label style={{ width: 34, height: 34, background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          <input type="file" style={{ display: 'none' }} multiple accept=".pdf,.png,.jpg,.jpeg" onChange={e => setAF(f => [...f, ...Array.from(e.target.files).map(x => x.name)])} />
        </label>
        {/* Send */}
        <button onClick={handleSend} disabled={loading || !input.trim()}
          style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#1a3a6b,#1e4d8c)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(26,58,107,.3)', flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>

      <style>{`
        @keyframes rcaPulse { 0%,100% { opacity:.4; transform:scale(1); } 50% { opacity:1; transform:scale(1.06); } }
        @keyframes bounce { 0%,80%,100% { transform:scale(0); opacity:.4; } 40% { transform:scale(1); opacity:1; } }
      `}</style>
    </div>
  )
}
