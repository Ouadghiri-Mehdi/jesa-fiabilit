// src/components/rca/RCAPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import C from '../../tokens/colors'
import RCAList from './RCAList'
import RCADetail from './RCADetail'
import NewRCAModal from './NewRCAModal'
import useNotifs from '../../hooks/useNotifs'
import { getParticipants } from '../../data/participants'
import { useRCAContext } from '../layout/Layout'

// ─── Popup choix participants (utilisé pour le flow TUM → RCA) ───────────────
function ChoixParticipantsPopup({ session, onChoisir, onClose }) {
  const [selected, setSelected] = useState([])
  const participants = getParticipants()
  const [showManual, setShowManual] = useState(false)
  const [manualNom, setManualNom] = useState('')
  const [manualFonction, setManualFonction] = useState('')

  const toggle = (p) => {
    setSelected(prev =>
      prev.find(x => x.id === p.id) ? prev.filter(x => x.id !== p.id) : [...prev, p]
    )
  }

  const handleAddManual = () => {
    const nom = manualNom.trim()
    if (!nom) return
    const p = { id: `manual-${Date.now()}`, nom, fonction: manualFonction.trim() }
    setSelected(prev => [...prev, p])
    setManualNom('')
    setManualFonction('')
    setShowManual(false)
  }

  const inputSt = {
    padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 16, width: 500, maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,.28)', overflow: 'hidden', animation: 'fadeUp .2s ease' }}>
        <div style={{ background: C.navy, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: '#fff' }}>Choisir les participants</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>
              {session?.equipId ? `⚙️ ${session.equipId}` : '📋 RCA'}
              {session?.causeArret ? ` — ${session.causeArret}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 10 }}>Participants disponibles</div>
            {participants.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: C.text4, border: `1px dashed ${C.border2}`, borderRadius: 8 }}>
                Aucun participant. Configurez la liste dans Paramétrage TUM → Participants.
              </div>
            ) : participants.map(p => {
              const isSel = !!selected.find(x => x.id === p.id)
              return (
                <div
                  key={p.id}
                  onClick={() => toggle(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', marginBottom: 6, borderRadius: 8, cursor: 'pointer',
                    background: isSel ? C.bluePale : '#fff',
                    border: `1.5px solid ${isSel ? C.navy : C.border2}`,
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = '#fff' }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${isSel ? C.navy : C.border2}`,
                    background: isSel ? C.navy : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSel && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{p.nom}</div>
                    <div style={{ fontSize: 11, color: C.text3 }}>{p.fonction || '—'}</div>
                  </div>
                </div>
              )
            })}

            {/* Participants manuels déjà ajoutés */}
            {selected.filter(s => s.id.startsWith('manual-')).map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', marginBottom: 6, borderRadius: 8,
                background: C.bluePale, border: `1.5px solid ${C.navy}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${C.navy}`, background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{p.nom} <span style={{ fontSize: 10, color: C.text4, fontWeight: 400 }}>(manuel)</span></div>
                    <div style={{ fontSize: 11, color: C.text3 }}>{p.fonction || '—'}</div>
                  </div>
                </div>
                <button onClick={() => setSelected(prev => prev.filter(x => x.id !== p.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>

          {/* Section saisie manuelle */}
          {showManual ? (
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: `1px solid ${C.border2}`, marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text3, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Saisir un participant
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  style={{ ...inputSt, flex: 2 }}
                  placeholder="Nom du participant *"
                  value={manualNom}
                  onChange={e => setManualNom(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddManual()}
                  autoFocus
                />
                <input
                  style={{ ...inputSt, flex: 2 }}
                  placeholder="Fonction"
                  value={manualFonction}
                  onChange={e => setManualFonction(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddManual()}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowManual(false)} style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${C.border2}`, background: '#fff', fontSize: 12, color: C.text3, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  Annuler
                </button>
                <button
                  onClick={handleAddManual}
                  disabled={!manualNom.trim()}
                  style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: manualNom.trim() ? C.navy : '#e2e8f0', color: manualNom.trim() ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 12, cursor: manualNom.trim() ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans',sans-serif" }}
                >
                  + Ajouter
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowManual(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: `1.5px dashed ${C.border2}`, background: '#fff', fontSize: 12, color: C.text3, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", marginBottom: 16, transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.color = C.navy }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text3 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Saisir un participant manuellement
            </button>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 25, border: `1.5px solid ${C.border2}`, background: '#fff', fontSize: 12.5, fontWeight: 600, color: C.text3, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
              Annuler
            </button>
            <button
              onClick={() => selected.length > 0 && onChoisir(selected)}
              disabled={selected.length === 0}
              style={{
                padding: '8px 20px', borderRadius: 25, border: 'none',
                background: selected.length > 0 ? C.navy : '#e2e8f0',
                color: selected.length > 0 ? '#fff' : '#94a3b8',
                fontSize: 12.5, fontWeight: 700,
                cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Commencer l'analyse ({selected.length}) →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function RCAPage() {
  const { equipId: paramId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { showNotif } = useNotifs()
  const queryParams = new URLSearchParams(location.search)

  const niveauFromQuery = queryParams.get('niveau') ? parseInt(queryParams.get('niveau')) : 2

  const isRcaId = paramId && paramId.startsWith('RCA-')
  const rcaIdFromUrl = isRcaId ? paramId : null
  const equipIdFromTUM = !isRcaId ? paramId : null

  // ── Sessions Supabase ────────────────────────────────────────────────────────
  const { sessions, setSessions, loading, createSession, updateSession } = useRCAContext()

  // ── États UI ─────────────────────────────────────────────────────────────────
  const [selected, setSelected]               = useState(null)
  const [selectedParticipants, setSelectedParticipants] = useState([])
  const [showNew, setShowNew]                 = useState(false)
  const [showParticipantsForTUM, setShowParticipantsForTUM] = useState(null) // session object
  const [autoOpenDone, setAutoOpenDone]       = useState(false)

  // ── Ouverture via URL /rca/RCA-2026-XXX ─────────────────────────────────────
  // Ne reset PAS selectedParticipants ici — géré par handleSelect/handleParticipantsChoisis/handleBack
  useEffect(() => {
    if (rcaIdFromUrl) {
      const session = sessions.find(s => s.id === rcaIdFromUrl)
      setSelected(session || null)
    } else {
      setSelected(null)
    }
  }, [rcaIdFromUrl, sessions])

  // ── Flow TUM → RCA : trouver/créer session puis afficher popup participants ──
  useEffect(() => {
    if (!equipIdFromTUM || autoOpenDone || loading) return
    setAutoOpenDone(true)

    const existing = sessions.find(
      s => s.equipId === equipIdFromTUM && s.statut !== 'cloturee'
    )

    if (existing) {
      setShowParticipantsForTUM(existing)
    } else {
      const niveauNum = niveauFromQuery || 2
      const today = new Date().toISOString().slice(0, 10)
      const newSession = {
        id: `RCA-${today.replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`,
        equipId: equipIdFromTUM,
        dateOuverture: today,
        niveau: niveauNum,
        source: 'TUM',
        responsable: '',
        cumulArret: 0,
        frequence: 0,
        tauxPanne: 0,
        disponibilite: 100,
        participants: [],
        statut: 'non-commencee',
        methode: niveauNum === 2 ? '5why' : null,
        phenomene: queryParams.get('phenomene') || '',
        causeArret: '',
        noeuds: [],
        actionsGenerees: [],
      }
      createSession(newSession).then(created => {
        setShowParticipantsForTUM(created || newSession)
      })
    }
  }, [equipIdFromTUM, autoOpenDone, loading]) // eslint-disable-line

  // ── Ouverture manuelle via ?modal=new ────────────────────────────────────────
  useEffect(() => {
    const modal = new URLSearchParams(location.search).get('modal')
    if (modal === 'new') setShowNew(true)
  }, [location.search])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCreate = async (s) => {
    const created = await createSession(s)
    setShowNew(false)
    setShowParticipantsForTUM(created || s)
  }

  const handleUpdate = async (u) => {
    const updated = await updateSession(u)
    if (selected && selected.id === u.id) setSelected(updated || u)
  }

  const handleUpdateSession = (u) => {
    updateSession(u)
  }

  const handleBack = () => {
    setSelected(null)
    setSelectedParticipants([])  // reset uniquement au retour à la liste
    navigate('/rca')
  }

  const handleSelect = (session, participants = []) => {
    setSelectedParticipants(participants)
    setSelected(session)
    navigate(`/rca/${session.id}`)
  }

  const handleCloseNew = () => {
    setShowNew(false)
    navigate('/rca', { replace: true })
  }

  const handleParticipantsChoisis = async (participants) => {
    const session = showParticipantsForTUM
    const now = new Date().toISOString()
    const methodeEffective = session.methode || (session.niveau === 1 ? 'kaizen' : '5why')
    const updated = { ...session, methode: methodeEffective, participants, statut: 'en-cours', dateHeureDebut: session.dateHeureDebut || now }
    await handleUpdate(updated)
    setShowParticipantsForTUM(null)
    setSelectedParticipants(participants)
    navigate(`/rca/${session.id}`)
  }

  const enCours   = sessions.filter(s => s.statut === 'en-cours').length
  const cloturees = sessions.filter(s => s.statut === 'cloturee').length
  const nonComm   = sessions.filter(s => s.statut === 'non-commencee').length

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>

      {/* Popup participants — flow TUM → RCA */}
      {showParticipantsForTUM && (
        <ChoixParticipantsPopup
          session={showParticipantsForTUM}
          onChoisir={handleParticipantsChoisis}
          onClose={() => { setShowParticipantsForTUM(null); navigate('/rca', { replace: true }) }}
        />
      )}

      {/* Modal nouvelle RCA — création manuelle uniquement */}
      {showNew && !equipIdFromTUM && (
        <NewRCAModal
          defaultEquipId={null}
          defaultNiveau={null}
          defaultPhenomene=""
          fromTUM={false}
          onClose={handleCloseNew}
          onCreate={handleCreate}
        />
      )}

      {selected ? (
        <RCADetail
          session={selected}
          onUpdate={handleUpdate}
          onBack={handleBack}
          preSelectedParticipants={selectedParticipants}
        />
      ) : (
        <>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Total sessions',  value: sessions.length, color: C.navy },
              { label: 'Non commencées',  value: nonComm,         color: C.red },
              { label: 'En cours',        value: enCours,         color: C.orange },
              { label: 'Clôturées',       value: cloturees,       color: C.green },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, borderTop: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 7 }}>{k.label}</div>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 32, color: C.text }}>{k.value}</div>
              </div>
            ))}
          </div>

          <RCAList
            sessions={sessions}
            onSelect={handleSelect}
            onUpdateSession={handleUpdateSession}
          />
        </>
      )}
    </div>
  )
}
