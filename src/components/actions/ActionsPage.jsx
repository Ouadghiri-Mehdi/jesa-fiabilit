// src/components/actions/ActionsPage.jsx
import { useState, useMemo, useEffect } from 'react'
import C from '../../tokens/colors'
import { api } from '../../lib/api'

const STATUT_CFG = {
  'pas-commence': { label: 'Non commencé', bg: C.redBg,    color: C.red,    border: C.redB },
  'en-cours':     { label: 'En cours',     bg: C.orangeBg, color: C.orange, border: C.orangeB },
  'cloture':      { label: 'Clôturé',      bg: C.greenBg,  color: C.green,  border: C.greenB },
  'retard':       { label: 'En retard',    bg: '#fff7ed',  color: '#ea580c', border: '#fed7aa' },
  'ouverte':      { label: 'Non commencé', bg: C.redBg,    color: C.red,    border: C.redB },
  'cloturee':     { label: 'Clôturé',      bg: C.greenBg,  color: C.green,  border: C.greenB },
}


function RetardBadge({ delai, statut }) {
  if (statut === 'cloturee' || statut === 'cloture') return <span style={{ fontSize: 11.5, color: '#059669', fontWeight: 600 }}>✓ Clôturée</span>
  if (!delai) return <span style={{ color: '#94a3b8' }}>—</span>
  const today    = new Date()
  const deadline = new Date(delai)
  const diff     = Math.floor((today - deadline) / 86400000)
  if (diff <= 0) return <span style={{ fontSize: 11.5, color: '#059669' }}>{Math.abs(diff)}j restants</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
      +{diff}j
    </span>
  )
}

function InitialesAvatar({ nom }) {
  if (!nom) return null
  const initiales = nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1a3a6b', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {initiales}
    </div>
  )
}

function EquipGroup({ equipId, actions, onStatusChange, collapsed, onToggle }) {
  const total     = actions.length
  const cloturees = actions.filter(a => a.statut === 'cloturee' || a.statut === 'cloture').length
  const retard    = actions.filter(a => a.statut === 'retard').length
  const pct       = total ? Math.round((cloturees / total) * 100) : 0
  const barColor  = pct >= 100 ? '#059669' : pct >= 50 ? '#d97706' : '#1a3a6b'

  const thStyle = {
    padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700,
    color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase',
    borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', background: '#f8fafc',
    borderRight: '1px solid #e2e8f0',
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>

      {/* En-tête du groupe */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 18px', cursor: 'pointer',
          background: collapsed ? '#f8fafc' : '#fff',
          borderBottom: collapsed ? 'none' : '1px solid #e2e8f0',
          transition: 'background .15s',
          userSelect: 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#f0f5ff'}
        onMouseLeave={e => e.currentTarget.style.background = collapsed ? '#f8fafc' : '#fff'}
      >
        {/* Flèche */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#1a3a6b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>

        {/* Icône équipement */}
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', border: '1.5px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a3a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
        </div>

        {/* Nom équipement + zone */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, overflow: 'hidden' }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {equipId || '—'}
          </div>
          {actions[0]?.zone && actions[0].zone !== '—' && (
            <span style={{ fontSize: 11, color: '#475569', fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: '#f1f5f9', border: '1px solid #e2e8f0', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {actions[0].zone}
            </span>
          )}
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {retard > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              ⚠ {retard} en retard
            </span>
          )}
          <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
            {cloturees}/{total} actions
          </span>
          {/* Barre progression */}
          <div style={{ width: 72, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width .3s' }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: barColor, width: 32, textAlign: 'right' }}>{pct}%</span>
        </div>
      </div>

      {/* Tableau des actions */}
      {!collapsed && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Réf RCA', 'Action corrective', 'Responsable', 'Délai', 'Retard', 'Statut'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map((a, idx) => {
                const sc = STATUT_CFG[a.statut] || STATUT_CFG['ouverte']
                const isEven = idx % 2 === 0
                return (
                  <tr
                    key={`${a._sessionId}-${a.id}`}
                    style={{ borderBottom: idx < actions.length - 1 ? '1px solid #f1f5f9' : 'none', background: isEven ? '#fff' : '#f8fafd' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#eef4ff'}
                    onMouseLeave={e => e.currentTarget.style.background = isEven ? '#fff' : '#f8fafd'}
                  >
                    {/* Réf RCA */}
                    <td style={{ padding: '10px 14px', borderRight: '1px solid #e2e8f0' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 10.5, fontWeight: 600, color: '#1a3a6b' }}>{a.rcaRef}</span>
                    </td>

                    {/* Action corrective */}
                    <td style={{ padding: '10px 14px', maxWidth: 320, borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.45 }}>{a.action || '—'}</div>
                      {a.cause && (
                        <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3 }}>Cause : {a.cause}</div>
                      )}
                    </td>

                    {/* Responsable */}
                    <td style={{ padding: '10px 14px', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <InitialesAvatar nom={a.responsable || '?'} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>{a.responsable || '—'}</span>
                      </div>
                    </td>

                    {/* Délai */}
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#334155', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }}>
                      {a.delai ? new Date(a.delai).toLocaleDateString('fr-FR') : '—'}
                    </td>

                    {/* Retard */}
                    <td style={{ padding: '10px 14px', borderRight: '1px solid #e2e8f0' }}>
                      <RetardBadge delai={a.delai} statut={a.statut} />
                    </td>

                    {/* Statut */}
                    <td style={{ padding: '10px 14px' }}>
                      <select
                        value={a.statut || 'pas-commence'}
                        onChange={e => onStatusChange(a._sessionId, a.id, e.target.value)}
                        style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${sc.border}`, background: sc.bg, color: sc.color, fontFamily: "'DM Sans',sans-serif", outline: 'none' }}
                      >
                        <option value="pas-commence">● Non commencé</option>
                        <option value="en-cours">◐ En cours</option>
                        <option value="retard">⚠ En retard</option>
                        <option value="cloture">✓ Clôturé</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ActionsPage() {
  const [sessions,   setSessions]   = useState([])
  const [search,     setSearch]     = useState('')
  const [filtStatut, setFiltStatut] = useState('')
  const [filtEquip,  setFiltEquip]  = useState('')
  const [collapsed,  setCollapsed]  = useState({})

  useEffect(() => {
    api.getSessions().then(setSessions).catch(() => {})
  }, [])

  const allActions = useMemo(() => {
    const result = []
    const today = new Date()
    sessions.forEach(s => {
      (s.actionsGenerees || []).forEach(a => {
        let statut = a.statut || 'pas-commence'
        if (statut !== 'cloturee' && statut !== 'cloture' && a.delai && new Date(a.delai) < today) {
          statut = 'retard'
        }
        result.push({ ...a, statut, rcaRef: s.id, equipId: s.equipId, zone: s.zone || '—', _sessionId: s.id })
      })
    })
    return result
  }, [sessions])

  const equipOptions = useMemo(() => [...new Set(allActions.map(a => a.equipId).filter(Boolean))], [allActions])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allActions.filter(a => {
      const matchSearch = !q || (a.action || '').toLowerCase().includes(q) || (a.cause || '').toLowerCase().includes(q) || (a.responsable || '').toLowerCase().includes(q) || (a.equipId || '').toLowerCase().includes(q)
      const matchStatut = !filtStatut || a.statut === filtStatut
      const matchEquip  = !filtEquip  || a.equipId === filtEquip
      return matchSearch && matchStatut && matchEquip
    })
  }, [allActions, search, filtStatut, filtEquip])

  // Grouper par équipement
  const groups = useMemo(() => {
    const map = {}
    filtered.forEach(a => {
      const key = a.equipId || '—'
      if (!map[key]) map[key] = []
      map[key].push(a)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const total     = allActions.length
  const cloturees = allActions.filter(a => a.statut === 'cloturee' || a.statut === 'cloture').length
  const ouvertes  = allActions.filter(a => a.statut !== 'cloturee' && a.statut !== 'cloture').length
  const retard    = allActions.filter(a => a.statut === 'retard').length
  const txReal    = total ? Math.round((cloturees / total) * 100) : 0

  const handleStatusChange = (sessionId, actionId, newStatut) => {
    const updated = sessions.map(s => {
      if (s.id !== sessionId) return s
      return { ...s, actionsGenerees: (s.actionsGenerees || []).map(a => a.id === actionId ? { ...a, statut: newStatut } : a) }
    })
    setSessions(updated)
    const sess = updated.find(s => s.id === sessionId)
    if (sess) api.updateSession(sessionId, sess).catch(() => {})
  }

  const toggleGroup = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  const allOpen  = groups.every(([k]) => !collapsed[k])
  const toggleAll = () => {
    if (allOpen) {
      const c = {}; groups.forEach(([k]) => c[k] = true); setCollapsed(c)
    } else {
      setCollapsed({})
    }
  }

  const fs = { fontSize: 12.5, padding: '7px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontFamily: "'DM Sans',sans-serif", outline: 'none', background: '#fff', color: '#0f172a', cursor: 'pointer' }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, borderTop: '3px solid #059669' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: '.7px', textTransform: 'uppercase', marginBottom: 7 }}>Taux de réalisation</div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 32, color: '#0f172a', lineHeight: 1 }}>
            {txReal}<span style={{ fontSize: 16, fontWeight: 500, color: '#64748b' }}>%</span>
          </div>
          <div style={{ marginTop: 8, height: 4, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${txReal}%`, background: '#059669', borderRadius: 3 }} />
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, borderTop: '3px solid #1a3a6b' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: '.7px', textTransform: 'uppercase', marginBottom: 7 }}>Actions ouvertes</div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 32, color: '#0f172a' }}>{ouvertes}</div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 5 }}>Sur {total} au total</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, borderTop: '3px solid #dc2626' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: '.7px', textTransform: 'uppercase', marginBottom: 7 }}>En retard</div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 32, color: '#dc2626' }}>{retard}</div>
          <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 5, fontWeight: 600 }}>Délai dépassé</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, borderTop: '3px solid #059669' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: '.7px', textTransform: 'uppercase', marginBottom: 7 }}>Clôturées</div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 32, color: '#059669' }}>{cloturees}</div>
          <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 5 }}>Sur {total} au total</div>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '7px 12px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Action, équipement, responsable…"
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#0f172a', width: '100%', fontFamily: "'DM Sans',sans-serif" }} />
        </div>
        <select style={fs} value={filtEquip} onChange={e => setFiltEquip(e.target.value)}>
          <option value="">Tous équipements</option>
          {equipOptions.map(e => <option key={e}>{e}</option>)}
        </select>
        <select style={fs} value={filtStatut} onChange={e => setFiltStatut(e.target.value)}>
          <option value="">Tous statuts</option>
          <option value="pas-commence">Non commencé</option>
          <option value="en-cours">En cours</option>
          <option value="retard">En retard</option>
          <option value="cloture">Clôturé</option>
        </select>
        {groups.length > 0 && (
          <button onClick={toggleAll}
            style={{ padding: '7px 14px', background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#1a3a6b', fontFamily: "'DM Sans',sans-serif" }}>
            {allOpen ? '▲ Tout replier' : '▼ Tout déplier'}
          </button>
        )}
      </div>

      {/* Groupes par équipement */}
      {total === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 48, textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
              <path d="M8 7h8" />
              <path d="M8 11h8" />
              <path d="M8 15h5" />
              <path d="M16 3v4" />
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Aucune action corrective</div>
          <div style={{ fontSize: 13 }}>Les actions seront affichées ici une fois générées depuis une analyse RCA.</div>
        </div>
      ) : groups.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 32, textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Aucune action correspondante</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, fontWeight: 600 }}>
            {groups.length} équipement{groups.length > 1 ? 's' : ''} · {filtered.length} action{filtered.length > 1 ? 's' : ''}
            {filtered.length !== total ? ` (sur ${total} total)` : ''}
          </div>
          {groups.map(([equipId, actions]) => (
            <EquipGroup
              key={equipId}
              equipId={equipId}
              actions={actions}
              onStatusChange={handleStatusChange}
              collapsed={!!collapsed[equipId]}
              onToggle={() => toggleGroup(equipId)}
            />
          ))}
        </>
      )}
    </div>
  )
}
