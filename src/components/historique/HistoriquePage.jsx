// src/components/historique/HistoriquePage.jsx
import { useState, useMemo } from 'react'
import C from '../../tokens/colors'
import { getStatut } from '../../hooks/useTUM'
import { useTUMContext, useRCAContext } from '../layout/Layout'
import { POSTES_TECHNIQUES } from '../../data/postes_techniques'

const STATUT_RCA = {
  'en-cours':      { label: 'En cours',       bg: '#eef2f7', color: '#334155', border: '#d1dbe8', dot: '#334155' },
  'non-commencee': { label: 'Non commencée',  bg: '#f8fafc', color: '#64748b', border: '#e2e8f0', dot: '#94a3b8' },
  'cloturee':      { label: 'Clôturée',       bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', dot: '#059669' },
}

const STATUT_ACT = {
  ouverte:  { label: '🟡 Ouverte',   bg: '#FEFFD6', color: '#d97706', border: '#fde68a' },
  retard:   { label: '🔴 En retard', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  cloturee: { label: '🟢 Clôturée',  bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
}

const th = { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', background: '#f8fafc' }
const td = { padding: '11px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#334155' }

function ProgressBar({ value, statut }) {
  const color = statut === 'cloturee' ? '#059669' : statut === 'retard' ? '#dc2626' : '#d97706'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>{value}%</span>
    </div>
  )
}


function EquipCard({ equip, onSelect, stats, rcaCount }) {
  const niveauColor = stats?.statut === 'alert' ? '#dc2626' : stats?.statut === 'watch' ? '#d97706' : '#059669'
  const niveauBg    = stats?.statut === 'alert' ? '#fef2f2' : stats?.statut === 'watch' ? '#FEFFD6' : '#ecfdf5'
  const niveauLabel = stats?.statut === 'alert' ? 'N2' : stats?.statut === 'watch' ? 'N1' : 'N0'

  return (
    <div onClick={() => onSelect(equip)}
      style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 20, transition: 'all .15s' }}
      onMouseOver={e => { e.currentTarget.style.borderColor = '#1a3a6b'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(26,58,107,.10)' }}
      onMouseOut={e  => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13.5, color: '#1a3a6b' }}>{equip.id}</span>
          <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: niveauBg, color: niveauColor }}>
            {niveauLabel}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
          {equip.designation || '—'}
        </div>
        {(equip.niveau || equip.eqSeq) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {equip.niveau && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 600, background: '#eff6ff', color: '#1a3a6b', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: 9, opacity: .7, textTransform: 'uppercase', letterSpacing: '.5px' }}>Niveau</span>
                {equip.niveau}
              </span>
            )}
            {equip.eqSeq && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 600, background: '#f0fdf4', color: '#059669', border: '1px solid #a7f3d0' }}>
                <span style={{ fontSize: 9, opacity: .7, textTransform: 'uppercase', letterSpacing: '.5px' }}>EQ/SEQ</span>
                {equip.eqSeq}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        {[
          { label: 'Cumul',  value: stats?.cumul ? `${stats.cumul.toFixed(1)}h` : '0h' },
          { label: 'Arrêts', value: stats?.freq || 0 },
          { label: 'RCA',    value: rcaCount || 0 },
        ].map(m => (
          <div key={m.label} style={{ textAlign: 'center', padding: '7px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', minWidth: 60 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{m.value}</div>
            <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  )
}

function DossierEquip({ equip, onBack, arrets, allRcaSessions }) {
  const [tab, setTab] = useState('tum')
  const [docs, setDocs] = useState([])

  const arretsEquip  = arrets.filter(a => a.equipId === equip.id)
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
  const cumulTotal   = arretsEquip.reduce((s, a) => s + (a.duration || 0), 0)
  const dernierArret = arretsEquip[0]

  const rcaSessions = (allRcaSessions || []).filter(s => s.equipId === equip.id)

  // Actions depuis actionsGenerees des sessions
  const actions = rcaSessions.flatMap(s =>
    (s.actionsGenerees || []).map(a => ({ ...a, rcaRef: s.id }))
  )

  const tabs = [
    { key: 'tum',     label: 'TUM — Historique pannes', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { key: 'rca',     label: 'Analyses RCA',             icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
    { key: 'actions', label: 'Actions',                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { key: 'docs',    label: 'Documents',                icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  ]

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 25, fontSize: 12.5, fontWeight: 600, color: '#334155', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}
          onMouseOver={e => e.currentTarget.style.borderColor = '#1a3a6b'}
          onMouseOut={e  => e.currentTarget.style.borderColor = '#cbd5e1'}>
          ← Retour à la liste
        </button>
      </div>

      {/* Header navy */}
      <div style={{ background: '#1a3a6b', borderRadius: 12, padding: '20px 26px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(255,255,255,.15)', border: '1.5px solid rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>⚙️</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '.4px' }}>{equip.id}</div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.78)', marginTop: 3 }}>{equip.designation || '—'}</div>
          {(equip.niveau || equip.eqSeq) && (
            <div style={{ display: 'flex', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
              {equip.niveau && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.92)', border: '1px solid rgba(255,255,255,.28)' }}>
                  <span style={{ fontSize: 9, opacity: .65, textTransform: 'uppercase', letterSpacing: '.6px' }}>Niveau</span>
                  {equip.niveau}
                </span>
              )}
              {equip.eqSeq && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.92)', border: '1px solid rgba(255,255,255,.28)' }}>
                  <span style={{ fontSize: 9, opacity: .65, textTransform: 'uppercase', letterSpacing: '.6px' }}>EQ/SEQ</span>
                  {equip.eqSeq}
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { value: cumulTotal.toFixed(1) + 'h', label: 'Cumul arrêts' },
            { value: arretsEquip.length,            label: 'Nb arrêts' },
            { value: dernierArret?.duration?.toFixed(1) + 'h' || '—', label: 'Dernière durée' },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center', padding: '10px 16px', background: 'rgba(255,255,255,.1)', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)' }}>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>{m.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 0 }}>
        {tabs.map(t => (
          <div key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
            color: tab === t.key ? '#1a3a6b' : '#64748b',
            borderBottom: `3px solid ${tab === t.key ? '#1a3a6b' : 'transparent'}`,
            marginBottom: -2, transition: 'all .15s', whiteSpace: 'nowrap',
          }}>{t.icon}{t.label}</div>
        ))}
      </div>

      {/* TUM */}
      {tab === 'tum' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Date début', 'Date fin', 'Durée', 'Zone', 'Cause', 'Description'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {arretsEquip.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Aucun arrêt enregistré</td></tr>
                ) : arretsEquip.map((a, i) => (
                  <tr key={i} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = ''}>
                    <td style={td}>{new Date(a.startTime).toLocaleDateString('fr-FR')} {new Date(a.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={td}>{a.startTime && a.duration ? (() => { const d = new Date(new Date(a.startTime).getTime() + a.duration * 3600000); return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` })() : '—'}</td>
                    <td style={{ ...td, fontWeight: 700, color: '#dc2626' }}>{a.duration?.toFixed(1)}h</td>
                    <td style={td}>{a.zone || '—'}</td>
                    <td style={td}>{a.cause || '—'}</td>
                    <td style={{ ...td, maxWidth: 300, color: '#64748b' }}>{a.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RCA */}
      {tab === 'rca' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Réf. RCA', 'Niveau', 'Méthode', 'Cause arrêt', 'Responsable', 'Date', 'Statut'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rcaSessions.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Aucune analyse RCA enregistrée</td></tr>
                ) : rcaSessions.map((s, i) => {
                  const sc = STATUT_RCA[s.statut] || STATUT_RCA['non-commencee']
                  return (
                    <tr key={i} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = ''}>
                      <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: '#1a3a6b' }}>{s.id}</span></td>
                      <td style={td}><span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.niveau === 2 ? '#fef2f2' : '#fffbeb', color: s.niveau === 2 ? '#dc2626' : '#d97706' }}>N{s.niveau}</span></td>
                      <td style={td}><span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#1a3a6b', border: '1px solid #bfdbfe' }}>{s.methode === '5why' ? '5 WHY' : 'KAIZEN'}</span></td>
                      <td style={td}>{s.causeArret || '—'}</td>
                      <td style={td}>{s.responsable || '—'}</td>
                      <td style={td}>{s.dateOuverture ? new Date(s.dateOuverture).toLocaleDateString('fr-FR') : '—'}</td>
                      <td style={td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color, border: `1.5px solid ${sc.border}` }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      {tab === 'actions' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Réf RCA', 'Action', 'Responsable', 'Délai prévu', 'Avancement', 'Statut'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {actions.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Aucune action enregistrée</td></tr>
                ) : actions.map((a, i) => {
                  const sc = STATUT_ACT[a.statut] || STATUT_ACT.ouverte
                  return (
                    <tr key={i} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = ''}>
                      <td style={td}><span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: '#1a3a6b' }}>{a.rcaRef}</span></td>
                      <td style={{ ...td, maxWidth: 260 }}>{a.action || a.cause || '—'}</td>
                      <td style={td}>{a.responsable || '—'}</td>
                      <td style={td}>{a.delai ? new Date(a.delai).toLocaleDateString('fr-FR') : '—'}</td>
                      <td style={{ ...td, minWidth: 130 }}><ProgressBar value={a.avancement || 0} statut={a.statut || 'ouverte'} /></td>
                      <td style={td}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: sc.bg, color: sc.color, border: `1.5px solid ${sc.border}` }}>{sc.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents */}
      {tab === 'docs' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 0 12px 12px', padding: 20 }}>
          <label style={{ display: 'block', border: '2px dashed #cbd5e1', borderRadius: 8, padding: 20, textAlign: 'center', cursor: 'pointer', background: '#f8fafc', marginBottom: 16 }}
            onMouseOver={e => e.currentTarget.style.borderColor = '#1a3a6b'}
            onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Déposer un document ou cliquer pour parcourir</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Plans mécaniques · Schémas · PDF · Photos</div>
            <input type="file" style={{ display: 'none' }} multiple accept=".pdf,.png,.jpg,.jpeg"
              onChange={e => { if (e.target.files) setDocs(d => [...d, ...Array.from(e.target.files).map(f => ({ name: f.name, size: f.size, date: new Date().toLocaleDateString('fr-FR') }))]) }} />
          </label>
          {docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>Aucun document archivé</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docs.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: 18 }}>📄</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{d.date} · {(d.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <button onClick={() => setDocs(ds => ds.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function HistoriquePage() {
  const { arrets, seuils } = useTUMContext() || { arrets: [], seuils: { n1: { cumul: 8, frequence: 3, horizon: 30 }, n2: { cumul: 24, frequence: 5, horizon: 30 } } }
  const { sessions: rcaSessions } = useRCAContext() || { sessions: [] }
  const [search, setSearch]     = useState('')
  const [filtEqSeq, setFiltEqSeq] = useState('')
  const [selected, setSelected] = useState(null)

  const knownPostesList = useMemo(() => POSTES_TECHNIQUES, [])

  // Stats par équipement
  const equipStats = useMemo(() => {
    const stats = {}
    knownPostesList.forEach(p => {
      const arretsEquip = arrets.filter(a => a.equipId === p.id)
      const cumul  = arretsEquip.reduce((s, a) => s + (a.duration || 0), 0)
      const freq   = arretsEquip.length
      const statut = getStatut(cumul, freq, seuils)
      const dernier = [...arretsEquip].sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0]
      stats[p.id] = { cumul, freq, statut, derniereCause: dernier?.cause || '—' }
    })
    return stats
  }, [arrets, knownPostesList, seuils])

  // Compte des sessions RCA par équipement
  const rcaCountMap = useMemo(() => {
    const map = {}
    rcaSessions.forEach(s => { map[s.equipId] = (map[s.equipId] || 0) + 1 })
    return map
  }, [rcaSessions])

  // Valeurs uniques pour le filtre EQ/SEQ
  const eqSeqOptions = useMemo(() => [...new Set(knownPostesList.map(p => p.eqSeq).filter(Boolean))], [knownPostesList])

  // Filtrage
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return knownPostesList.filter(p => {
      const matchSearch = !q || p.id.toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q)
      const matchEqSeq  = !filtEqSeq || p.eqSeq === filtEqSeq
      return matchSearch && matchEqSeq
    })
  }, [search, filtEqSeq, knownPostesList])

  if (selected) {
    return <DossierEquip equip={selected} onBack={() => setSelected(null)} arrets={arrets} allRcaSessions={rcaSessions} />
  }

  const totalCumul      = arrets.reduce((s, a) => s + (a.duration || 0), 0)
  const equipAvecArrets = [...new Set(arrets.map(a => a.equipId))].length

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Postes techniques suivis', value: knownPostesList.length, sub: `${eqSeqOptions.length} catégorie(s) EQ/SEQ`, top: '#1a3a6b' },
          { label: 'Total arrêts',             value: arrets.length,          sub: 'enregistrés',         top: '#1a3a6b' },
          { label: 'Cumul total',              value: totalCumul.toFixed(1) + 'h', sub: 'toutes causes', top: '#059669' },
          { label: 'Équipements impactés',     value: equipAvecArrets,        sub: `sur ${knownPostesList.length}`, top: '#d97706' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18, borderTop: `3px solid ${k.top}` }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: '.7px', textTransform: 'uppercase', marginBottom: 7 }}>{k.label}</div>
            <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 32, color: '#0f172a' }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 5 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Barre de recherche */}
      <div style={{ background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 12, padding: '20px 24px', marginBottom: 20, boxShadow: '0 4px 12px rgba(15,30,53,.10)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12 }}>
          🔍 Rechercher un poste technique
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 14px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Poste technique ou désignation…"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#0f172a', width: '100%', fontFamily: "'DM Sans',sans-serif" }} />
          </div>
          <select value={filtEqSeq} onChange={e => setFiltEqSeq(e.target.value)}
            style={{ fontSize: 12.5, padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontFamily: "'DM Sans',sans-serif", outline: 'none', background: '#fff', color: '#0f172a', cursor: 'pointer', minWidth: 160 }}>
            <option value="">Tous EQ/SEQ</option>
            {eqSeqOptions.map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Aucun poste technique trouvé</div>
          </div>
        ) : filtered.map(p => (
          <EquipCard
            key={p.id}
            equip={p}
            onSelect={setSelected}
            stats={equipStats[p.id] || { cumul: 0, freq: 0, statut: 'normal', derniereCause: '—' }}
            rcaCount={rcaCountMap[p.id] || 0}
          />
        ))}
      </div>
    </div>
  )
}
