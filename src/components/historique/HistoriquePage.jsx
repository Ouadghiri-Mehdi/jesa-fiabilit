// src/components/historique/HistoriquePage.jsx
import { useState, useMemo, useEffect } from 'react'
import C from '../../tokens/colors'
import useTUM from '../../hooks/useTUM'
import { getStatut } from '../../hooks/useTUM'
import { api } from '../../lib/api'

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

function FilePreviewModal({ pj, onClose }) {
  if (!pj) return null
  const url     = pj.url
  const isImage = pj.type?.startsWith('image/')
  const isPdf   = pj.type === 'application/pdf'
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:900, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:12, width:'min(900px,96vw)', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,.5)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderBottom:'1px solid #e2e8f0', flexShrink:0 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>{pj.name}</span>
          <div style={{ display:'flex', gap:8 }}>
            {url && <a href={url} download={pj.name} target="_blank" rel="noreferrer" style={{ padding:'6px 14px', borderRadius:8, border:'1.5px solid #e2e8f0', background:'#f8fafc', fontSize:12, fontWeight:600, color:'#334155', textDecoration:'none' }}>⬇ Télécharger</a>}
            <button onClick={onClose} style={{ padding:'6px 14px', borderRadius:8, border:'none', background:'#0b2e63', fontSize:12, fontWeight:700, color:'#fff', cursor:'pointer' }}>Fermer</button>
          </div>
        </div>
        <div style={{ flex:1, overflow:'auto', background:'#f1f5f9', padding:16, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {isImage && url && <img src={url} alt={pj.name} style={{ maxWidth:'100%', maxHeight:'70vh', objectFit:'contain', borderRadius:6 }} />}
          {isPdf   && url && <iframe src={url} title={pj.name} style={{ width:'100%', height:'70vh', border:'none', borderRadius:6 }} />}
          {!isImage && !isPdf && (
            <div style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📄</div>
              <div style={{ fontSize:14, fontWeight:600, color:'#334155', marginBottom:16 }}>{pj.name}</div>
              {url && <a href={url} download={pj.name} target="_blank" rel="noreferrer" style={{ padding:'10px 24px', borderRadius:25, background:'#0b2e63', color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none', display:'inline-block' }}>⬇ Télécharger</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DossierEquip({ equip, onBack, arrets, allSessions = [] }) {
  const [tab, setTab] = useState('tum')
  const [docs, setDocs] = useState([])
  const [previewDoc, setPreviewDoc] = useState(null)
  const [uploading, setUploading] = useState(false)

  const arretsEquip  = arrets.filter(a => a.equipId === equip.id)
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
  const cumulTotal   = arretsEquip.reduce((s, a) => s + (a.duration || 0), 0)
  const dernierArret = arretsEquip[0]

  const rcaSessions = allSessions.filter(s => s.equipId === equip.id)

  // PJ extraites automatiquement des sessions RCA (Quick Kaizen + 5-Why)
  const pjFromRCA = rcaSessions.flatMap(s => {
    const result = []

    // Quick Kaizen — vérification rows
    const rows = s.noeuds?.[0]?.kaizenWheelData?.check?.rows || []
    rows.filter(r => r.pieceJointe?.url).forEach(r =>
      result.push({ ...r.pieceJointe, source: s.id, cause: r.cause })
    )

    // 5-Why — parcours récursif des noeuds
    const walkNodes = (nodes) => {
      if (!nodes) return
      nodes.forEach(n => {
        const docs = n.docs || (n.doc ? [n.doc] : [])
        docs.forEach(doc => {
          if (doc?.url) result.push({ name: doc.name, url: doc.url, type: doc.type || '', source: s.id, cause: n.texte })
        })
        if (n.enfants?.length) walkNodes(n.enfants)
      })
    }
    walkNodes(s.noeuds)

    return result
  })

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
                    <td style={td}>{(() => { const end = a.endTime ? new Date(a.endTime) : (a.startTime && a.duration ? new Date(new Date(a.startTime).getTime() + a.duration * 3600000) : null); return end ? `${end.toLocaleDateString('fr-FR')} ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '—' })()}</td>
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
          {previewDoc && <FilePreviewModal pj={previewDoc} onClose={() => setPreviewDoc(null)} />}

          {/* Drop zone upload direct */}
          <label style={{ display: 'block', border: '2px dashed #cbd5e1', borderRadius: 8, padding: 20, textAlign: 'center', cursor: uploading ? 'wait' : 'pointer', background: '#f8fafc', marginBottom: 20, opacity: uploading ? .6 : 1 }}
            onMouseOver={e => { if (!uploading) e.currentTarget.style.borderColor = '#0b2e63' }}
            onMouseOut={e  => e.currentTarget.style.borderColor = '#cbd5e1'}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{uploading ? 'Envoi en cours…' : 'Déposer un document ou cliquer pour parcourir'}</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Plans mécaniques · Schémas · PDF · Photos · Word · Excel</div>
            <input type="file" style={{ display: 'none' }} multiple disabled={uploading}
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx"
              onChange={async e => {
                const files = Array.from(e.target.files || [])
                if (!files.length) return
                setUploading(true)
                try {
                  const uploaded = await Promise.all(files.map(f => api.uploadFile(f)))
                  setDocs(d => [...d, ...uploaded.map(u => ({ ...u, uploadedAt: new Date().toLocaleDateString('fr-FR'), source: 'direct' }))])
                } catch (err) {
                  alert('Erreur upload : ' + err.message)
                } finally {
                  setUploading(false)
                  e.target.value = null
                }
              }} />
          </label>

          {/* PJ depuis RCA */}
          {pjFromRCA.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 3, height: 14, background: '#0b2e63', borderRadius: 2 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0b2e63', textTransform: 'uppercase', letterSpacing: '.8px' }}>Pièces jointes — Analyses RCA</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {pjFromRCA.map((d, i) => (
                  <div key={i} onClick={() => setPreviewDoc(d)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', cursor: 'pointer', transition: 'background .12s' }}
                    onMouseOver={e => e.currentTarget.style.background = '#e0f2fe'}
                    onMouseOut={e  => e.currentTarget.style.background = '#f0f9ff'}>
                    <span style={{ fontSize: 20 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0369a1', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 4, padding: '1px 6px', fontWeight: 600, fontSize: 10, marginRight: 6 }}>RCA</span>
                        {d.source}
                        {d.cause && <span style={{ marginLeft: 8, color: '#94a3b8' }}>· Cause : {d.cause}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>Voir →</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uploads directs */}
          {docs.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 3, height: 14, background: '#64748b', borderRadius: 2 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.8px' }}>Documents ajoutés manuellement</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {docs.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <span onClick={() => setPreviewDoc(d)} style={{ fontSize: 20, cursor: 'pointer' }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setPreviewDoc(d)}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{d.uploadedAt}</div>
                    </div>
                    <button onClick={() => setDocs(ds => ds.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                      onMouseOver={e => e.currentTarget.style.color = '#dc2626'}
                      onMouseOut={e  => e.currentTarget.style.color = '#cbd5e1'}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pjFromRCA.length === 0 && docs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>Aucun document archivé</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function HistoriquePage() {
  const { arrets, seuils, equipmentList } = useTUM()
  const [search, setSearch]     = useState('')
  const [filtEqSeq, setFiltEqSeq] = useState('')
  const [selected, setSelected] = useState(null)
  const [allSessions, setAllSessions] = useState([])

  useEffect(() => {
    api.getSessions().then(setAllSessions).catch(() => {})
  }, [])

  const knownPostesList = equipmentList

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
    allSessions.forEach(s => { map[s.equipId] = (map[s.equipId] || 0) + 1 })
    return map
  }, [allSessions])

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
    return <DossierEquip equip={selected} onBack={() => setSelected(null)} arrets={arrets} allSessions={allSessions} />
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
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5a2 2 0 0 1 2-2h10l6 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z"/>
            <path d="M8 9h4"/>
            <path d="M8 13h4"/>
            <path d="M10 17h2"/>
            <circle cx="17" cy="17" r="3"/>
            <line x1="19.5" y1="19.5" x2="22" y2="22"/>
          </svg>
          Rechercher un poste technique
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 14px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="6"/>
              <line x1="14.5" y1="14.5" x2="20" y2="20"/>
              <path d="M6 10h4"/>
            </svg>
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
            <div style={{ fontSize: 32, marginBottom: 12 }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="14" height="14" rx="2"/>
                <line x1="3" y1="9" x2="17" y2="9"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
                <circle cx="16.5" cy="16.5" r="3"/>
                <line x1="18.5" y1="18.5" x2="22" y2="22"/>
              </svg>
            </div>
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
