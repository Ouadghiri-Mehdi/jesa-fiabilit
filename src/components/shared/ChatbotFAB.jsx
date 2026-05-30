// src/components/shared/ChatbotFAB.jsx
// Bouton flottant chatbot — visible sur toutes les pages sauf /rca
// Bulle ronde en bas à droite, click ouvre un panel de chat

import { useState, useRef, useEffect } from 'react'
import C from '../../tokens/colors'

// ── Messages de bienvenue par page
const WELCOME = {
  '/tum':        'Bonjour ! Je suis votre assistant JESA. Je peux vous aider à interpréter vos données TUM, comprendre les seuils N1/N2 ou préparer une analyse RCA.',
  '/actions':    'Besoin d\'aide sur le suivi des actions correctives ? Je peux vous guider sur les priorités et les délais.',
  '/historique': 'Je peux vous aider à analyser l\'historique d\'un équipement ou identifier des tendances de pannes.',
  '/dashboard':  'Que souhaitez-vous analyser ? Je peux vous expliquer les indicateurs ou vous orienter vers les équipements critiques.',
  '/config':     'Besoin d\'aide pour paramétrer vos seuils TUM ? Je peux vous recommander les valeurs adaptées à votre installation.',
  '/sap':        'Je peux vous aider à comprendre le workflow SAP et la création des ordres de travail.',
}

const DEFAULT_WELCOME = 'Bonjour ! Je suis votre assistant ReliabilityOS JESA. Comment puis-je vous aider ?'

// ── Icône Robot SVG
function RobotIcon({ size = 22, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="10" width="24" height="18" rx="5" fill="rgba(255,255,255,.9)" stroke={color === '#fff' ? 'rgba(255,255,255,.3)' : C.navy} strokeWidth="1.2"/>
      <rect x="13" y="16" width="5" height="4" rx="2" fill={color === '#fff' ? C.navy : C.navy}/>
      <rect x="22" y="16" width="5" height="4" rx="2" fill={color === '#fff' ? C.navy : C.navy}/>
      <rect x="14" y="23" width="12" height="2" rx="1" fill="#93c5fd"/>
      <rect x="14" y="23" width="7" height="2" rx="1" fill={C.navy}/>
      <line x1="20" y1="10" x2="20" y2="6" stroke="rgba(255,255,255,.8)" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="20" cy="5" r="2" fill="#60a5fa"/>
      <rect x="5" y="17" width="3" height="6" rx="1.5" fill="rgba(255,255,255,.4)"/>
      <rect x="32" y="17" width="3" height="6" rx="1.5" fill="rgba(255,255,255,.4)"/>
      <rect x="17" y="28" width="6" height="3" rx="1" fill="rgba(255,255,255,.3)"/>
    </svg>
  )
}

// ── Bulle de message
function Bubble({ msg }) {
  const isBot = msg.role === 'bot'
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      flexDirection: isBot ? 'row' : 'row-reverse',
      marginBottom: 10,
    }}>
      {/* Avatar */}
      {isBot && (
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: `linear-gradient(135deg, ${C.navy}, #1e4d8c)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(26,58,107,.25)',
          marginTop: 2,
        }}>
          <RobotIcon size={16} />
        </div>
      )}

      {/* Texte */}
      <div style={{
        maxWidth: '78%',
        padding: '9px 13px',
        borderRadius: isBot ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
        background: isBot ? '#fff' : C.navy,
        color: isBot ? C.text : '#fff',
        fontSize: 12.5,
        lineHeight: 1.6,
        boxShadow: '0 2px 8px rgba(0,0,0,.06)',
        border: isBot ? `1px solid ${C.border}` : 'none',
      }}
        dangerouslySetInnerHTML={{ __html: msg.text }}
      />
    </div>
  )
}

export default function ChatbotFAB({ pathname }) {
  const [open, setOpen]       = useState(false)
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState(() => {
    const welcome = Object.entries(WELCOME).find(([k]) => pathname?.startsWith(k))?.[1] || DEFAULT_WELCOME
    return [{ role: 'bot', text: welcome }]
  })

  const bottomRef = useRef()
  const inputRef  = useRef()

  // Scroll vers le bas à chaque nouveau message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // Focus input à l'ouverture
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  const addMsg = (role, text) =>
    setMessages(prev => [...prev, { role, text }])

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    addMsg('user', q)
    setLoading(true)

    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
      const token = localStorage.getItem('jesa_token')

      // Historique sans balises HTML (max 6 messages)
      const history = messages.slice(-6).map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.text.replace(/<[^>]*>/g, ''),
      }))

      const res = await fetch(`${BASE}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: q, page: pathname, history }),
      })

      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const data = await res.json()
      addMsg('bot', data.reply || 'Désolé, je n\'ai pas pu traiter votre demande.')
    } catch {
      addMsg('bot', 'Erreur de connexion au service IA. Vérifiez que le backend est démarré.')
    } finally {
      setLoading(false)
    }
  }

  // Suggestions rapides selon la page
  const suggestions = pathname?.startsWith('/tum')
    ? ['Expliquer N1 vs N2', 'Comment importer Excel ?', 'Interpréter le cumul']
    : pathname?.startsWith('/actions')
    ? ['Priorités des actions', 'Délais recommandés', 'Clôturer une action']
    : ['Comment ça marche ?', 'Aide navigation', 'Bonnes pratiques']

  return (
    <>
      {/* ── Panel de chat */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 88,
          right: 24,
          width: 340,
          height: 480,
          background: '#f8fafd',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(15,30,53,.18)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200,
          overflow: 'hidden',
          animation: 'fadeUp .2s ease',
          border: `1px solid ${C.border}`,
        }}>

          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, #0f1f3d 0%, ${C.navy} 50%, #1e4d8c 100%)`,
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,.12)',
              border: '1.5px solid rgba(96,165,250,.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RobotIcon size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 12.5, color: '#fff', fontFamily: "'Sora', sans-serif" }}>
                Assistant JESA
              </div>
              <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.45)', marginTop: 1 }}>
                ReliabilityOS · IA
              </div>
            </div>
            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 20, padding: '3px 8px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              <span style={{ fontSize: 9, color: 'rgba(34,197,94,.9)', fontWeight: 700 }}>EN LIGNE</span>
            </div>
            {/* Close */}
            <button onClick={() => setOpen(false)} style={{
              background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '50%',
              width: 26, height: 26, cursor: 'pointer', color: 'rgba(255,255,255,.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              transition: 'background .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '14px 12px',
            display: 'flex', flexDirection: 'column',
          }}>
            {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}

            {/* Loading indicator */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: `linear-gradient(135deg, ${C.navy}, #1e4d8c)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <RobotIcon size={16} />
                </div>
                <div style={{
                  padding: '10px 14px', background: '#fff', borderRadius: '4px 14px 14px 14px',
                  border: `1px solid ${C.border}`, display: 'flex', gap: 5, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: C.text4,
                      animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions rapides */}
          {messages.length <= 2 && (
            <div style={{ padding: '6px 12px', display: 'flex', flexWrap: 'wrap', gap: 5, borderTop: `1px solid ${C.border}`, background: '#fff', flexShrink: 0 }}>
              {suggestions.map(s => (
                <button key={s}
                  onClick={() => { setInput(s); setTimeout(() => handleSend(), 50) }}
                  style={{
                    padding: '4px 10px', borderRadius: 20,
                    background: C.bluePale, border: `1px solid ${C.blueMid}`,
                    fontSize: 11, color: C.navy, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.blueMid }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.bluePale }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: `1px solid ${C.border}`,
            background: '#fff',
            display: 'flex', gap: 8, alignItems: 'center',
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Posez votre question..."
              style={{
                flex: 1, padding: '8px 12px',
                border: `1.5px solid ${C.border2}`,
                borderRadius: 20, fontSize: 12.5,
                fontFamily: "'DM Sans', sans-serif",
                outline: 'none', color: C.text,
                background: '#f8fafc',
                transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = C.navy}
              onBlur={e => e.target.style.borderColor = C.border2}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: input.trim() && !loading ? C.navy : C.border2,
                border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all .15s',
                boxShadow: input.trim() && !loading ? '0 2px 8px rgba(26,58,107,.3)' : 'none',
              }}
              onMouseEnter={e => { if (input.trim() && !loading) e.currentTarget.style.transform = 'scale(1.08)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Bouton FAB flottant */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: open
            ? '#fff'
            : `linear-gradient(135deg, ${C.navy} 0%, #1e4d8c 100%)`,
          border: open ? `2px solid ${C.border2}` : 'none',
          boxShadow: open
            ? '0 4px 16px rgba(0,0,0,.12)'
            : '0 4px 20px rgba(26,58,107,.40)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          transition: 'all .25s cubic-bezier(.34,1.56,.64,1)',
          transform: open ? 'rotate(0deg) scale(1)' : 'scale(1)',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.transform = 'scale(1.1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        title={open ? 'Fermer l\'assistant' : 'Assistant JESA'}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <RobotIcon size={26} />
        )}
      </button>

      {/* ── CSS animations */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px) scale(.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: .4; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </>
  )
}