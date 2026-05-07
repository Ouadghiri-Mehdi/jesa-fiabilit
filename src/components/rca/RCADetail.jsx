// src/components/rca/RCADetail.jsx
// Version avec statistiques TUM + Quick Kaizen intégré
// Quick Kaizen reçoit onGenererActions pour générer les actions
// 🔥 Suppression de l'onglet "Réunion fiabilité"
// 🔥 Tableau participants en lignes (après validation)
// 🔥 Ordre : Plan d'actions → Participants & contributions

import { useState, useCallback, useEffect, useRef } from 'react'
import C from '../../tokens/colors'
import FiveWhyTree from './FiveWhyTree'
import QuickKaizenWheel from './QuickKaizenWheel'
import ActionsTable from './ActionsTable'
import AgentIA from './AgentIA'
import { getParticipants } from '../../data/participants'

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

const STATUT_CFG = {
  'non-commencee': { label: 'Non commencée', bg: '#fef2f2', color: '#dc2626', border: '#fecaca', dot: '#dc2626' },
  'en-cours':      { label: 'En cours',      bg: '#eef2f7', color: '#334155', border: '#d1dbe8', dot: '#334155' },
  'cloturee':      { label: 'Clôturée',      bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', dot: '#059669' },
}

function getFeuilllesValidees(noeuds) {
  if (!noeuds || !noeuds.length) return []
  const result = []
  const traverse = (n) => {
    const hasChildren = n.enfants && n.enfants.length > 0
    if (!hasChildren && n.statut === 'valide') result.push(n)
    else if (hasChildren) n.enfants.forEach(traverse)
  }
  noeuds.forEach(traverse)
  return result
}

// ── Popup choix méthode ───────────────────────────────────────────────────────
function ChoixMethodePopup({ session, onChoisir, onClose }) {
  const isN2 = session.niveau === 2
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.52)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:16, width:500, maxWidth:'95vw', boxShadow:'0 24px 64px rgba(0,0,0,.28)', overflow:'hidden', animation:'fadeUp .2s ease' }}>
        <div style={{ background:C.navy, padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:15, color:'#fff' }}>Choisir la méthode d'analyse</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.55)', marginTop:2 }}>
              {session.equipId ? `⚙️ ${session.equipId}` : '📋 RCA'}
              {session.phenomene ? ` — ${session.phenomene.slice(0,48)}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,.6)', fontSize:24, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ padding:'10px 16px', borderRadius:8, marginBottom:20, fontSize:13, fontWeight:500, background:isN2?'#fef2f2':'#eff6ff', border:`1px solid ${isN2?'#fecaca':'#bfdbfe'}`, color:isN2?C.red:C.navy }}>
            {isN2 ? '⚠️ Niveau N2 détecté — La méthode Arbre De Causes est obligatoire.' : '💡 Niveau N1 détecté — Choisissez librement la méthode.'}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div onClick={()=>!isN2&&onChoisir('kaizen')}
              style={{ padding:20, borderRadius:12, position:'relative', border:`2px solid ${isN2?C.border:C.blue2}`, background:isN2?C.bg:'#fff', opacity:isN2?0.4:1, cursor:isN2?'not-allowed':'pointer', transition:'all .15s' }}
              onMouseOver={e=>{if(!isN2){e.currentTarget.style.background=C.bluePale;e.currentTarget.style.transform='translateY(-2px)'}}}
              onMouseOut={e=>{if(!isN2){e.currentTarget.style.background='#fff';e.currentTarget.style.transform='none'}}}>
              {!isN2&&<div style={{ position:'absolute', top:10, right:10, fontSize:9, fontWeight:700, background:C.bluePale, color:C.navy, padding:'2px 8px', borderRadius:10 }}>Suggéré N1</div>}
              <div style={{ marginBottom:10, display:'flex', alignItems:'center', justifyContent:'center', width:44, height:44, borderRadius:10, background:'#fff7ed', border:'1.5px solid #fed7aa' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:14, color:C.text, marginBottom:5 }}>Quick Kaizen</div>
              <div style={{ fontSize:12, color:C.text3, lineHeight:1.6 }}>Analyse rapide structurée.<br/>Résolution directe pour problèmes simples.</div>
              {isN2&&<div style={{ marginTop:10, fontSize:11, color:C.red, fontWeight:600 }}>Non disponible en N2</div>}
            </div>
            <div onClick={()=>onChoisir('5why')}
              style={{ padding:20, borderRadius:12, position:'relative', border:`2px solid ${isN2?C.red:C.blue2}`, background:isN2?'#fef2f2':'#fff', cursor:'pointer', transition:'all .15s' }}
              onMouseOver={e=>{e.currentTarget.style.background=isN2?'#fef2f2':C.bluePale;e.currentTarget.style.transform='translateY(-2px)'}}
              onMouseOut={e=>{e.currentTarget.style.background=isN2?'#fef2f2':'#fff';e.currentTarget.style.transform='none'}}>
              {isN2&&<div style={{ position:'absolute', top:10, right:10, fontSize:9, fontWeight:700, background:'#fef2f2', color:C.red, padding:'2px 8px', borderRadius:10, border:'1px solid #fecaca' }}>✦ Obligatoire N2</div>}
              {!isN2&&<div style={{ position:'absolute', top:10, right:10, fontSize:9, fontWeight:700, background:C.bluePale, color:C.navy, padding:'2px 8px', borderRadius:10 }}>Disponible N1</div>}
              <div style={{ marginBottom:10, display:'flex', alignItems:'center', justifyContent:'center', width:44, height:44, borderRadius:10, background:'#f0fdf4', border:'1.5px solid #bbf7d0' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="5" cy="16" r="3"/><circle cx="19" cy="16" r="3"/><line x1="12" y1="12" x2="5" y2="13"/><line x1="12" y1="12" x2="19" y2="13"/></svg>
              </div>
              <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:14, color:C.text, marginBottom:5 }}>Arbre De Causes</div>
              <div style={{ fontSize:12, color:C.text3, lineHeight:1.6 }}>Arbre des causes horizontal.<br/>Analyse approfondie multi-niveaux.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ───────────────────────────────────────────────────────
export default function RCADetail({ session, onUpdate, onBack, preSelectedParticipants = [] }) {
  const isN2 = session.niveau === 2
  const methodeInitiale = session.methode || (isN2 ? '5why' : null)
  const lockedInitial   = !!session.methode || isN2

  const [methode,       setMethode]   = useState(methodeInitiale)
  const [methodeLocked, setML]        = useState(lockedInitial)
  const [showPopup,     setShowPopup] = useState(!lockedInitial)
  const [noeuds,        setNoeuds]    = useState(session.noeuds || [])
  const [actions,       setActions]   = useState(session.actionsGenerees || [])
  const [showActions,   setShowAct]   = useState(session.actionsGenerees?.length > 0)
  const [participantsData, setParticipantsData] = useState(() => {
    const src = preSelectedParticipants.length > 0
      ? preSelectedParticipants
      : (session.participants || [])
    return src.map(p => ({ ...p, reco: p.reco || '', responsable: p.responsable || '', delai: p.delai || '' }))
  })

  const sc = STATUT_CFG[session.statut] || STATUT_CFG['non-commencee']

  // ── Chronomètre d'analyse ──────────────────────────────────────────────────
  const chronoStartRef  = useRef(null)
  const accumulatedRef  = useRef(session.tempsAnalyse || 0)
  const sessionRef      = useRef(session)
  const onUpdateRef     = useRef(onUpdate)
  const [chronoDisplay, setChronoDisplay] = useState(session.tempsAnalyse || 0)

  useEffect(() => { sessionRef.current  = session  }, [session])
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])

  useEffect(() => {
    if (session.statut === 'cloturee') {
      setChronoDisplay(session.tempsAnalyse || 0)
      return
    }
    chronoStartRef.current = Date.now()
    accumulatedRef.current = session.tempsAnalyse || 0

    const interval = setInterval(() => {
      if (!chronoStartRef.current) return
      setChronoDisplay(accumulatedRef.current + (Date.now() - chronoStartRef.current))
    }, 1000)

    return () => {
      clearInterval(interval)
      if (!chronoStartRef.current) return
      const elapsed = Date.now() - chronoStartRef.current
      const total   = accumulatedRef.current + elapsed
      chronoStartRef.current = null
      onUpdateRef.current({
        ...sessionRef.current,
        tempsAnalyse:    total,
        chronoStartedAt: null,
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (isN2 && !session.methode) {
    setTimeout(() => {
      onUpdate({ ...session, methode:'5why', statut:'en-cours', noeuds, actionsGenerees:actions })
    }, 0)
  }

  const choisirMethode = (m) => {
    if (isN2 && m === 'kaizen') return
    setMethode(m); setML(true); setShowPopup(false)
    onUpdate({ ...session, methode:m, statut:'en-cours', noeuds, actionsGenerees:actions })
  }

  const handleNoeudsChange = useCallback((n) => {
    setNoeuds(n)
    onUpdate({ ...session, methode, noeuds:n, actionsGenerees:actions })
  }, [session, methode, actions, onUpdate])

  const handleParticipantUpdate = (index, field, value) => {
    const updated = [...participantsData]
    updated[index] = { ...updated[index], [field]: value }
    setParticipantsData(updated)
  }

  // Modal sélection multiple participants
  const [showPicker, setShowPicker] = useState(false)
  const [allParticipants, setAllParticipants] = useState([])
  const [selected, setSelected] = useState([])
  const [newNom, setNewNom] = useState('')
  const [newFonction, setNewFonction] = useState('')

  const openPicker = () => {
    setAllParticipants(getParticipants())
    setSelected([])
    setNewNom('')
    setNewFonction('')
    setShowPicker(true)
  }

  const toggleSelect = (p) => {
    const alreadyIn = participantsData.some(d => d.id === p.id || d.nom === p.nom)
    if (alreadyIn) return
    setSelected(prev =>
      prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
    )
  }

  const confirmSelection = () => {
    const toAdd = allParticipants
      .filter(p => selected.includes(p.id))
      .map(p => ({ ...p, reco: '', responsable: '', delai: '', _manual: false }))
    setParticipantsData(prev => [...prev, ...toAdd])
    setShowPicker(false)
  }

  const addManualPerson = () => {
    if (!newNom.trim()) return
    const p = { id: `manual-${Date.now()}`, nom: newNom.trim(), fonction: newFonction.trim(), reco: '', responsable: '', delai: '', _manual: true }
    setParticipantsData(prev => [...prev, p])
    setNewNom('')
    setNewFonction('')
  }

  const handleRemoveParticipant = (index) => {
    setParticipantsData(prev => prev.filter((_, i) => i !== index))
  }

  // ── 5WHY : génère les actions depuis les feuilles validées
  const handleValider = () => {
    const feuilles = getFeuilllesValidees(noeuds)
    const newActions = feuilles.map((f, i) => ({
      id: `act-${Date.now()}-${i}`,
      cause: f.texte, action:'', responsable:'', delai:'', statut:'pas-commence',
    }))
    setActions(newActions); setShowAct(true)
    onUpdate({ ...session, methode, noeuds, actionsGenerees:newActions, statut:'en-cours', participants: participantsData })
  }

  // ── Quick Kaizen : reçoit les actions générées depuis PanelAct
  const handleKaizenGenererActions = (newActions) => {
    setActions(newActions); setShowAct(true)
    onUpdate({ ...session, methode, noeuds, actionsGenerees:newActions, statut:'en-cours', participants: participantsData })
  }

  const handleCloturer = () => {
    let total = accumulatedRef.current
    if (chronoStartRef.current) {
      total += Date.now() - chronoStartRef.current
      chronoStartRef.current = null
    }
    setChronoDisplay(total)
    onUpdate({ ...session, methode, noeuds, actionsGenerees: actions, statut: 'cloturee', participants: participantsData, tempsAnalyse: total, chronoStartedAt: null, dateHeureFin: new Date().toISOString() })
  }

  const handleActionChange = (a) => {
    setActions(a)
    onUpdate({ ...session, methode, noeuds, actionsGenerees:a, participants: participantsData })
  }

  // Styles pour les champs
  const inputStyle = {
    width: '100%',
    padding: '6px 8px',
    border: `1.5px solid ${C.border2}`,
    borderRadius: 6,
    fontSize: 11.5,
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    background: '#fff',
    transition: 'border-color .15s',
  }

  const textareaStyle = {
    ...inputStyle,
    minHeight: 32,
    resize: 'vertical',
  }

  const COLORS_PART = ['#1a3a6b','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#0f766e','#b45309']

  return (
    <div style={{ animation:'fadeUp .2s ease' }}>

      {showPopup && (
        <ChoixMethodePopup session={session} onChoisir={choisirMethode} onClose={()=>{setShowPopup(false);onBack()}} />
      )}

      {/* ── Modal sélection multiple participants ── */}
      {showPicker && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target === e.currentTarget && setShowPicker(false)}
        >
          <div style={{ background:'#fff', borderRadius:14, width:460, maxWidth:'95vw', maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,.25)', overflow:'hidden', animation:'fadeUp .18s ease' }}>

            {/* Header modal */}
            <div style={{ padding:'16px 20px', background:C.navy, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:15, color:'#fff' }}>
                  Sélectionner des participants
                </div>
                <div style={{ fontSize:11.5, color:'rgba(255,255,255,.55)', marginTop:2 }}>
                  Cochez tous ceux que vous souhaitez ajouter
                </div>
              </div>
              <button onClick={() => setShowPicker(false)}
                style={{ background:'none', border:'none', color:'rgba(255,255,255,.6)', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
            </div>

            {/* Liste scrollable — TOUS les participants visibles */}
            <div style={{ overflowY:'auto', flex:1, padding:'8px 0' }}>
              {allParticipants.length === 0 ? (
                <div style={{ padding:'32px 20px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>
                  Aucun participant dans la liste.<br/>
                  <span style={{ fontSize:11 }}>Gérez la liste depuis les paramètres.</span>
                </div>
              ) : (
                allParticipants.map((p, i) => {
                  const alreadyIn = participantsData.some(d => d.id === p.id || d.nom === p.nom)
                  const isChecked = selected.includes(p.id)
                  const col       = COLORS_PART[i % COLORS_PART.length]
                  const initials  = p.nom.trim().split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

                  return (
                    <div key={p.id}
                      onClick={() => toggleSelect(p)}
                      style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'11px 20px',
                        cursor: alreadyIn ? 'not-allowed' : 'pointer',
                        background: isChecked ? '#eff6ff' : '#fff',
                        borderBottom:'1px solid #f1f5f9',
                        opacity: alreadyIn ? 0.5 : 1,
                        transition:'background .12s',
                      }}
                      onMouseEnter={e => { if(!alreadyIn) e.currentTarget.style.background = isChecked ? '#dbeafe' : '#f8fafc' }}
                      onMouseLeave={e => { if(!alreadyIn) e.currentTarget.style.background = isChecked ? '#eff6ff' : '#fff' }}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width:18, height:18, borderRadius:5, flexShrink:0,
                        border: alreadyIn ? '2px solid #a7f3d0' : isChecked ? `2px solid ${C.navy}` : '2px solid #cbd5e1',
                        background: alreadyIn ? '#ecfdf5' : isChecked ? C.navy : '#fff',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        transition:'all .15s',
                      }}>
                        {(alreadyIn || isChecked) && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>

                      {/* Avatar */}
                      <div style={{
                        width:36, height:36, borderRadius:'50%', flexShrink:0,
                        background: alreadyIn ? '#e2e8f0' : col,
                        color: alreadyIn ? '#94a3b8' : '#fff',
                        fontSize:12, fontWeight:800,
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        {initials}
                      </div>

                      {/* Infos */}
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color: alreadyIn ? '#94a3b8' : '#0f172a' }}>{p.nom}</div>
                        <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>{p.fonction}</div>
                      </div>

                      {/* Statut */}
                      {alreadyIn && (
                        <span style={{ fontSize:10, fontWeight:700, color:'#059669', background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:10, padding:'2px 9px', flexShrink:0 }}>
                          ✓ Déjà ajouté
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Zone ajout nouvelle personne */}
            <div style={{ padding:'12px 20px', borderTop:'1px solid #e2e8f0', background:'#f8fafc' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                Ajouter une nouvelle personne
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input
                  value={newNom}
                  onChange={e => setNewNom(e.target.value)}
                  placeholder="Nom complet"
                  onKeyDown={e => e.key === 'Enter' && addManualPerson()}
                  style={{ flex:2, padding:'7px 10px', borderRadius:7, border:'1.5px solid #e2e8f0', fontSize:12.5, color:'#0f172a', outline:'none', fontFamily:"'DM Sans',sans-serif", background:'#fff' }}
                  onFocus={e => e.target.style.borderColor = C.navy}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <input
                  value={newFonction}
                  onChange={e => setNewFonction(e.target.value)}
                  placeholder="Rôle / Fonction"
                  onKeyDown={e => e.key === 'Enter' && addManualPerson()}
                  style={{ flex:2, padding:'7px 10px', borderRadius:7, border:'1.5px solid #e2e8f0', fontSize:12.5, color:'#0f172a', outline:'none', fontFamily:"'DM Sans',sans-serif", background:'#fff' }}
                  onFocus={e => e.target.style.borderColor = C.navy}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <button
                  onClick={addManualPerson}
                  disabled={!newNom.trim()}
                  style={{
                    padding:'7px 14px', borderRadius:7, border:'none',
                    background: newNom.trim() ? C.navy : '#e2e8f0',
                    color: newNom.trim() ? '#fff' : '#94a3b8',
                    fontSize:12.5, fontWeight:700, cursor: newNom.trim() ? 'pointer' : 'not-allowed',
                    fontFamily:"'DM Sans',sans-serif", whiteSpace:'nowrap', flexShrink:0,
                  }}>
                  + Ajouter
                </button>
              </div>
            </div>

            {/* Footer — bouton confirmer */}
            <div style={{ padding:'12px 20px', borderTop:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff' }}>
              <span style={{ fontSize:12, color:'#64748b' }}>
                {selected.length === 0
                  ? 'Aucun participant de la liste sélectionné'
                  : `${selected.length} participant(s) sélectionné(s)`}
              </span>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowPicker(false)}
                  style={{ padding:'8px 16px', borderRadius:8, border:'1.5px solid #e2e8f0', background:'#fff', fontSize:12.5, fontWeight:600, color:'#64748b', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                  Fermer
                </button>
                <button
                  onClick={confirmSelection}
                  disabled={selected.length === 0}
                  style={{
                    padding:'8px 18px', borderRadius:8, border:'none',
                    background: selected.length === 0 ? '#e2e8f0' : C.navy,
                    color: selected.length === 0 ? '#94a3b8' : '#fff',
                    fontSize:12.5, fontWeight:700, cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
                    fontFamily:"'DM Sans',sans-serif", transition:'background .15s',
                  }}>
                  Confirmer {selected.length > 0 ? `(${selected.length})` : ''}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Retour + boutons topbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <button onClick={onBack} style={{ background:'none', border:'1.5px solid #cbd5e1', borderRadius:8, padding:'7px 14px', cursor:'pointer', fontSize:12.5, fontWeight:600, color:'#64748b', display:'flex', alignItems:'center', gap:6, fontFamily:"'DM Sans',sans-serif" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Retour
        </button>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {methodeLocked && !isN2 && !showActions && (
            <button onClick={()=>setShowPopup(true)} style={{ padding:'7px 14px', background:'transparent', border:`1.5px solid ${C.border2}`, borderRadius:25, fontSize:12, fontWeight:600, cursor:'pointer', color:C.text3, fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:6 }}>
              {methode==='5why'?'Arbre De Causes':'Quick Kaizen'}
              <span style={{ fontSize:10, color:C.text4 }}>· changer</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Fiche RCA — Header redesigné ── */}
      <div style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:14, marginBottom:14, overflow:'hidden', boxShadow:'0 2px 12px rgba(15,30,53,.07)', borderTop:'2px solid #e2e8f0' }}>

        <div style={{ padding:'8px 16px', display:'flex', alignItems:'center', gap:0, borderBottom:'1px solid #f1f5f9' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:16, color:C.navy, letterSpacing:'-0.3px' }}>
              {session.equipId || session.id}
            </div>
          </div>
          <div style={{ width:1, height:24, background:'#e2e8f0', margin:'0 14px', flexShrink:0 }} />
          <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.8px', textTransform:'uppercase', padding:'4px 11px', borderRadius:20, whiteSpace:'nowrap', background: '#f1f5f9', color: '#64748b', border: '1.5px solid #e2e8f0' }}>
              {isN2 ? 'Niveau 2' : 'Niveau 1'}
            </span>
            {methode && (
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.8px', textTransform:'uppercase', padding:'4px 11px', borderRadius:20, whiteSpace:'nowrap', background: '#eef2f9', color: '#1a3a6b', border: '1.5px solid #c7d4eb' }}>
                {methode === '5why' ? 'Arbre De Causes' : 'Quick Kaizen'}
              </span>
            )}
          </div>
          <div style={{ width:1, height:24, background:'#e2e8f0', margin:'0 14px', flexShrink:0 }} />
          <div style={{ display:'flex', alignItems:'center', gap:16, flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span style={{ fontSize:12.5, color:'#475569', fontWeight:500 }}>{new Date(session.dateOuverture).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span style={{ fontSize:12.5, color:'#475569', fontWeight:500 }}>{session.responsable}</span>
            </div>
            {session.id && (
              <div style={{ display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
                <span style={{ fontSize:11, color:'#94a3b8', fontFamily:"'JetBrains Mono',monospace" }}>{session.id}</span>
              </div>
            )}
          </div>
          <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 13px', borderRadius:20, fontSize:11.5, fontWeight:700, background:sc.bg, color:sc.color, border:`1.5px solid ${sc.border}` }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:sc.dot, display:'inline-block',
                boxShadow: session.statut==='en-cours' ? `0 0 0 3px ${sc.dot}33` : 'none',
                animation: session.statut==='en-cours' ? 'pulse 2s infinite' : 'none'
              }} />
              {sc.label}
            </span>
            {showActions && session.statut !== 'cloturee' && (
              <button onClick={handleCloturer} style={{ background:'#059669', color:'#fff', border:'none', borderRadius:20, padding:'5px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Clôturer la RCA
              </button>
            )}
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 16px', background:'#f8fafc', borderTop:'1px solid #f1f5f9' }}>
          {[
            session.dateHeureDebut ? {
              icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
              label: 'DÉBUT RCA',
              value: (() => { const d = new Date(session.dateHeureDebut); return `${d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })} ${d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}` })(),
            } : null,
            session.statut === 'cloturee' && session.dateHeureFin ? {
              icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 14 11 16 15 12"/></svg>,
              label: 'FIN RCA',
              value: (() => { const d = new Date(session.dateHeureFin); return `${d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' })} ${d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}` })(),
            } : null,
            { icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: 'CUMUL ARRÊT', value: session.cumulArret != null ? `${session.cumulArret} h` : '—' },
            { icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>, label: 'FRÉQUENCE', value: session.frequence != null ? `${session.frequence} /mois` : '—' },
            { icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>, label: 'DURÉE ANALYSE', value: formatDuree(chronoDisplay), live: session.statut !== 'cloturee' },
          ].filter(Boolean).map(({ icon, label, value, live }) => (
            <div key={label} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, background: live && chronoDisplay > 0 ? '#eff6ff' : '#f1f5f9', border:`1px solid ${live && chronoDisplay > 0 ? '#bfdbfe' : '#e2e8f0'}` }}>
              <span style={{ color: live && chronoDisplay > 0 ? '#3b82f6' : '#94a3b8', display:'flex', alignItems:'center' }}>{icon}</span>
              <span style={{ fontSize:9.5, fontWeight:700, color: live && chronoDisplay > 0 ? '#3b82f6' : '#94a3b8', textTransform:'uppercase', letterSpacing:'.7px' }}>{label}</span>
              <span style={{ fontSize:12, fontWeight:700, color: live && chronoDisplay > 0 ? '#1d4ed8' : '#64748b', fontFamily:"'Sora',sans-serif" }}>{value}</span>
              {live && chronoDisplay > 0 && <span style={{ width:5, height:5, borderRadius:'50%', background:'#3b82f6', display:'inline-block', animation:'pulse 2s infinite' }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Analyse */}
      {methodeLocked && (
        <div style={{ display:'grid', gridTemplateColumns: showActions ? '1fr' : '1fr 340px', gap:16, alignItems:'start' }}>

          <div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13.5, fontWeight:600, color: C.blue2, borderBottom:`2px solid ${C.blue2}`, display:'inline-block', paddingBottom:8 }}>
                Analyse
              </div>
            </div>

            {!showActions && methode === '5why' && (
              <FiveWhyTree noeuds={noeuds} phenomene={session.phenomene} onChange={handleNoeudsChange} />
            )}

            {!showActions && methode === 'kaizen' && (
              <QuickKaizenWheel
                noeuds={noeuds}
                phenomene={session.phenomene}
                onChange={handleNoeudsChange}
                onGenererActions={handleKaizenGenererActions}
              />
            )}

            {!showActions && methode === '5why' && (
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20 }}>
                <button onClick={handleValider} style={{ background:C.navy, color:'#fff', border:'none', borderRadius:10, padding:'10px 22px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:8, boxShadow:'0 2px 8px rgba(26,58,107,.3)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Valider l'analyse
                </button>
              </div>
            )}

            {showActions && (
              <>
                <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'10px 16px', marginBottom:20, fontSize:12.5, color:C.text3, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span>
                    <strong style={{ color:C.text }}>Analyse {methode === '5why' ? 'Arbre De Causes' : 'Quick Kaizen'} validée</strong>
                  </span>
                  <button onClick={()=>setShowAct(false)} style={{ fontSize:11.5, color:C.blue2, fontWeight:600, background:'none', border:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    ↩ Modifier l'analyse
                  </button>
                </div>

                {/* 🔥 PLAN D'ACTIONS CORRECTIVES EN PREMIER */}
                <ActionsTable
                  actions={actions}
                  onChange={handleActionChange}
                  participants={participantsData}
                  onAddParticipant={(p) => setParticipantsData(prev => [...prev, p])}
                />

              </>
            )}
          </div>

          {/* Agent IA */}
          {!showActions && (
            <div style={{ position:'sticky', top:80 }}>
              <AgentIA session={session} methode={methode} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}