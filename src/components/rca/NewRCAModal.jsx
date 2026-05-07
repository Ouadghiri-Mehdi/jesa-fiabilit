// src/components/rca/NewRCAModal.jsx
// Nouvelle RCA — UNE SEULE PAGE : infos + choix méthode (sans étape participants)
// fromTUM=true  → popup direct choix méthode uniquement
// fromTUM=false → formulaire infos + choix méthode sur même page

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import C from '../../tokens/colors'
import { EQUIPMENT_LIST } from '../../data/equipements'
import { POSTES_TECHNIQUES } from '../../data/postes_techniques'

const sInput = {
  width: '100%', padding: '9px 13px', background: '#fff',
  border: `1.5px solid ${C.border2}`, borderRadius: 8,
  color: C.text, fontSize: 13,
  fontFamily: "'DM Sans',sans-serif", outline: 'none', boxSizing: 'border-box',
}
const sLabel = { display: 'block', fontSize: 11.5, fontWeight: 600, color: C.text3, marginBottom: 6 }

// Zones CA synchronisées depuis la plateforme
const ZONES_CA = ['PAP', 'DAP', 'CAP']

const TYPE_ICONS = {
  equipement: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
    </svg>
  ),
  hse: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  qualite: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/>
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  ),
  amelioration: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
}

const TYPES = [
  { key: 'equipement',   label: 'TUM',            desc: 'Panne ou défaillance machine' },
  { key: 'hse',          label: 'HSE / Sécurité', desc: 'Incident sécurité ou environnement' },
  { key: 'qualite',      label: 'Qualité',         desc: 'Non-conformité produit ou process' },
  { key: 'amelioration', label: 'Amélioration',    desc: 'Démarche proactive' },
]

let rcaCounter = 20

// ─── Popup Attention ────────────────────────────────────────────────────────
function AttentionPopup({ missingFields, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: 420, maxWidth: '95vw',
        boxShadow: '0 24px 64px rgba(0,0,0,.3)', overflow: 'hidden', animation: 'fadeUp .18s ease',
      }}>
        {/* Header rouge */}
        <div style={{ background: '#dc2626', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: '#fff' }}>
            Attention — Champs obligatoires
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 13, color: C.text, marginBottom: 14, lineHeight: 1.6 }}>
            Veuillez remplir les champs suivants avant de choisir la méthode d'analyse :
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {missingFields.map((f, i) => (
              <li key={i} style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>• {f}</li>
            ))}
          </ul>
        </div>
        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 24px', background: C.navy, color: '#fff', border: 'none',
            borderRadius: 25, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'DM Sans',sans-serif",
          }}>
            Compris — Je complète
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ChoixMethodePopup (from TUM) ────────────────────────────────────────────
export function ChoixMethodePopup({ session, onChoisir, onClose }) {
  const isN2 = session.niveau === 2 || session.statut === 'alert'
  const isWatch = !isN2 && session.statut === 'watch'

  const getInfoLabel = () => {
    if (isN2) {
      if (session.statut === 'alert' && session.niveau !== 2)
        return '⚠️ Seuil N2 atteint (fréquence ou cumul) — Arbre De Causes obligatoire.'
      return '⚠️ Niveau N2 — La méthode Arbre De Causes est obligatoire pour ce niveau.'
    }
    if (isWatch) return '💡 Niveau N1 — Quick Kaizen recommandé pour ce seuil.'
    return '💡 Niveau N1 — Vous pouvez choisir librement entre les deux méthodes.'
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 16, width: 500, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden', animation: 'fadeUp .2s ease' }}>
        <div style={{ background: C.navy, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 15, color: '#fff' }}>Choix de méthode d'analyse</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>
              {session.equipId ? `⚙️ ${session.equipId}` : '📋 RCA'}{session.phenomene ? ` — ${session.phenomene.slice(0, 45)}…` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13, background: isN2 ? '#fef2f2' : '#eff6ff', border: `1px solid ${isN2 ? '#fecaca' : '#bfdbfe'}`, color: isN2 ? C.red : C.navy }}>
            {getInfoLabel()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div onClick={() => !isN2 && onChoisir('kaizen')} style={{ padding: 20, borderRadius: 12, position: 'relative', border: `2px solid ${isN2 ? C.border : C.blue2}`, background: isN2 ? C.bg : '#fff', opacity: isN2 ? 0.4 : 1, cursor: isN2 ? 'not-allowed' : 'pointer', transition: 'all .15s' }}
              onMouseOver={e => { if (!isN2) { e.currentTarget.style.background = C.bluePale; e.currentTarget.style.transform = 'translateY(-2px)' }}}
              onMouseOut={e => { if (!isN2) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'none' }}}>
              {!isN2 && <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700, background: C.bluePale, color: C.navy, padding: '2px 8px', borderRadius: 10 }}>{isWatch ? 'Imposé N1' : 'Suggéré N1'}</div>}
              <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 10, background: "#fff7ed", border: "1.5px solid #fed7aa" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 5 }}>Quick Kaizen</div>
              <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6 }}>Analyse rapide structurée.<br/>Résolution directe pour problèmes simples.</div>
              {isN2 && <div style={{ marginTop: 10, fontSize: 11, color: C.red, fontWeight: 600 }}>🚫 Non disponible en N2</div>}
            </div>
            <div onClick={() => onChoisir('5why')} style={{ padding: 20, borderRadius: 12, position: 'relative', border: `2px solid ${isN2 ? C.red : C.blue2}`, background: isN2 ? '#fef2f2' : '#fff', cursor: 'pointer', transition: 'all .15s' }}
              onMouseOver={e => { e.currentTarget.style.background = isN2 ? '#fef2f2' : C.bluePale; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseOut={e => { e.currentTarget.style.background = isN2 ? '#fef2f2' : '#fff'; e.currentTarget.style.transform = 'none' }}>
              {isN2 && <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700, background: '#fef2f2', color: C.red, padding: '2px 8px', borderRadius: 10, border: '1px solid #fecaca' }}>✦ Obligatoire N2</div>}
              {!isN2 && <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 9, fontWeight: 700, background: C.bluePale, color: C.navy, padding: '2px 8px', borderRadius: 10 }}>Disponible N1</div>}
              <div style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 10, background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="4" rx="1"/><rect x="2" y="18" width="6" height="4" rx="1"/><rect x="16" y="18" width="6" height="4" rx="1"/>
                  <line x1="12" y1="6" x2="12" y2="11"/><line x1="12" y1="11" x2="5" y2="18"/><line x1="12" y1="11" x2="19" y2="18"/>
                </svg>
              </div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 5 }}>Arbre De Causes</div>
              <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6 }}>Arbre des causes horizontal.<br/>Analyse approfondie multi-niveaux.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Modal ──────────────────────────────────────────────────────────────
export default function NewRCAModal({ defaultEquipId, defaultNiveau, defaultStatut, fromTUM, onClose, onCreate }) {
  const today = new Date().toISOString().slice(0, 10)
  const navigate = useNavigate()

  const [type, setType]                         = useState(defaultEquipId ? 'equipement' : null)
  const [posteTechnique, setPosteTechnique]     = useState(defaultEquipId || '')
  const [posteSearch, setPosteSearch]           = useState(defaultEquipId || '')
  const [showPosteDropdown, setShowPosteDropdown] = useState(false)
  const [designation, setDesignation]           = useState('')
  const [niveauEqSeq, setNiveauEqSeq]           = useState('—')
  const [zone, setZone]                         = useState('PAP')
  const [dateDebut, setDateDebut]               = useState('')
  const [causeArret, setCauseArret]             = useState('')
  const [description, setDescription]           = useState('')
  const [niveau, setNiveau]                     = useState(defaultNiveau || (defaultEquipId ? 2 : null))
  const [methode, setMethode]                   = useState(null)
  const [errors, setErrors]                     = useState({})
  const [attentionPopup, setAttentionPopup]     = useState(null)

  const isN2 = niveau === 2 || defaultStatut === 'alert'
  const isWatch = !isN2 && defaultStatut === 'watch'
  const methodeEffective = isN2 ? '5why' : methode

  // Poste technique: filtered list from search input
  const posteFiltered = POSTES_TECHNIQUES.filter(p =>
    p.id.toLowerCase().includes(posteSearch.toLowerCase()) ||
    p.designation.toLowerCase().includes(posteSearch.toLowerCase())
  ).slice(0, 8)

  // When poste technique is selected from dropdown, auto-fill designation + niveau
  const handlePosteSelect = (p) => {
    setPosteTechnique(p.id)
    setPosteSearch(p.id)
    setDesignation(p.designation || '')
    setNiveauEqSeq(p.eqSeq || '—')
    setShowPosteDropdown(false)
  }

  const handlePosteInput = (val) => {
    setPosteSearch(val)
    setPosteTechnique(val)
    setShowPosteDropdown(true)
    // If exact match, auto-fill
    const found = POSTES_TECHNIQUES.find(p => p.id === val)
    if (found) { setDesignation(found.designation || ''); setNiveauEqSeq(found.eqSeq || '—') }
    else { setDesignation(''); setNiveauEqSeq('—') }
  }

  // Check required fields before allowing method selection
  const getMissingFields = () => {
    const missing = []
    if (!type) missing.push('Type de RCA')
    if (!posteTechnique.trim()) missing.push('Poste technique')
    if (!dateDebut) missing.push('Date début arrêt')
    if (!causeArret.trim()) missing.push("Cause d'arrêt")
    return missing
  }

  const handleMethodeClick = (m) => {
    if (isN2 && m === 'kaizen') return
    const missing = getMissingFields()
    if (missing.length > 0) {
      setAttentionPopup(missing)
      return
    }
    setMethode(m)
  }

  const validate = () => {
    const e = {}
    if (!type) e.type = 'Choisissez un type'
    if (!posteTechnique.trim()) e.posteTechnique = 'Poste technique requis'
    if (!methodeEffective) e.methode = "Choisissez une méthode d'analyse"
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleCreate = () => {
    if (!validate()) return
    rcaCounter++
    onCreate({
      id: `RCA-2026-0${rcaCounter}`,
      equipId: posteTechnique || null,
      designation, dateOuverture: dateDebut || today,
      dateDebut, causeArret,
      niveau: type === 'equipement' ? (isN2 ? 2 : niveau) : null,
      source: 'Manuel', type, zone,
      participants: [], statut: 'en-cours', methode: methodeEffective,
      phenomene: description, noeuds: [], actionsGenerees: [],
    })
  }

  const handleSelectType = (key) => {
    if (key === 'equipement') { onClose(); navigate('/tum') }
    else setType(key)
  }

  if (fromTUM) {
    const session = { equipId: defaultEquipId, niveau: defaultNiveau || 2, statut: defaultStatut || 'alert', phenomene: '' }
    return (
      <ChoixMethodePopup session={session}
        onChoisir={(m) => { rcaCounter++; onCreate({ id: `RCA-2026-0${rcaCounter}`, equipId: defaultEquipId, dateOuverture: today, niveau: defaultNiveau || 2, source: 'TUM', type: 'equipement', responsable: '', participants: [], statut: 'en-cours', methode: m, phenomene: '', noeuds: [], actionsGenerees: [] }) }}
        onClose={onClose}
      />
    )
  }

  return (
    <>
      {/* Attention popup */}
      {attentionPopup && (
        <AttentionPopup
          missingFields={attentionPopup}
          onClose={() => setAttentionPopup(null)}
        />
      )}

      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        onClick={e => e.target === e.currentTarget && onClose()}>
        <div style={{ background: '#fff', borderRadius: 12, width: 860, maxWidth: '96vw', maxHeight: '94vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', animation: 'fadeUp .2s ease' }}>

          {/* Header */}
          <div style={{ background: C.navy, padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff', fontFamily: "'Sora',sans-serif", display: "inline-flex", alignItems: "center", gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nouvelle session RCA
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>

          {/* Body */}
          <div style={{ padding: 22, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* ── Type RCA ─────────────────────────────────────────── */}
            <div>
              <label style={sLabel}>Type de RCA <span style={{ color: C.red }}>*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {TYPES.map(t => (
                  <div key={t.key} onClick={() => handleSelectType(t.key)} style={{ padding: '9px 14px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${type === t.key ? C.navy : C.border}`, background: type === t.key ? C.bluePale : '#fff', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flexShrink: 0, color: type === t.key ? C.navy : C.text3 }}>{TYPE_ICONS[t.key]}</span>
                    <div>
                      {/* TUM label — NO badge, no arrow */}
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: type === t.key ? C.navy : C.text }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: 10.5, color: C.text4 }}>{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              {errors.type && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>⚠ {errors.type}</div>}
            </div>

            {/* ── Form fields (visible when type selected) ────────── */}
            {type && (
              <>
                {/* Separator — NO "SAISIE MANUELLE" badge */}
                <div style={{ borderTop: `1.5px solid ${C.border}` }} />

                {/* Poste technique (combo: saisie libre + dropdown) + Désignation (auto) + Niveau EQ/SEQ (auto) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 120px', gap: 12 }}>
                  {/* Poste technique — combo saisie + liste */}
                  <div style={{ position: 'relative' }}>
                    <label style={sLabel}>Poste technique</label>
                    <input
                      style={{ ...sInput, ...(errors.posteTechnique ? { borderColor: C.red } : {}) }}
                      value={posteSearch}
                      onChange={e => handlePosteInput(e.target.value)}
                      onFocus={() => setShowPosteDropdown(true)}
                      onBlur={() => setTimeout(() => setShowPosteDropdown(false), 150)}
                      placeholder="Saisir ou rechercher…"
                      autoComplete="off"
                    />
                    {errors.posteTechnique && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>⚠ {errors.posteTechnique}</div>}
                    {showPosteDropdown && posteFiltered.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: `1px solid ${C.border2}`, borderRadius: 8, zIndex: 30, boxShadow: '0 6px 20px rgba(0,0,0,.14)', maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
                        {posteFiltered.map(p => (
                          <div key={p.id} onMouseDown={() => handlePosteSelect(p)}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}
                            onMouseOver={ev => ev.currentTarget.style.background = C.bluePale}
                            onMouseOut={ev => ev.currentTarget.style.background = ''}>
                            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: C.navy }}>{p.id}</div>
                            <div style={{ fontSize: 11, color: C.text3, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.designation}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Désignation — auto-filled, read-only */}
                  <div>
                    <label style={sLabel}>Désignation du poste technique</label>
                    <input
                      style={{ ...sInput, background: '#f8fafc', color: C.text3 }}
                      value={designation}
                      readOnly
                      placeholder="— auto-rempli —"
                    />
                  </div>

                  {/* Niveau EQ/SEQ — auto-filled */}
                  <div>
                    <label style={sLabel}>Niveau EQ/SEQ</label>
                    <input
                      style={{ ...sInput, background: '#f8fafc', color: C.text3 }}
                      value={niveauEqSeq}
                      readOnly
                    />
                  </div>
                </div>

                {/* Zone CA + Date début arrêt uniquement */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={sLabel}>Zone géographique</label>
                    <select style={{ ...sInput, cursor: 'pointer' }} value={zone} onChange={e => setZone(e.target.value)}>
                      {ZONES_CA.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={sLabel}>Date</label>
                    <input type="date" style={sInput} value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
                  </div>
                </div>

                {/* Cause d'arrêt — champ texte libre */}
                <div>
                  <label style={sLabel}>Cause d'arrêt</label>
                  <input
                    style={sInput}
                    value={causeArret}
                    onChange={e => setCauseArret(e.target.value)}
                    placeholder="Décrire la cause de l'arrêt…"
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={sLabel}>Description <span style={{ float: 'right', fontSize: 10, fontWeight: 400, color: C.text4 }}>{description.length} / 500</span></label>
                  <textarea style={{ ...sInput, minHeight: 72, resize: 'vertical' }}
                    value={description} onChange={e => setDescription(e.target.value.slice(0, 500))}
                    placeholder="Détails supplémentaires, contexte de la panne, observations terrain…" />
                </div>
              </>
            )}

            {/* ── Choix de méthode d'analyse ──────────────────────── */}
            {type && (
              <div>
                <label style={{ ...sLabel, fontSize: 12.5, color: C.text }}>
                  Choix de méthode d'analyse <span style={{ color: C.red }}>*</span>
                </label>
                {isN2 && (
                  <div style={{ padding: '9px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12.5, color: C.red, fontWeight: 600, marginBottom: 10 }}>
                    {defaultStatut === 'alert' && niveau !== 2 ? '⚠️ Seuil N2 atteint — Arbre De Causes imposé automatiquement' : '⚠️ Niveau N2 — Arbre De Causes imposé automatiquement'}
                  </div>
                )}
                {isWatch && !isN2 && (
                  <div style={{ padding: '9px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12.5, color: C.navy, fontWeight: 600, marginBottom: 10 }}>
                    💡 Seuil N1 atteint — Quick Kaizen recommandé
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {/* Quick Kaizen */}
                  <div
                    onClick={() => handleMethodeClick('kaizen')}
                    style={{ padding: '14px 16px', borderRadius: 10, cursor: isN2 ? 'not-allowed' : 'pointer', border: `2px solid ${methodeEffective === 'kaizen' ? C.blue2 : C.border}`, background: methodeEffective === 'kaizen' ? C.bluePale : isN2 ? C.bg : '#fff', opacity: isN2 ? 0.4 : 1, transition: 'all .15s', display: 'flex', gap: 12, alignItems: 'flex-start' }}
                    onMouseOver={e => { if (!isN2) e.currentTarget.style.borderColor = C.blue2 }}
                    onMouseOut={e => { if (!isN2 && methodeEffective !== 'kaizen') e.currentTarget.style.borderColor = C.border }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: methodeEffective === 'kaizen' ? C.navy : C.text, marginBottom: 3 }}>Quick Kaizen</div>
                      <div style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.5 }}>Analyse rapide structurée · Problèmes simples N1</div>
                      {isN2 && <div style={{ fontSize: 11, color: C.red, marginTop: 4, fontWeight: 600 }}>🚫 Non disponible en N2</div>}
                    </div>
                    {methodeEffective === 'kaizen' && (
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </div>

                  {/* Arbre De Causes */}
                  <div
                    onClick={() => handleMethodeClick('5why')}
                    style={{ padding: '14px 16px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${methodeEffective === '5why' ? (isN2 ? C.red : C.blue2) : C.border}`, background: methodeEffective === '5why' ? (isN2 ? '#fef2f2' : C.bluePale) : '#fff', transition: 'all .15s', display: 'flex', gap: 12, alignItems: 'flex-start' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = isN2 ? C.red : C.blue2 }}
                    onMouseOut={e => { if (methodeEffective !== '5why') e.currentTarget.style.borderColor = C.border }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: methodeEffective === '5why' ? (isN2 ? C.red : C.navy) : C.text, marginBottom: 3 }}>Arbre De Causes</div>
                      <div style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.5 }}>Arbre des causes horizontal · Analyse approfondie</div>
                      {isN2 && <div style={{ fontSize: 11, color: C.red, marginTop: 4, fontWeight: 600 }}>✦ Obligatoire N2</div>}
                    </div>
                    {methodeEffective === '5why' && (
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: isN2 ? C.red : C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </div>
                </div>
                {errors.methode && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>⚠ {errors.methode}</div>}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0, background: C.bg }}>
            <button onClick={onClose} style={{ padding: '8px 18px', background: 'transparent', border: `1.5px solid ${C.border2}`, borderRadius: 25, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", color: C.text3 }}>Annuler</button>
            <button onClick={handleCreate} style={{ padding: '8px 24px', background: C.navy, color: '#fff', border: 'none', borderRadius: 25, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Créer et lancer l'analyse
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
