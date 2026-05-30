// src/components/ai/AIPanel.jsx
// Panneau IA contextuel pour les analyses RCA (5-Why et Quick Kaizen)
import { useState } from 'react'
import { api } from '../../lib/api'
import C from '../../tokens/colors'

const QUESTIONS = {
  '5why': [
    { label: 'Causes probables ?',     q: 'Quelles sont les causes racines probables pour ce type de défaillance sur cet équipement ?' },
    { label: 'Historique similaire ?', q: 'Y a-t-il des analyses similaires dans l\'historique RCA ? Que montrent-elles ?' },
    { label: 'Actions recommandées ?', q: 'Quelles actions correctives recommandes-tu pour résoudre ce problème définitivement ?' },
    { label: 'Comment approfondir ?',  q: 'Comment approfondir l\'analyse pour identifier la cause racine ultime ?' },
  ],
  kaizen: [
    { label: 'Actions Do ?',      q: 'Quelles actions immédiates (Do) recommandes-tu pour corriger cette défaillance ?' },
    { label: 'Vérifications ?',   q: 'Quelles vérifications (Check) faut-il effectuer pour confirmer les causes identifiées ?' },
    { label: 'Prévention ?',      q: 'Quelles mesures préventives (Act/Plan) recommandes-tu pour éviter la récurrence ?' },
    { label: 'Bonnes pratiques ?',q: 'Quelles bonnes pratiques de maintenance préventive recommandes-tu pour cet équipement ?' },
  ],
}

export default function AIPanel({ equipId, phenomene, methode }) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [reply, setReply]     = useState(null)
  const [askedQ, setAskedQ]   = useState(null)
  const [input, setInput]     = useState('')

  const questions = QUESTIONS[methode] || QUESTIONS['5why']

  const ask = async (q) => {
    const question = (q || input).trim()
    if (!question || loading) return
    setLoading(true)
    setReply(null)
    setAskedQ(question)
    setInput('')
    try {
      const data = await api.aiSuggest({ equip_id: equipId, phenomene: phenomene || '', methode, question })
      setReply(data.reply)
    } catch {
      setReply('<strong>Erreur</strong> : Impossible de contacter le service IA. Vérifiez que le backend est démarré.')
    } finally {
      setLoading(false)
    }
  }

  const methodeLabel = methode === '5why' ? 'Arbre de causes' : 'Quick Kaizen'

  return (
    <div style={{ marginBottom: 20, borderRadius: 12, border: '1.5px solid #3b72c4', overflow: 'hidden', boxShadow: '0 4px 16px rgba(26,58,107,.12)' }}>

      {/* ── Header ── */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: 'linear-gradient(135deg, #0f1f3d 0%, #1a3a6b 100%)', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: 22 }}>🤖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: "'Sora',sans-serif" }}>
            Assistant IA — {methodeLabel}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', marginTop: 1 }}>
            {equipId} · Basé sur l'historique RCA interne + données TUM
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 20, padding: '3px 10px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 700 }}>IA ACTIVE</span>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* ── Corps ── */}
      {open && (
        <div style={{ background: '#f8fafd', padding: '16px 18px' }}>

          {/* Phénomène */}
          {phenomene && (
            <div style={{ marginBottom: 14, padding: '8px 13px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 11.5, color: '#1e40af' }}>
              <strong>Phénomène analysé :</strong> {phenomene}
            </div>
          )}

          {/* Questions rapides */}
          <div style={{ fontSize: 10, fontWeight: 700, color: C.text4, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8 }}>
            Questions rapides
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
            {questions.map((item, i) => (
              <button
                key={i}
                onClick={() => ask(item.q)}
                disabled={loading}
                style={{
                  padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  border: '1.5px solid #3b72c4', background: '#eff6ff', color: '#1a3a6b',
                  fontFamily: "'DM Sans',sans-serif", transition: 'all .15s', opacity: loading ? 0.55 : 1,
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#1a3a6b'; e.currentTarget.style.color = '#fff' }}}
                onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#1a3a6b' }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Input libre */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask()}
              placeholder="Posez votre question à l'IA..."
              disabled={loading}
              style={{ flex: 1, padding: '9px 14px', border: `1.5px solid ${C.border2}`, borderRadius: 25, fontSize: 12.5, fontFamily: "'DM Sans',sans-serif", outline: 'none', background: '#fff', color: C.text, transition: 'border-color .15s' }}
              onFocus={e => e.target.style.borderColor = '#1a3a6b'}
              onBlur={e => e.target.style.borderColor = C.border2}
            />
            <button
              onClick={() => ask()}
              disabled={!input.trim() || loading}
              style={{ width: 38, height: 38, borderRadius: '50%', background: input.trim() && !loading ? '#1a3a6b' : C.border2, border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s', boxShadow: input.trim() && !loading ? '0 2px 8px rgba(26,58,107,.3)' : 'none' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#fff', borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #1a3a6b, #1e4d8c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🤖</div>
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#1a3a6b', animation: `aipulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: C.text4, fontStyle: 'italic' }}>Analyse en cours — consultation de l'historique RCA…</span>
            </div>
          )}

          {/* Réponse */}
          {reply && !loading && (
            <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              {askedQ && (
                <div style={{ padding: '8px 14px', background: '#0f1f3d', fontSize: 11, color: 'rgba(255,255,255,.6)', fontStyle: 'italic', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: 'rgba(255,255,255,.3)', flexShrink: 0 }}>Q :</span>
                  <span>{askedQ.length > 90 ? askedQ.slice(0, 90) + '…' : askedQ}</span>
                </div>
              )}
              <div
                style={{ padding: '14px 16px', background: '#fff', fontSize: 12.5, lineHeight: 1.75, color: C.text }}
                dangerouslySetInnerHTML={{ __html: reply }}
              />
              <div style={{ padding: '8px 14px', background: '#f8fafd', borderTop: `1px solid ${C.border}`, fontSize: 10.5, color: C.text4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🤖</span> Réponse générée par IA · Basée sur l'historique interne · À valider par le fiabiliste
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes aipulse {
          0%,80%,100%{transform:translateY(0);opacity:.35}
          40%{transform:translateY(-5px);opacity:1}
        }
      `}</style>
    </div>
  )
}
