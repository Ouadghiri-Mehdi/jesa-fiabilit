// src/components/rca/ActionsTable.jsx

import { useState, useRef, useEffect } from 'react'
import C from '../../tokens/colors'
import { api } from '../../lib/api'

const STATUT_ACTION = {
  'pas-commence': { label: 'Non commencé', bg: C.redBg,    color: C.red,    border: C.redB,    dot: C.red },
  'en-cours':     { label: 'En cours',     bg: C.orangeBg, color: C.orange, border: C.orangeB, dot: C.orange },
  'cloture':      { label: 'Clôturé',      bg: C.greenBg,  color: C.green,  border: C.greenB,  dot: C.green },
  'retard':       { label: 'En retard',    bg: '#fff7ed',  color: '#ea580c', border: '#fed7aa',  dot: '#ea580c' },
}

const AVATAR_COLORS = ['#1a3a6b','#059669','#d97706','#7c3aed','#0891b2','#dc2626','#0f766e','#b45309']

function genOT() {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
  return `OT-${ymd}-${Math.floor(Math.random()*900+100)}`
}

function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0] || '').join('').slice(0,2).toUpperCase() || '?'
}

// ── Picker participant inline — dropdown position:fixed pour éviter le clip ──
function ParticipantPicker({ participants = [], value, onSelect, avatarColor, onAddParticipant }) {
  const [open, setOpen]         = useState(false)
  const [pos,  setPos]          = useState({ top: 0, left: 0, width: 0 })
  const [showForm, setShowForm] = useState(false)
  const [newNom, setNewNom]     = useState('')
  const [newFonc, setNewFonc]   = useState('')
  const btnRef = useRef(null)
  const dropRef = useRef(null)

  const displayName = value || ''

  function openDropdown() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const listH = participants.length === 0 ? 80 : Math.min(220, participants.length * 54)
    const dropH = listH + 80 // account for footer buttons
    const top = spaceBelow >= dropH ? r.bottom + 4 : r.top - dropH - 4
    setPos({ top, left: r.left, width: Math.max(r.width, 260) })
    setShowForm(false)
    setNewNom('')
    setNewFonc('')
    setOpen(true)
  }

  function handleAdd() {
    const nom = newNom.trim()
    if (!nom) return
    const person = { id: `manual-${Date.now()}`, nom, fonction: newFonc.trim() }
    onAddParticipant && onAddParticipant(person)
    onSelect(nom)
    setOpen(false)
    setShowForm(false)
    setNewNom('')
    setNewFonc('')
  }

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) { setOpen(false); setShowForm(false) }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', () => { setOpen(false); setShowForm(false) }, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', () => { setOpen(false); setShowForm(false) }, true)
    }
  }, [open])

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={() => open ? setOpen(false) : openDropdown()}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 8,
          border: open ? '1.5px solid #1a3a6b' : '1.5px solid #e2e8f0',
          background: open ? '#f0f6ff' : '#fff',
          cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.borderColor = '#c7d4eb' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.borderColor = open ? '#1a3a6b' : '#e2e8f0' }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: displayName ? avatarColor : '#e2e8f0',
          color: displayName ? '#fff' : '#94a3b8',
          fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {displayName ? initials(displayName) : '?'}
        </div>
        <span style={{ fontSize: 12.5, color: displayName ? '#0f172a' : '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName || 'Choisir un participant…'}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: pos.top, left: pos.left, width: pos.width,
            zIndex: 9999,
            background: '#fff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(15,30,53,.18)',
            overflow: 'hidden',
          }}
        >
          {/* Liste des participants */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {participants.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#475569', marginBottom: 2 }}>Aucun participant sélectionné</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>Ajoutez une personne ci-dessous.</div>
              </div>
            ) : (
              participants.map((p, i) => {
                const nom = p.nom || (typeof p === 'string' ? p : '?')
                const isSelected = nom === displayName
                const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
                return (
                  <div
                    key={i}
                    onClick={() => { onSelect(isSelected ? '' : nom); setOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : '#fff',
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = isSelected ? '#dbeafe' : '#f8fafc' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#eff6ff' : '#fff' }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: col, color: '#fff', fontSize: 11, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {initials(nom)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</div>
                      {p.fonction && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{p.fonction}</div>}
                    </div>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Retirer */}
          {displayName && (
            <div
              onClick={() => { onSelect(''); setOpen(false) }}
              style={{
                padding: '8px 12px', borderTop: '1px solid #f1f5f9',
                fontSize: 12, color: '#dc2626', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Retirer le participant
            </div>
          )}

          {/* Ajouter une nouvelle personne */}
          <div style={{ borderTop: '1.5px solid #e2e8f0' }}>
            {!showForm ? (
              <div
                onClick={() => setShowForm(true)}
                style={{
                  padding: '9px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontSize: 12, fontWeight: 600, color: '#1a3a6b',
                  background: '#f8faff',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#eef2f9' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8faff' }}
              >
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#dbeafe', border: '1.5px solid #93c5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#1a3a6b', flexShrink: 0 }}>+</span>
                Ajouter une nouvelle personne
              </div>
            ) : (
              <div style={{ padding: '10px 12px', background: '#f8faff' }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1a3a6b', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8 }}>
                  Nouvelle personne
                </div>
                <input
                  autoFocus
                  value={newNom}
                  onChange={e => setNewNom(e.target.value)}
                  placeholder="Nom complet *"
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowForm(false) }}
                  style={{ width: '100%', padding: '6px 9px', fontSize: 12.5, borderRadius: 6, border: '1.5px solid #c7d4eb', outline: 'none', marginBottom: 6, boxSizing: 'border-box', fontFamily: "'DM Sans',sans-serif" }}
                  onFocus={e => { e.target.style.borderColor = '#1a3a6b' }}
                  onBlur={e => { e.target.style.borderColor = '#c7d4eb' }}
                />
                <input
                  value={newFonc}
                  onChange={e => setNewFonc(e.target.value)}
                  placeholder="Rôle / Fonction (optionnel)"
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowForm(false) }}
                  style={{ width: '100%', padding: '6px 9px', fontSize: 12.5, borderRadius: 6, border: '1.5px solid #c7d4eb', outline: 'none', marginBottom: 8, boxSizing: 'border-box', fontFamily: "'DM Sans',sans-serif" }}
                  onFocus={e => { e.target.style.borderColor = '#1a3a6b' }}
                  onBlur={e => { e.target.style.borderColor = '#c7d4eb' }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={handleAdd}
                    disabled={!newNom.trim()}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: newNom.trim() ? '#1a3a6b' : '#e2e8f0',
                      color: newNom.trim() ? '#fff' : '#94a3b8',
                      border: 'none', cursor: newNom.trim() ? 'pointer' : 'default',
                      transition: 'all .15s',
                    }}
                  >
                    Ajouter
                  </button>
                  <button
                    onClick={() => { setShowForm(false); setNewNom(''); setNewFonc('') }}
                    style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#fff', color: '#64748b', border: '1.5px solid #e2e8f0', cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Composant principal ──────────────────────────────────────────────────────
export default function ActionsTable({ actions, onChange, participants = [], onAddParticipant, rcaStartDate }) {
  const [rows, setRows] = useState(() => actions.map(r => ({ ...r })))
  const [showPartPicker, setShowPartPicker] = useState(false)
  const [allParticipants, setAllParticipants] = useState([])
  const partBtnRef = useRef(null)
  const partDropRef = useRef(null)

  useEffect(() => {
    api.getParticipants()
      .then(list => setAllParticipants(list.map(p => ({ id: String(p.id), nom: p.nom, fonction: p.fonction || '' }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!showPartPicker) return
    const close = (e) => {
      if (partDropRef.current && !partDropRef.current.contains(e.target) &&
          partBtnRef.current && !partBtnRef.current.contains(e.target))
        setShowPartPicker(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showPartPicker])

  const unselectedParticipants = allParticipants.filter(p => {
    const nom = p.nom || (typeof p === 'string' ? p : '')
    return !participants.some(existing => (existing.nom || existing) === nom)
  })

  const update = (id, patch) => {
    const next = rows.map(r => r.id === id ? { ...r, ...patch } : r)
    setRows(next); onChange(next)
  }

  const addRow = () => {
    const r = { id: `act-${Date.now()}`, cause: '', action: '', ot: '', responsable: '', delai: '', statut: 'pas-commence' }
    const next = [...rows, r]
    setRows(next); onChange(next)
  }

  const removeRow = (id) => {
    const next = rows.filter(r => r.id !== id)
    setRows(next); onChange(next)
  }

  const rcaDay = rcaStartDate ? rcaStartDate.slice(0, 10) : null
  const isDelaiDepasse = (row) => {
    if (row.statut === 'cloture' || !row.delai) return false
    // Compare the deadline date to today's local date (YYYY-MM-DD)
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return row.delai < today
  }
  const counts = {
    total:      rows.length,
    notStarted: rows.filter(r => r.statut === 'pas-commence').length,
    inProgress: rows.filter(r => r.statut === 'en-cours').length,
    done:       rows.filter(r => r.statut === 'cloture').length,
    retard:     rows.filter(r => r.statut === 'retard' || isDelaiDepasse(r)).length,
  }

  const BADGES = [
    { label: 'Total',        val: counts.total,      color: '#1a3a6b', bg: '#eff6ff', bd: '#bfdbfe' },
    { label: 'Non commencé', val: counts.notStarted, color: '#dc2626', bg: '#fef2f2', bd: '#fecaca' },
    { label: 'En cours',     val: counts.inProgress, color: '#d97706', bg: '#fffbeb', bd: '#fde68a' },
    { label: 'Clôturé',      val: counts.done,       color: '#059669', bg: '#ecfdf5', bd: '#a7f3d0' },
    { label: 'En retard',    val: counts.retard,     color: '#ea580c', bg: '#fff7ed', bd: '#fed7aa' },
  ]

  return (
    <div style={{ marginBottom: 24 }}>

      {/* ── En-tête ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:7, background:'#eef2f9', border:'1.5px solid #c7d4eb' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a3a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
              <line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
          </span>
          Plan d'actions
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
          Issu des causes racines validées ✦
        </div>
      </div>

      {/* ── Compteurs + bouton ajouter participant ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {BADGES.map(b => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 20, background: b.bg, border: `1px solid ${b.bd}` }}>
              <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 15, color: b.color }}>{b.val}</span>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{b.label}</span>
            </div>
          ))}
        </div>

        {/* Bouton ajouter participant */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              ref={partBtnRef}
              onClick={() => setShowPartPicker(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8,
                border: '1.5px solid #cbd5e1',
                background: showPartPicker ? '#cbd5e1' : '#e2e8f0',
                color: '#475569',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif", transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="16" y1="11" x2="22" y2="11"/>
              </svg>
              Ajouter participant
              {unselectedParticipants.length > 0 && (
                <span style={{ background: '#cbd5e1', color: '#475569', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
                  {unselectedParticipants.length}
                </span>
              )}
            </button>

            {showPartPicker && (
              <div
                ref={partDropRef}
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  minWidth: 260, zIndex: 999,
                  background: '#fff', border: '1.5px solid #e2e8f0',
                  borderRadius: 10, boxShadow: '0 12px 32px rgba(15,30,53,.18)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '10px 14px 8px', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.6px', borderBottom: '1px solid #f1f5f9' }}>
                  Tous les participants
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                  {/* Non ajoutés en premier */}
                  {unselectedParticipants.length > 0 && (
                    <div style={{ padding: '6px 14px 4px', fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '.5px', background: '#f0fdf4' }}>
                      À ajouter
                    </div>
                  )}
                  {unselectedParticipants.map((p, i) => {
                    const nom = p.nom || p
                    const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
                    return (
                      <div
                        key={`new-${i}`}
                        onClick={() => { onAddParticipant && onAddParticipant(p); setShowPartPicker(false) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9', transition: 'background .1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f0f6ff'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: col, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {initials(nom)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</div>
                          {p.fonction && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{p.fonction}</div>}
                        </div>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </div>
                    )
                  })}
                  {/* Déjà ajoutés — grisés */}
                  {participants.length > 0 && (
                    <div style={{ padding: '6px 14px 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', background: '#f8fafc' }}>
                      Déjà dans la session
                    </div>
                  )}
                  {participants.map((p, i) => {
                    const nom = p.nom || (typeof p === 'string' ? p : '?')
                    const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
                    return (
                      <div
                        key={`existing-${i}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', cursor: 'default',
                          borderBottom: '1px solid #f1f5f9',
                          opacity: 0.45,
                        }}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: '#cbd5e1', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {initials(nom)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</div>
                          {p.fonction && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{p.fonction}</div>}
                        </div>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
      </div>

      {/* ── Tableau ── */}
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '44px 24px', background: '#fafcff', border: '1.5px dashed #e2e8f0', borderRadius: 12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:52, height:52, borderRadius:14, background:'#eef2f9', border:'1.5px solid #c7d4eb', margin:'0 auto 12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a3a6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
              <line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#334155', marginBottom: 6 }}>Aucune cause racine validée</div>
          <div style={{ fontSize: 12.5, color: '#94a3b8' }}>Validez des nœuds feuilles (✓) dans l'arbre pour générer le plan</div>
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: '1.5px solid #e2e8f0', boxShadow: '0 2px 12px rgba(15,30,53,.06)' }}>
          <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 920 }}>

              <colgroup>
                <col style={{ width: 44 }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '23%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: 44 }} />
              </colgroup>

              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Rang','Cause racine','Action corrective','N° OT','Participant','Délai','Statut',''].map((h, i, arr) => (
                    <th key={i} style={{
                      padding: '12px 14px',
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.8px',
                      textTransform: 'uppercase', color: '#64748b',
                      textAlign: i === 0 || i === arr.length - 1 ? 'center' : 'left',
                      borderBottom: '2px solid #e2e8f0',
                      borderRight: i < arr.length - 1 ? '1px solid #e8edf3' : 'none',
                      whiteSpace: 'nowrap',
                      borderRadius: i === 0 ? '10px 0 0 0' : i === arr.length - 1 ? '0 10px 0 0' : 0,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, idx) => {
                  const avatarC  = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                  const isLast   = idx === rows.length - 1
                  const isOverdue = isDelaiDepasse(row)
                  let sc = STATUT_ACTION[row.statut] || STATUT_ACTION['pas-commence']
                  if (isOverdue && row.statut !== 'cloture') sc = STATUT_ACTION['retard']

                  const cell = (extra = {}) => ({
                    padding: '12px 14px',
                    verticalAlign: 'middle',
                    borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                    borderRight: '1px solid #f1f5f9',
                    ...extra,
                  })

                  return (
                    <tr key={row.id}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fbff'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                      style={{ transition: 'background .12s' }}
                    >
                      {/* # */}
                      <td style={cell({ textAlign: 'center', background: '#fafcff' })}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: '#e2e8f0', fontSize: 11, fontWeight: 800, color: '#64748b' }}>
                          {idx + 1}
                        </span>
                      </td>

                      {/* Cause racine */}
                      <td style={cell()}>
                        {row.cause ? (
                          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 10px' }}>
                            <div style={{ fontSize: 9, fontWeight: 800, color: '#059669', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 4 }}>✦ Cause racine</div>
                            <div style={{ fontSize: 12.5, color: '#0f172a', lineHeight: 1.55 }}>{row.cause}</div>
                          </div>
                        ) : (
                          <textarea rows={2} placeholder="Cause racine…"
                            value={row.cause} onChange={e => update(row.id, { cause: e.target.value })}
                            style={tArea}
                            onFocus={e => e.target.style.borderColor = '#1a3a6b'}
                            onBlur={e  => e.target.style.borderColor = '#e2e8f0'}
                          />
                        )}
                      </td>

                      {/* Action corrective */}
                      <td style={cell()}>
                        <textarea rows={2} placeholder="Décrivez l'action corrective…"
                          value={row.action} onChange={e => update(row.id, { action: e.target.value })}
                          style={tArea}
                          onFocus={e => e.target.style.borderColor = '#1a3a6b'}
                          onBlur={e  => e.target.style.borderColor = '#e2e8f0'}
                        />
                      </td>

                      {/* N° OT */}
                      <td style={cell({ verticalAlign: 'middle' })}>
                        <input
                          value={row.ot || ''}
                          onChange={e => update(row.id, { ot: e.target.value })}
                          placeholder="Ex: OT-2026-001"
                          style={{ ...iField, fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 11.5, fontWeight: 700, color: '#475569', background: '#e2e8f0', border: '1.5px solid #cbd5e1', letterSpacing: '0.3px' }}
                          onFocus={e => e.target.style.borderColor = '#94a3b8'}
                          onBlur={e  => e.target.style.borderColor = '#cbd5e1'}
                        />
                      </td>

                      {/* Participant (was Responsable) */}
                      <td style={cell()}>
                        <ParticipantPicker
                          participants={participants}
                          value={row.responsable || ''}
                          onSelect={(nom) => update(row.id, { responsable: nom })}
                          avatarColor={avatarC}
                          onAddParticipant={onAddParticipant}
                        />
                      </td>

                      {/* Délai */}
                      <td style={cell()}>
                        <input type="date" value={row.delai}
                          onChange={e => update(row.id, { delai: e.target.value })}
                          style={{ ...iField, ...(isOverdue ? { borderColor: '#fca5a5', color: '#dc2626' } : {}) }}
                          onFocus={e => e.target.style.borderColor = isOverdue ? '#dc2626' : '#1a3a6b'}
                          onBlur={e  => e.target.style.borderColor = isOverdue ? '#fca5a5' : '#e2e8f0'}
                        />
                        {isOverdue && (
                          <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, marginTop: 5, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span>⚠</span> Délai dépassé
                          </div>
                        )}
                      </td>

                      {/* Statut */}
                      <td style={{ ...cell(), borderRight: 'none' }}>
                        <div style={{ position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: sc.bg, border: `1.5px solid ${sc.border}`, marginBottom: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: sc.color }}>{sc.label}</span>
                          </div>
                          <select value={row.statut}
                            onChange={e => update(row.id, { statut: e.target.value })}
                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                          >
                            {Object.entries(STATUT_ACTION).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* × */}
                      <td style={{ padding: '12px 6px', verticalAlign: 'middle', textAlign: 'center', borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}>
                        <button onClick={() => removeRow(row.id)} title="Supprimer"
                          style={{ width: 28, height: 28, borderRadius: '50%', background: 'none', border: '1.5px solid #e2e8f0', color: '#94a3b8', cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                          onMouseOver={e => { e.currentTarget.style.background='#fef2f2'; e.currentTarget.style.borderColor='#fecaca'; e.currentTarget.style.color='#dc2626' }}
                          onMouseOut={e  => { e.currentTarget.style.background='none';    e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#94a3b8' }}
                        >×</button>
                      </td>

                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const iField = {
  width: '100%', padding: '7px 10px',
  fontSize: 12.5, color: '#0f172a',
  background: '#fff', border: '1.5px solid #e2e8f0',
  borderRadius: 7, fontFamily: "'DM Sans',sans-serif",
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color .15s',
}

const tArea = { ...iField, resize: 'none', lineHeight: 1.5 }
