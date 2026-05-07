// src/components/rca/RCAList.jsx
import { useState, useMemo } from 'react'
import C from '../../tokens/colors'
import { getParticipants } from '../../data/participants'

const STATUT_CFG = {
  'non-commencee': { label: 'Non commencée', bg: '#fef2f2', color: '#dc2626', border: '#fecaca', dot: '#dc2626' },
  'en-cours':      { label: 'En cours',      bg: '#fffbeb', color: '#d97706', border: '#fde68a', dot: '#d97706' },
  'cloturee':      { label: 'Clôturée',      bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', dot: '#059669' },
}

const METHODE_CFG = {
  '5why':   { label: 'ARBRE DE CAUSES',  color: '#1a3a6b', fontSize: 11 },
  'kaizen': { label: 'QUICK KAIZEN', color: '#1a3a6b', fontSize: 11 },
}

// ─── Popup choix méthode ──────────────────────────────────────────────────────
// isN2 = niveau 2 OU statut 'alert' (fréquence OU cumul dépassant seuil N2)
function ChoixMethodePopup({ session, onChoisir, onClose }) {
  const isN2 = session.niveau === 2 || session.statut === 'alert'

  const getInfoLabel = () => {
    if (isN2) {
      if (session.statut === 'alert' && session.niveau !== 2) {
        return '⚠️ Seuil N2 atteint (fréquence ou cumul) — Arbre De Causes obligatoire.'
      }
      return '⚠️ Niveau N2 détecté — La méthode Arbre De Causes est obligatoire.'
    }
    return '💡 Niveau N1 détecté — Choisissez librement la méthode.'
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: 500, maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,.28)', overflow: 'hidden', animation: 'fadeUp .2s ease' }}>
        <div style={{ background: C.navy, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: '#fff' }}>Choisir la méthode d'analyse</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>
              {session.equipId ? `⚙️ ${session.equipId}` : '📋 RCA'}
              {session.phenomene ? ` — ${session.phenomene.slice(0, 48)}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13, fontWeight: 500, background: isN2 ? '#fef2f2' : '#eff6ff', border: `1px solid ${isN2 ? '#fecaca' : '#bfdbfe'}`, color: isN2 ? C.red : C.navy }}>
            {getInfoLabel()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Quick Kaizen */}
            <div onClick={() => !isN2 && onChoisir('kaizen')} style={{ padding: 20, borderRadius: 12, position: 'relative', border: `2px solid ${isN2 ? C.border : C.blue2}`, background: isN2 ? C.bg : '#fff', opacity: isN2 ? 0.4 : 1, cursor: isN2 ? 'not-allowed' : 'pointer', transition: 'all .15s' }}
              onMouseOver={e => { if (!isN2) { e.currentTarget.style.background = C.bluePale; e.currentTarget.style.transform = 'translateY(-2px)' }}}
              onMouseOut={e => { if (!isN2) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'none' }}}>
              {!isN2 && <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700, background: C.bluePale, color: C.navy, padding: '2px 8px', borderRadius: 10 }}>Suggéré N1</div>}
              <div style={{ fontSize: 32, marginBottom: 10 }}>⚡</div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 5 }}>Quick Kaizen</div>
              <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6 }}>Analyse rapide · Problèmes simples N1</div>
              {isN2 && <div style={{ marginTop: 10, fontSize: 11, color: C.red, fontWeight: 600 }}>🚫 Non disponible en N2</div>}
            </div>
            {/* Arbre De Causes */}
            <div onClick={() => onChoisir('5why')} style={{ padding: 20, borderRadius: 12, position: 'relative', border: `2px solid ${isN2 ? C.red : C.blue2}`, background: isN2 ? '#fef2f2' : '#fff', cursor: 'pointer', transition: 'all .15s' }}
              onMouseOver={e => { e.currentTarget.style.background = isN2 ? '#fef2f2' : C.bluePale; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseOut={e => { e.currentTarget.style.background = isN2 ? '#fef2f2' : '#fff'; e.currentTarget.style.transform = 'none' }}>
              {isN2 && <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700, background: '#fef2f2', color: C.red, padding: '2px 8px', borderRadius: 10, border: '1px solid #fecaca' }}>✦ Obligatoire N2</div>}
              {!isN2 && <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700, background: C.bluePale, color: C.navy, padding: '2px 8px', borderRadius: 10 }}>Disponible N1</div>}
              <div style={{ fontSize: 32, marginBottom: 10 }}>🌳</div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 5 }}>Arbre De Causes</div>
              <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6 }}>Analyse approfondie des causes</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Popup choix participants (exporté — utilisé aussi dans RCAPage) ──────────
export function ChoixParticipantsPopup({ session, onChoisir, onClose }) {
  const [selectedParticipants, setSelectedParticipants] = useState([])
  const participants = getParticipants()

  const toggleParticipant = (participant) => {
    setSelectedParticipants(prev =>
      prev.find(p => p.id === participant.id)
        ? prev.filter(p => p.id !== participant.id)
        : [...prev, participant]
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: 500, maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,.28)', overflow: 'hidden', animation: 'fadeUp .2s ease' }}>
        <div style={{ background: C.navy, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: '#fff' }}>Choisir les participants</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>
              {session.equipId ? `⚙️ ${session.equipId}` : '📋 RCA'}
              {session.causeArret ? ` — ${session.causeArret}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 20, maxHeight: 300, overflowY: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 10 }}>Participants disponibles</div>
            {participants.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: C.text4, border: `1px dashed ${C.border2}`, borderRadius: 8 }}>
                Aucun participant. Cliquez sur l'engrenage ⚙️ pour en importer.
              </div>
            ) : participants.map(p => {
              const isSelected = !!selectedParticipants.find(sp => sp.id === p.id)
              return (
                <div key={p.id} onClick={() => toggleParticipant(p)} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 6,
                  borderRadius: 8, cursor: 'pointer',
                  background: isSelected ? C.bluePale : '#fff',
                  border: `1.5px solid ${isSelected ? C.navy : C.border2}`,
                  transition: 'all .15s',
                }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff' }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 4,
                    border: `2px solid ${isSelected ? C.navy : C.border2}`,
                    background: isSelected ? C.navy : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{p.nom}</div>
                    <div style={{ fontSize: 11, color: C.text3 }}>{p.fonction || '—'}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 25, border: `1.5px solid ${C.border2}`, background: '#fff', fontSize: 12.5, fontWeight: 600, color: C.text3, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
              Annuler
            </button>
            <button
              onClick={() => selectedParticipants.length > 0 && onChoisir(selectedParticipants)}
              disabled={selectedParticipants.length === 0}
              style={{
                padding: '8px 20px', borderRadius: 25,
                background: selectedParticipants.length > 0 ? C.navy : '#e2e8f0',
                color: selectedParticipants.length > 0 ? '#fff' : '#94a3b8',
                border: 'none', fontSize: 12.5, fontWeight: 700,
                cursor: selectedParticipants.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Commencer l'analyse ({selectedParticipants.length}) →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── FilterBar ──────────────────────────────────────────────────────────────────
function FilterBar({ filters, onChange, equipOptions, causeOptions }) {
  const [openPanel, setOpenPanel] = useState(null)

  const toggle = (key) => setOpenPanel(p => p === key ? null : key)
  const close  = () => setOpenPanel(null)

  const hasDate   = filters.dateFrom || filters.dateTo
  const hasEquip  = !!filters.equipement
  const hasCause  = !!filters.causeArret
  const hasAny    = hasDate || hasEquip || hasCause

  const btnStyle = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', transition: 'all .15s', userSelect: 'none',
    background: active ? C.navy : '#fff',
    color: active ? '#fff' : C.text2,
    border: `1.5px solid ${active ? C.navy : C.border}`,
    boxShadow: active ? '0 2px 8px rgba(26,58,107,.18)' : 'none',
  })

  const dropStyle = {
    position: 'absolute', top: 'calc(100% + 8px)', left: 0,
    background: '#fff', borderRadius: 12, padding: 16,
    border: `1.5px solid ${C.border}`,
    boxShadow: '0 8px 32px rgba(15,30,53,.13)',
    zIndex: 200, minWidth: 260,
    animation: 'fadeUp .15s ease',
  }

  const labelStyle = {
    fontSize: 10.5, fontWeight: 700, color: C.text3,
    textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6, display: 'block',
  }

  const inputStyle = {
    width: '100%', height: 36, padding: '0 10px',
    border: `1.5px solid ${C.border}`, borderRadius: 8,
    fontSize: 12.5, color: C.text, outline: 'none',
    fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box',
    background: '#fff',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderBottom: `1px solid ${C.border}`, background: '#f8fafc', flexWrap: 'wrap' }}
      onClick={e => { if (e.currentTarget === e.target) close() }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.8px' }}>Filtrer par</span>
      </div>

      {/* Filtre Date */}
      <div style={{ position: 'relative' }}>
        <div style={btnStyle(hasDate)} onClick={() => toggle('date')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {hasDate ? `${filters.dateFrom ? new Date(filters.dateFrom).toLocaleDateString('fr-FR') : '…'} → ${filters.dateTo ? new Date(filters.dateTo).toLocaleDateString('fr-FR') : '…'}` : 'Date'}
          {hasDate && <span onClick={e => { e.stopPropagation(); onChange({ ...filters, dateFrom: '', dateTo: '' }) }} style={{ marginLeft: 2, opacity: .7, fontSize: 13, lineHeight: 1 }}>×</span>}
        </div>
        {openPanel === 'date' && (
          <div style={dropStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={labelStyle}>Date de début</span><input type="date" value={filters.dateFrom} onChange={e => onChange({ ...filters, dateFrom: e.target.value })} style={inputStyle} /></div>
              <div><span style={labelStyle}>Date de fin</span><input type="date" value={filters.dateTo} onChange={e => onChange({ ...filters, dateTo: e.target.value })} style={inputStyle} /></div>
            </div>
            {hasDate && <button onClick={() => onChange({ ...filters, dateFrom: '', dateTo: '' })} style={{ marginTop: 10, width: '100%', padding: '6px 0', borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: C.redBg, color: C.red, border: `1px solid ${C.redB}`, cursor: 'pointer' }}>Effacer la date</button>}
          </div>
        )}
      </div>

      {/* Filtre Équipement */}
      <div style={{ position: 'relative' }}>
        <div style={btnStyle(hasEquip)} onClick={() => toggle('equip')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
          {hasEquip ? filters.equipement : 'Équipement'}
          {hasEquip && <span onClick={e => { e.stopPropagation(); onChange({ ...filters, equipement: '' }) }} style={{ marginLeft: 2, opacity: .7, fontSize: 13, lineHeight: 1 }}>×</span>}
        </div>
        {openPanel === 'equip' && (
          <div style={{ ...dropStyle, minWidth: 200 }}>
            <span style={labelStyle}>Équipement</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div onClick={() => { onChange({ ...filters, equipement: '' }); close() }} style={{ padding: '7px 12px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer' }}>Tous les équipements</div>
              {equipOptions.map(eq => (
                <div key={eq} onClick={() => { onChange({ ...filters, equipement: eq }); close() }} style={{ padding: '7px 12px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer' }}>{eq}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filtre Cause d'arrêt */}
      <div style={{ position: 'relative' }}>
        <div style={btnStyle(hasCause)} onClick={() => toggle('cause')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          {hasCause ? `"${filters.causeArret.slice(0, 20)}${filters.causeArret.length > 20 ? '…' : ''}"` : "Cause d'arrêt"}
          {hasCause && <span onClick={e => { e.stopPropagation(); onChange({ ...filters, causeArret: '' }) }} style={{ marginLeft: 2, opacity: .7, fontSize: 13, lineHeight: 1 }}>×</span>}
        </div>
        {openPanel === 'cause' && (
          <div style={{ ...dropStyle, minWidth: 300 }}>
            <span style={labelStyle}>Cause d'arrêt</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
              <div
                onClick={() => { onChange({ ...filters, causeArret: '' }); close() }}
                style={{ padding: '7px 12px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', color: C.text3, fontStyle: 'italic' }}
                onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseOut={e => e.currentTarget.style.background = ''}
              >
                Toutes les causes
              </div>
              {causeOptions.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: 12, color: C.text4, fontStyle: 'italic' }}>
                  Aucune cause enregistrée — ajoutez des arrêts via TUM
                </div>
              )}
              {causeOptions.map((cause, i) => (
                <div
                  key={i}
                  onClick={() => { onChange({ ...filters, causeArret: cause }); close() }}
                  style={{
                    padding: '7px 12px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer',
                    background: filters.causeArret === cause ? C.bluePale : '',
                    color: filters.causeArret === cause ? C.navy : C.text,
                    fontWeight: filters.causeArret === cause ? 600 : 400,
                  }}
                  onMouseOver={e => { if (filters.causeArret !== cause) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseOut={e => { if (filters.causeArret !== cause) e.currentTarget.style.background = '' }}
                >
                  {cause}
                </div>
              ))}
            </div>
            {hasCause && (
              <button onClick={() => onChange({ ...filters, causeArret: '' })} style={{ marginTop: 8, width: '100%', padding: '6px 0', borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: C.redBg, color: C.red, border: `1px solid ${C.redB}`, cursor: 'pointer' }}>
                Effacer
              </button>
            )}
          </div>
        )}
      </div>

      {hasAny && (
        <button onClick={() => { onChange({ dateFrom: '', dateTo: '', equipement: '', causeArret: '' }); close() }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, background: C.redBg, color: C.red, border: `1.5px solid ${C.redB}`, cursor: 'pointer', marginLeft: 4 }}>
          Tout effacer
        </button>
      )}

      {openPanel && <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={close} />}
    </div>
  )
}

function formatDateTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return { date, time }
}

function formatDuree(ms) {
  if (!ms || ms < 1000) return '—'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}min`
  if (m > 0) return `${m}min ${sec.toString().padStart(2, '0')}s`
  return `${sec}s`
}

// ─── Liste principale ──────────────────────────────────────────────────────────
export default function RCAList({ sessions, onSelect, onUpdateSession }) {
  const [popupMethode, setPopupMethode]           = useState(null)
  const [popupParticipants, setPopupParticipants] = useState(null)
  const [tempSession, setTempSession]             = useState(null)
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', equipement: '', causeArret: '' })

  const equipOptions = useMemo(() => [...new Set(sessions.map(s => s.equipId).filter(Boolean))].sort(), [sessions])
  const causeOptions = useMemo(() => [...new Set(sessions.map(s => s.causeArret).filter(Boolean))].sort(), [sessions])

  const STATUT_ORDER = { 'non-commencee': 0, 'en-cours': 1, 'cloturee': 2 }

  const filtered = useMemo(() => {
    return sessions
      .filter(s => {
        if (filters.equipement && s.equipId !== filters.equipement) return false
        if (filters.causeArret && s.causeArret !== filters.causeArret) return false
        if (filters.dateFrom && s.dateOuverture && s.dateOuverture < filters.dateFrom) return false
        if (filters.dateTo && s.dateOuverture && s.dateOuverture > filters.dateTo) return false
        return true
      })
      .sort((a, b) => (STATUT_ORDER[a.statut] ?? 3) - (STATUT_ORDER[b.statut] ?? 3))
  }, [sessions, filters])

  const activeFiltersCount = [filters.dateFrom, filters.dateTo, filters.equipement, filters.causeArret].filter(Boolean).length
  const enCours = sessions.filter(s => s.statut === 'en-cours').length
  const nonComm = sessions.filter(s => s.statut === 'non-commencee').length

  const handleOuvrir = (s) => {
    const now = new Date().toISOString()

    if (s.statut === 'cloturee') {
      onSelect(s, [])
      return
    }

    if ((s.niveau === 2 || s.statut === 'alert') && !s.methode) {
      const updated = { ...s, methode: '5why', statut: 'en-cours', dateHeureDebut: s.dateHeureDebut || now }
      onUpdateSession(updated)
      setTempSession(updated)
      setPopupParticipants(updated)
      return
    }

    if (s.methode) {
      if (s.participants && s.participants.length > 0) {
        const updated = s.dateHeureDebut ? s : { ...s, dateHeureDebut: now }
        if (!s.dateHeureDebut) onUpdateSession(updated)
        onSelect(updated, updated.participants)
        return
      }
      const updated = s.dateHeureDebut ? s : { ...s, dateHeureDebut: now }
      setTempSession(updated)
      setPopupParticipants(updated)
      return
    }

    setPopupMethode(s)
  }

  const handleChoisirMethode = (methode) => {
    const now = new Date().toISOString()
    const updated = { ...popupMethode, methode, statut: 'en-cours', dateHeureDebut: popupMethode.dateHeureDebut || now }
    onUpdateSession(updated)
    setPopupMethode(null)
    setTempSession(updated)
    setPopupParticipants(updated)
  }

  const handleChoisirParticipants = (participants) => {
    const now = new Date().toISOString()
    const updated = { ...tempSession, participants, statut: 'en-cours', dateHeureDebut: tempSession.dateHeureDebut || now }
    onUpdateSession(updated)
    setPopupParticipants(null)
    setTempSession(null)
    onSelect(updated, participants)
  }

  if (!sessions.length) return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 48, textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔬</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Aucune session RCA</div>
    </div>
  )

  const GRID_COLS = '108px 190px 58px 1fr 118px 100px 100px 62px 122px 80px'

  return (
    <>
      {popupMethode && (
        <ChoixMethodePopup
          session={popupMethode}
          onChoisir={handleChoisirMethode}
          onClose={() => setPopupMethode(null)}
        />
      )}

      {popupParticipants && (
        <ChoixParticipantsPopup
          session={popupParticipants}
          onChoisir={handleChoisirParticipants}
          onClose={() => setPopupParticipants(null)}
        />
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(15,30,53,.07)', marginBottom: 20 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a3a6b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Sessions RCA</span>
            {activeFiltersCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: C.navy, color: '#fff', borderRadius: 20, padding: '2px 8px' }}>{filtered.length}/{sessions.length}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {enCours > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#eef2f7', color: '#334155', border: '1.5px solid #d1dbe8' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#334155', display: 'inline-block' }} />{enCours} en cours</span>}
            {nonComm > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />{nonComm} non commencée{nonComm > 1 ? 's' : ''}</span>}
          </div>
        </div>

        <FilterBar filters={filters} onChange={setFilters} equipOptions={equipOptions} causeOptions={causeOptions} />

        {/* ── En-têtes colonnes ── */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: '0 8px', padding: '6px 16px', borderTop: '1px solid #e2e8f0', borderBottom: '2px solid #e2e8f0', background: '#0b2e63' }}>
          {['ID', 'POSTE TECHNIQUE', 'ZONE', "CAUSE D'ARRÊT", 'MÉTHODE', 'RCA DÉBUT', 'RCA FIN', 'DURÉE', 'STATUT', ''].map((h, i) => (
            <div key={i} style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: C.text4 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Aucun résultat pour ces filtres</div>
            <div style={{ fontSize: 12, marginTop: 4, color: C.text4 }}>Modifiez ou réinitialisez les filtres</div>
          </div>
        )}

        {filtered.map((s, idx) => {
          const sc = STATUT_CFG[s.statut] || STATUT_CFG['en-cours']
          const mc = s.methode ? METHODE_CFG[s.methode] : null
          const isLast = idx === filtered.length - 1
          const isClosed = s.statut === 'cloturee'
          const isEven = idx % 2 === 0
          const causeText = s.causeArret || s.phenomene || '—'

          return (
            <div key={s.id}
              style={{
                display: 'grid',
                gridTemplateColumns: GRID_COLS,
                gap: '0 8px',
                padding: '7px 16px',
                borderBottom: isLast ? 'none' : '1px solid #e9eef5',
                alignItems: 'center',
                transition: 'background .12s',
                borderLeft: `3px solid ${sc.dot}`,
                background: isEven ? '#fff' : '#f8fafd',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#eef4ff'}
              onMouseLeave={e => e.currentTarget.style.background = isEven ? '#fff' : '#f8fafd'}
            >
              {/* ID */}
              <div style={{ fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 10, fontWeight: 600, color: isClosed ? '#94a3b8' : '#1a3a6b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.id}>
                {s.id}
              </div>

              {/* POSTE TECHNIQUE */}
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 10.5, color: '#1a3a6b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.equipId || '—'}>
                {s.equipId || '—'}
              </div>

              {/* ZONE */}
              <div>
                <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'inline-block', whiteSpace: 'nowrap' }}>{s.zone || '—'}</span>
              </div>

              {/* CAUSE D'ARRÊT */}
              <div style={{ paddingRight: 8, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, color: isClosed ? '#94a3b8' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={causeText}>
                  {causeText}
                </div>
                {s.phenomene && s.causeArret && s.causeArret !== s.phenomene && (
                  <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.phenomene}>{s.phenomene}</div>
                )}
              </div>

              {/* MÉTHODE */}
              <div style={{ fontWeight: 700, fontSize: 10, color: '#1a3a6b', whiteSpace: 'nowrap', letterSpacing: '.3px' }}>
                {mc ? mc.label : <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 10.5 }}>À choisir</span>}
              </div>

              {/* DATE HEURE DÉBUT */}
              <div>
                {(() => {
                  const dt = formatDateTime(s.dateHeureDebut)
                  return dt ? (
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1d4ed8' }}>{dt.date}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{dt.time}</div>
                    </div>
                  ) : <span style={{ fontSize: 11, color: '#cbd5e1' }}>—</span>
                })()}
              </div>

              {/* DATE HEURE FIN */}
              <div>
                {(() => {
                  const dt = formatDateTime(s.dateHeureFin)
                  return dt ? (
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#059669' }}>{dt.date}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{dt.time}</div>
                    </div>
                  ) : <span style={{ fontSize: 11, color: '#cbd5e1' }}>—</span>
                })()}
              </div>

              {/* DURÉE */}
              <div style={{ fontSize: 11, fontWeight: 600, color: s.tempsAnalyse ? '#1d4ed8' : '#cbd5e1', fontFamily: "'Sora',sans-serif", whiteSpace: 'nowrap' }}>
                {formatDuree(s.tempsAnalyse)}
              </div>

              {/* STATUT */}
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 600, background: sc.bg, color: sc.color, border: `1.5px solid ${sc.border}`, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, flexShrink: 0, display: 'inline-block' }} />
                  {sc.label}
                </span>
              </div>

              {/* BOUTON */}
              <div style={{ textAlign: 'right' }}>
                <button onClick={() => handleOuvrir(s)} style={{ borderRadius: 20, fontWeight: 700, padding: '4px 12px', fontSize: 11, background: '#0b2e63', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap' }}>
                  Ouvrir →
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
