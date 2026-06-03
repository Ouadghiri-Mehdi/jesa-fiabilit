// src/components/global/GlobalViewPage.jsx
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { api } from '../../lib/api'
import C from '../../tokens/colors'


const SITE_COLORS = {
  'Rabat':       { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  'Jorf Lasfar': { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
}

const STATUTS_TREE = {
  investigation: { label: '?',  color: '#64748b', bg: '#f1f5f9', borderCard: '#cbd5e1' },
  valide:        { label: '✓',  color: '#059669', bg: '#ecfdf5', borderCard: '#a7f3d0' },
  rejete:        { label: '✗',  color: '#dc2626', bg: '#fef2f2', borderCard: '#fecaca' },
}

const CARD_W = 170
const COLORS_PART = ['#1a3a6b','#059669','#d97706','#dc2626','#7c3aed','#0891b2','#0f766e','#b45309']

function formatDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' }) } catch { return '—' }
}
function formatDateTime(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) } catch { return '—' }
}
function getGlobalTrackingSeenAt(userId) {
  if (typeof window === 'undefined' || !userId) return 0
  return Number(localStorage.getItem(`jesa_global_tracking_seen_at_${userId}`) || 0)
}
function setGlobalTrackingSeenAt(userId, value) {
  if (typeof window === 'undefined' || !userId) return
  localStorage.setItem(`jesa_global_tracking_seen_at_${userId}`, String(value))
}
function getClosedSessionTimestamp(session) {
  if (!session) return 0
  return new Date(session.dateHeureFin || session.updatedAt || session.createdAt || 0).getTime()
}
function calcDuree(debut, fin) {
  if (!debut || !fin) return '—'
  try {
    const ms = new Date(fin) - new Date(debut)
    if (ms <= 0) return '—'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `${h}h ${m}min` : `${m}min`
  } catch { return '—' }
}

function SiteBadge({ site }) {
  const c = SITE_COLORS[site] || { bg:'#f1f5f9', color:'#475569', border:'#e2e8f0' }
  return (
    <span style={{ display:'inline-block', padding:'2px 10px', background:c.bg, color:c.color, border:`1px solid ${c.border}`, borderRadius:99, fontSize:11, fontWeight:600 }}>
      {site}
    </span>
  )
}

// ── Arbre 5-Why lecture seule ────────────────────────────────────────────────
function ReadOnlyNoeud({ noeud, depth }) {
  const sc = STATUTS_TREE[noeud.statut] || STATUTS_TREE.investigation
  const isCauseRacine = !noeud.enfants?.length && noeud.statut === 'valide'
  const isRejete      = noeud.statut === 'rejete'
  const HALF_GAP = 5

  return (
    <div style={{ display:'flex', alignItems:'center', position:'relative' }}>
      <div style={{
        width: CARD_W, flexShrink:0,
        background: isCauseRacine ? '#ecfdf5' : isRejete ? '#fef2f2' : '#fff',
        border: `1.5px solid ${sc.borderCard}`,
        borderRadius:8, padding:'8px 10px',
        boxShadow:'0 1px 4px rgba(15,30,53,.07)',
        opacity: isRejete ? 0.65 : 1,
      }}>
        <div style={{ marginBottom:5 }}>
          <span style={{
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            width:20, height:20, borderRadius:'50%',
            background: sc.color, color:'#fff',
            fontSize:10, fontWeight:800,
          }}>{sc.label}</span>
        </div>
        <div style={{ fontSize:11.5, color:'#0f172a', lineHeight:1.5, textDecoration: isRejete ? 'line-through' : 'none' }}>
          {noeud.texte || <span style={{ color:'#cbd5e1', fontStyle:'italic' }}>—</span>}
        </div>
        {isCauseRacine && noeud.texte && (
          <div style={{ marginTop:4, fontSize:9, fontWeight:700, color:'#059669', letterSpacing:'.5px' }}>✦ Cause racine finale</div>
        )}
        {(noeud.docs?.length > 0 || noeud.doc) && (
          <div style={{ marginTop:5, fontSize:10, color:'#64748b' }}>
            📎 {(noeud.docs || [noeud.doc]).length} fichier(s) joint(s)
          </div>
        )}
      </div>

      {noeud.enfants?.length > 0 && (
        <div style={{ display:'flex', alignItems:'center' }}>
          <div style={{ width:32, height:2, background:'#cbd5e1', flexShrink:0 }} />
          <div style={{ display:'flex', flexDirection:'column' }}>
            {noeud.enfants.map((enfant, i) => {
              const isFirst = i === 0
              const isLast  = i === noeud.enfants.length - 1
              const isOnly  = noeud.enfants.length === 1
              return (
                <div key={enfant.id || i} style={{ display:'flex', alignItems:'center', position:'relative', marginBottom: isLast ? 0 : 10 }}>
                  {!isOnly && (
                    <div style={{
                      position:'absolute', left:-1, width:2, background:'#cbd5e1',
                      top:    isFirst ? '50%' : -HALF_GAP,
                      bottom: isLast  ? '50%' : -HALF_GAP,
                    }} />
                  )}
                  <div style={{ width:24, height:2, background:'#cbd5e1', flexShrink:0 }} />
                  <ReadOnlyNoeud noeud={enfant} depth={depth + 1} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ReadOnlyFiveWhyTree({ noeuds, phenomene }) {
  const tree = noeuds?.length ? noeuds : []
  if (!tree.length) return (
    <div style={{ padding:'24px', textAlign:'center', color:'#94a3b8', fontSize:13, background:'#f8fafc', borderRadius:10, border:'1px dashed #e2e8f0' }}>
      Aucune donnée d'analyse disponible.
    </div>
  )

  function getMaxDepth(nodes, cur = 0) {
    if (!nodes?.length) return cur
    return Math.max(...nodes.map(n => n.enfants?.length ? getMaxDepth(n.enfants, cur + 1) : cur))
  }
  const maxDepth = getMaxDepth(tree)
  const LEVEL_LABELS = ['Phénomène','Pourquoi 1','Pourquoi 2','Pourquoi 3','Pourquoi 4','Pourquoi 5']
  const H_CONN = 56
  const colWidths = Array.from({ length: maxDepth + 1 }, (_, d) => CARD_W + (d < maxDepth ? H_CONN : 0))

  return (
    <div style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
      {/* Bande niveaux */}
      <div style={{ display:'flex', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', padding:'5px 20px' }}>
        {colWidths.map((w, d) => (
          <div key={d} style={{ width:w, flexShrink:0 }}>
            <span style={{ display:'inline-block', fontSize:10.5, fontWeight:800, color:'#64748b', background:'#f1f5f9', border:'1.5px solid #cbd5e1', borderRadius:20, padding:'2px 10px', letterSpacing:'.4px', whiteSpace:'nowrap' }}>
              {LEVEL_LABELS[d] || `Pourquoi ${d}`}
            </span>
          </div>
        ))}
      </div>
      {/* Arbre */}
      <div style={{ overflowX:'auto', padding:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:20, minWidth:'max-content' }}>
          {tree.map((noeud, i) => <ReadOnlyNoeud key={noeud.id || i} noeud={noeud} depth={0} />)}
        </div>
      </div>
    </div>
  )
}

// ── Roue Kaizen SVG ──────────────────────────────────────────────────────────
function KaizenWheelSVG({ activeLetters = ['P','C','V','A'] }) {
  const cx = 90, cy = 90, outerR = 70, innerR = 32, ringR = 78, badgeR = 51, gap = 5

  function polar(r, deg) {
    const rad = (deg - 90) * Math.PI / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }

  function sector(s, e) {
    const [x1,y1] = polar(outerR, s), [x2,y2] = polar(outerR, e)
    const [x3,y3] = polar(innerR, e), [x4,y4] = polar(innerR, s)
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${outerR},${outerR},0,0,1,${x2.toFixed(2)},${y2.toFixed(2)} L${x3.toFixed(2)},${y3.toFixed(2)} A${innerR},${innerR},0,0,0,${x4.toFixed(2)},${y4.toFixed(2)} Z`
  }

  const steps = [
    { letter:'P', start:gap,     end:90-gap,  mid:45  },
    { letter:'C', start:90+gap,  end:180-gap, mid:135 },
    { letter:'V', start:180+gap, end:270-gap, mid:225 },
    { letter:'A', start:270+gap, end:360-gap, mid:315 },
  ]

  return (
    <svg viewBox="0 0 180 180" width={160} height={160} style={{ flexShrink:0 }}>
      {steps.map(s => {
        const [bx, by] = polar(badgeR, s.mid)
        const on = activeLetters.includes(s.letter)
        return (
          <g key={s.letter}>
            <path d={sector(s.start, s.end)} fill={on ? '#2d5fa6' : '#7a9bc0'} opacity={on ? 1 : 0.45} />
            <circle cx={bx} cy={by} r={12} fill="#1a3a6b" />
            <text x={bx} y={by} textAnchor="middle" dominantBaseline="central"
              fontSize={10} fontWeight={900} fill="#fff" fontFamily="sans-serif">{s.letter}</text>
          </g>
        )
      })}
      {/* cercle central */}
      <circle cx={cx} cy={cy} r={innerR} fill="#1a3a6b" />
      <text x={cx} y={cy-7} textAnchor="middle" fontSize={7.5} fontWeight={800} fill="#fff" fontFamily="sans-serif">QUICK</text>
      <text x={cx} y={cy+6} textAnchor="middle" fontSize={7.5} fontWeight={800} fill="#fff" fontFamily="sans-serif">KAIZEN</text>
    </svg>
  )
}

// ── Quick Kaizen P-C-V-A lecture seule ──────────────────────────────────────
function KZStepHeader({ letter, letterBg, letterColor, title, count }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
      <div style={{ width:26, height:26, borderRadius:'50%', background:letterBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <span style={{ fontSize:10, fontWeight:900, color:letterColor }}>{letter}</span>
      </div>
      <span style={{ fontSize:11.5, fontWeight:800, color:'#1e293b', textTransform:'uppercase', letterSpacing:'.7px' }}>{title}</span>
      {count != null && (
        <span style={{ marginLeft:'auto', fontSize:10.5, fontWeight:700, background:'#f1f5f9', color:'#64748b', borderRadius:20, padding:'2px 9px' }}>{count}</span>
      )}
    </div>
  )
}

function ReadOnlyKaizen({ noeuds }) {
  const kd = noeuds?.[0]?.kaizenWheelData
  if (!kd) return (
    <div style={{ padding:'28px', textAlign:'center', color:'#94a3b8', fontSize:13, background:'#f8fafc', borderRadius:10, border:'1px dashed #e2e8f0' }}>
      Aucune donnée Quick Kaizen disponible.
    </div>
  )

  const plan      = kd.plan  || {}
  const doData    = kd.do    || {}
  const check     = kd.check || {}
  const causes    = (doData.causes || []).filter(c => c?.trim())
  const checkRows = (check.rows   || []).map((r, i) => ({ ...r, cause: causes[i] || r.cause || '' }))
  const rejetees  = checkRows.filter(r => r.resultat === 'rejete')
  const bonnes    = checkRows.filter(r => r.resultat === 'valide')

  const activeLetters = [
    'P',
    causes.length > 0    ? 'C' : null,
    checkRows.length > 0 ? 'V' : null,
    rejetees.length > 0  ? 'A' : null,
  ].filter(Boolean)

  const qqoqcp = [
    { label:'OÙ ?',       value: plan.ou },
    { label:'QUAND ?',    value: plan.quand },
    { label:'QUI ?',      value: plan.qui },
    { label:'COMMENT ?',  value: plan.comment },
    { label:'COMBIEN ?',  value: plan.combien },
    { label:'POURQUOI ?', value: plan.pourquoi },
  ].filter(q => q.value?.trim())

  const NAVY = '#1a3a6b'
  const card = {
    background:'#f4f6fb', border:'1.5px solid #d0d9ed',
    borderRadius:12, borderLeft:`4px solid ${NAVY}`,
    padding:'16px 18px', boxShadow:'0 1px 4px rgba(15,30,53,.05)',
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      {/* ── Roue visuelle ── */}
      <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 4px' }}>
        <KaizenWheelSVG activeLetters={activeLetters} />
      </div>

      {/* ── P : Problème observé ── */}
      <div style={card}>
        <KZStepHeader letter="P" letterBg={NAVY} letterColor="#fff" title="Problème observé" />
        <div style={{ fontWeight:700, fontSize:14, color:'#1e293b', lineHeight:1.5, marginBottom: qqoqcp.length ? 14 : 0 }}>
          {plan.titre || <span style={{ color:'#94a3b8', fontStyle:'italic', fontWeight:400 }}>Non renseigné</span>}
        </div>
        {qqoqcp.length > 0 && (
          <>
            <div style={{ fontSize:10, fontWeight:800, color:NAVY, textTransform:'uppercase', letterSpacing:'.8px', marginBottom:8 }}>Méthode QQOQCP</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(170px, 1fr))', gap:7 }}>
              {qqoqcp.map(q => (
                <div key={q.label} style={{ background:'#fff', borderRadius:8, padding:'8px 11px', border:'1px solid #d0d9ed' }}>
                  <div style={{ fontSize:9, fontWeight:800, color:NAVY, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:4 }}>{q.label}</div>
                  <div style={{ fontSize:12.5, color:'#374151', lineHeight:1.4 }}>{q.value}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── C : Causes possibles ── */}
      {causes.length > 0 && (
        <div style={card}>
          <KZStepHeader letter="C" letterBg={NAVY} letterColor="#fff" title="Causes possibles" count={`${causes.length} hypothèse${causes.length > 1 ? 's' : ''}`} />
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {causes.map((c, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'#fff', borderRadius:8, border:'1px solid #d0d9ed' }}>
                <span style={{ width:22, height:22, borderRadius:'50%', background:'#e8edf6', border:`1.5px solid ${NAVY}`, color:NAVY, fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i + 1}</span>
                <span style={{ fontSize:13, color:'#1e293b' }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── V : Vérification ── */}
      {checkRows.length > 0 && (
        <div style={card}>
          <KZStepHeader letter="V" letterBg={NAVY} letterColor="#fff" title="Vérification des causes"
            count={`${bonnes.length} BON · ${rejetees.length} rejeté${rejetees.length > 1 ? 'es' : 'e'}`} />
          <div style={{ background:'#fff', border:'1.5px solid #d0d9ed', borderRadius:10, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 110px', background:NAVY, padding:'0 14px' }}>
              {['Cause possible', 'Test réalisé', 'Résultat'].map(h => (
                <div key={h} style={{ padding:'9px 6px', fontSize:10, fontWeight:700, color:'#fff', textTransform:'uppercase', letterSpacing:'.7px' }}>{h}</div>
              ))}
            </div>
            {checkRows.map((r, i) => {
              const isValide = r.resultat === 'valide'
              const isRejete = r.resultat === 'rejete'
              return (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 110px', padding:'0 14px', borderBottom: i < checkRows.length - 1 ? '1px solid #eef2f7' : 'none', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <div style={{ padding:'10px 6px', fontSize:12.5, color:'#1e293b', fontWeight:600 }}>{r.cause || '—'}</div>
                  <div style={{ padding:'10px 6px', fontSize:12, color:'#475569' }}>{r.test || <span style={{ color:'#cbd5e1', fontStyle:'italic' }}>—</span>}</div>
                  <div style={{ padding:'10px 6px' }}>
                    {isValide && <span style={{ fontSize:11, fontWeight:700, color:'#059669', background:'#ecfdf5', border:'1px solid #a7f3d0', borderRadius:20, padding:'2px 9px', whiteSpace:'nowrap' }}>✓ BON</span>}
                    {isRejete && <span style={{ fontSize:11, fontWeight:700, color:'#dc2626', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:20, padding:'2px 9px', whiteSpace:'nowrap' }}>✗ Rejeté</span>}
                    {!r.resultat && <span style={{ fontSize:11, color:'#cbd5e1' }}>—</span>}
                  </div>
                </div>
              )
            })}
          </div>
          {checkRows.some(r => r.pieceJointe) && (
            <div style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap' }}>
              {checkRows.filter(r => r.pieceJointe).map((r, i) => {
                const pjName = r.pieceJointe?.name || (typeof r.pieceJointe === 'string' ? r.pieceJointe : '')
                const pjUrl  = r.pieceJointe?.url || null
                return (
                  <a key={i} href={pjUrl || undefined} target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:'#eef2f7', border:'1px solid #d0d9ed', borderRadius:7, fontSize:11.5, color:NAVY, fontWeight:600, textDecoration: pjUrl ? 'underline' : 'none', cursor: pjUrl ? 'pointer' : 'default' }}>
                    <span>📎</span>{pjName}
                  </a>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── A : Causes confirmées à traiter ── */}
      {rejetees.length > 0 && (
        <div style={card}>
          <KZStepHeader letter="A" letterBg={NAVY} letterColor="#fff" title="Causes confirmées — à traiter" count={`${rejetees.length} cause${rejetees.length > 1 ? 's' : ''}`} />
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {rejetees.map((r, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 13px', background:'#fff', borderRadius:8, border:'1.5px solid #d0d9ed' }}>
                <span style={{ width:22, height:22, borderRadius:'50%', background:'#fef2f2', border:'1.5px solid #fecaca', color:'#dc2626', fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✗</span>
                <span style={{ fontSize:13, color:'#1e293b', fontWeight:600 }}>{r.cause}</span>
                {r.pieceJointe && (() => {
                  const pjName = r.pieceJointe?.name || (typeof r.pieceJointe === 'string' ? r.pieceJointe : '')
                  const pjUrl  = r.pieceJointe?.url || null
                  return <a href={pjUrl || undefined} target="_blank" rel="noreferrer" style={{ marginLeft:'auto', fontSize:11, color:NAVY, textDecoration: pjUrl ? 'underline' : 'none' }}>📎 {pjName}</a>
                })()}
              </div>
            ))}
          </div>
          <div style={{ marginTop:10, fontSize:11, color:NAVY, fontWeight:600 }}>
            ↓ Ces causes génèrent les actions correctives du plan ci-dessous
          </div>
        </div>
      )}

    </div>
  )
}

const STATUT_ACTION_CFG = {
  'cloture':      { label: 'Clôturé',      bg: C.greenBg,  color: C.green },
  'en-cours':     { label: 'En cours',     bg: C.orangeBg, color: C.orange },
  'retard':       { label: 'En retard',    bg: '#fff7ed',  color: '#ea580c' },
  'pas-commence': { label: 'Non commencé', bg: C.redBg,    color: C.red },
}

// ── Tableau actions lecture seule ────────────────────────────────────────────
function ReadOnlyActions({ actions, rcaStartDate }) {
  if (!actions?.length) return null
  const rcaDay = rcaStartDate ? rcaStartDate.slice(0, 10) : null
  const COLS = '40px 1fr 1fr 110px 140px 120px 110px'
  const HEADS = ['Rang', 'Cause racine', 'Action corrective', 'N° OT', 'Participant', 'Délai', 'Statut']
  return (
    <div style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:COLS, background:'#f8fafc', borderBottom:'1.5px solid #e2e8f0', padding:'0 12px' }}>
          {HEADS.map((h, i) => (
            <div key={h} style={{ padding:'10px 8px', fontSize:10.5, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', textAlign: i === 0 ? 'center' : 'left' }}>{h}</div>
          ))}
        </div>
        {actions.map((a, i) => {
          const sc = STATUT_ACTION_CFG[a.statut] || { label: a.statut || '—', bg: '#f1f5f9', color: '#64748b' }
          const isOverdue = a.delai && a.statut !== 'cloture' && rcaDay && a.delai !== rcaDay
          return (
            <div key={a.id || i} style={{ display:'grid', gridTemplateColumns:COLS, padding:'0 12px', borderBottom: i < actions.length - 1 ? '1px solid #f1f5f9' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <div style={{ padding:'12px 8px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:22, height:22, borderRadius:'50%', background:'#e2e8f0', fontSize:10.5, fontWeight:700, color:'#64748b' }}>{i + 1}</span>
              </div>
              <div style={{ padding:'12px 8px' }}>
                {a.cause ? (
                  <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:7, padding:'6px 9px' }}>
                    <div style={{ fontSize:9, fontWeight:800, color:'#059669', letterSpacing:'.7px', textTransform:'uppercase', marginBottom:3 }}>✦ Cause racine</div>
                    <div style={{ fontSize:12, color:'#0f172a', lineHeight:1.5 }}>{a.cause}</div>
                  </div>
                ) : <span style={{ fontSize:12, color:'#94a3b8' }}>—</span>}
              </div>
              <div style={{ padding:'12px 8px', fontSize:12.5, color:'#374151', fontWeight:500, lineHeight:1.5 }}>{a.action || '—'}</div>
              <div style={{ padding:'12px 8px', fontSize:11.5, color:'#475569', fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>{a.ot || '—'}</div>
              <div style={{ padding:'12px 8px', fontSize:12, color:'#374151' }}>{a.responsable || '—'}</div>
              <div style={{ padding:'12px 8px', fontSize:12, color: isOverdue ? '#dc2626' : '#374151', fontWeight: isOverdue ? 600 : 400 }}>
                {a.delai ? formatDate(a.delai) : '—'}
                {isOverdue && <div style={{ fontSize:10, color:'#dc2626', fontWeight:700, marginTop:2 }}>⚠ Dépassé</div>}
              </div>
              <div style={{ padding:'12px 8px' }}>
                <span style={{ fontSize:10.5, fontWeight:600, padding:'2px 9px', borderRadius:99, background:sc.bg, color:sc.color, whiteSpace:'nowrap' }}>
                  {sc.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
  )
}

function SectionTitle({ children, icon }) {
  const getIconShape = (type) => {
    const common = { width:16, height:16, fill:'none', stroke:'#1f2937', strokeWidth:1.8, strokeLinecap:'round', strokeLinejoin:'round' }
    switch (type) {
      case '⚠️':
      case 'warning':
        return (
          <svg {...common} viewBox="0 0 24 24"><path d="M12 4.5 4.5 19h15L12 4.5z"/><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="1"/></svg>
        )
      case '🌳':
      case 'tree':
        return (
          <svg {...common} viewBox="0 0 24 24"><path d="M12 3c-2.2 0-4 1.8-4 4 0 1.2.6 2.2 1.5 2.8L9 11H6.5C5.7 11 5 11.7 5 12.5S5.7 14 6.5 14H9v5h6v-5h2.5c.8 0 1.5-.7 1.5-1.5S18.3 11 17.5 11H15l-.5-1.2C15.4 9.2 16 8.2 16 7c0-2.2-1.8-4-4-4z"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
        )
      case '📋':
      case 'actions':
        return (
          <svg {...common} viewBox="0 0 24 24"><path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>
        )
      case '👥':
      case 'participants':
        return (
          <svg {...common} viewBox="0 0 24 24"><path d="M8 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/><path d="M16 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/><path d="M4 21c0-3.3 2.7-6 6-6h4c3.3 0 6 2.7 6 6"/></svg>
        )
      default:
        return null
    }
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:14 }}>
      {icon && <span style={{ display:'inline-flex', width:20, height:20 }}>{getIconShape(icon)}</span>}
      <span style={{ fontSize:11, fontWeight:800, color:'#475569', textTransform:'uppercase', letterSpacing:'.9px', whiteSpace:'nowrap' }}>{children}</span>
      <div style={{ flex:1, height:1, background:'linear-gradient(90deg,#e2e8f0 0%,transparent 100%)' }} />
    </div>
  )
}

// ── Modal détail complet ─────────────────────────────────────────────────────
function GlobalRCADetail({ rca: initialRca, onClose }) {
  const [rca, setRca] = useState(initialRca)

  useEffect(() => {
    api.getClosedSessionsAll().then(sessions => {
      const updated = sessions.find(s => s.id === initialRca.id)
      if (updated) setRca({
          ...updated,
          equipLabel:   updated.equipId,
          _site:        updated.siteName || updated.siteId,
          equipNiveau:  initialRca.equipNiveau  || null,
          equipFamille: initialRca.equipFamille || null,
        })
    }).catch(() => {})
  }, [initialRca.id])

  if (!rca) return null

  const noeuds       = rca.noeuds || []
  const methode      = rca.methode
  const actions      = rca.actionsGenerees || []
  const participants = Array.isArray(rca.participants) ? rca.participants : []

  function formatDuree(ms) {
    if (!ms || ms < 1000) return '—'
    const s = Math.floor(ms / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (h > 0) return `${h}h ${m.toString().padStart(2,'0')}min`
    if (m > 0) return `${m}min`
    return `${s}s`
  }

  useEffect(() => {
    if (!document.getElementById('gv-anim')) {
      const s = document.createElement('style')
      s.id = 'gv-anim'
      s.textContent = [
        '@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}',
        '@keyframes fadeOverlay{from{opacity:0}to{opacity:1}}',
      ].join('')
      document.head.appendChild(s)
    }
  }, [])

  const isKaizen = methode === 'kaizen' || methode === 1 || methode === '1'
  const accentGradient = isKaizen
    ? 'linear-gradient(90deg,#d97706,#fbbf24,#d97706)'
    : 'linear-gradient(90deg,#1a3a6b,#3b82f6,#1a3a6b)'

  const KPI_ITEMS = [
    { label:'NIVEAU',        value: rca.equipNiveau  || null },
    { label:'EQ/SEQ',        value: rca.equipFamille || null },
    { label:'CUMUL ARRÊT',   value: rca.cumulArret != null ? `${rca.cumulArret} h` : null },
    { label:'FRÉQUENCE',     value: rca.frequence  != null ? `${rca.frequence} /mois` : null },
    { label:'DURÉE ANALYSE', value: formatDuree(rca.tempsAnalyse) !== '—' ? formatDuree(rca.tempsAnalyse) : null },
    { label:'ZONE',          value: rca.zone || null },
  ].filter(k => k.value)

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(10,20,48,0.55)', display:'flex', alignItems:'stretch', justifyContent:'flex-end', backdropFilter:'blur(2px)', animation:'fadeOverlay .2s ease' }}
      onClick={onClose}
    >
      <div
        style={{ width:'min(960px, 96vw)', height:'100vh', background:'#f4f6fa', display:'flex', flexDirection:'column', boxShadow:'-12px 0 48px rgba(0,0,0,0.22)', overflow:'hidden', animation:'slideInRight .28s cubic-bezier(.22,.68,0,1.2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Accent strip ── */}
        <div style={{ height:4, background:accentGradient, flexShrink:0 }} />

        {/* ── Header ── */}
        <div style={{ background:'#fff', borderBottom:'1.5px solid #e2e8f0', padding:'18px 28px 16px', flexShrink:0 }}>
          {/* Row 1: badges + close */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, background:'#f0fdf4', border:'1px solid #a7f3d0', fontSize:11.5, fontWeight:700, color:'#059669' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                Clôturée
              </span>
              <span style={{ fontSize:11, color:'#94a3b8', fontFamily:"'JetBrains Mono',monospace", padding:'3px 8px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6 }}>{rca.id}</span>
              <SiteBadge site={rca._site} />
              {methode && <MethodeBadge methode={methode} />}
            </div>
            <button onClick={onClose} style={{ width:34, height:34, borderRadius:9, border:'1.5px solid #e2e8f0', background:'#f8fafc', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', flexShrink:0, transition:'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.background='#fef2f2'; e.currentTarget.style.borderColor='#fca5a5'; e.currentTarget.style.color='#dc2626' }}
              onMouseLeave={e => { e.currentTarget.style.background='#f8fafc'; e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#64748b' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Row 2: equipment name */}
          <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:20, color:'#0f1f3d', lineHeight:1.2, marginBottom: KPI_ITEMS.length ? 14 : 0 }}>
            {rca.equipLabel || rca.equipId || '—'}
          </div>

          {/* Row 3: KPI chips */}
          {KPI_ITEMS.length > 0 && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {KPI_ITEMS.map(({ label, value }) => (
                <div key={label} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 13px', borderRadius:20, background:'#f8fafc', border:'1px solid #e2e8f0' }}>
                  <span style={{ fontSize:9, fontWeight:800, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.8px' }}>{label}</span>
                  <span style={{ fontSize:12.5, fontWeight:700, color:'#334155', fontFamily:"'Sora',sans-serif" }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:22 }}>

            {/* Dates */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div style={{ background:'#eef2f7', borderRadius:10, padding:'16px', border:'1px solid #d1d5db', borderLeft:'4px solid #0f1f3d' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:10, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'.7px', marginBottom:8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f1f3d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16"/><path d="M8 2v5"/><path d="M16 2v5"/></svg>
                  Date heure début
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:'#0f1f3d' }}>{formatDateTime(rca.dateHeureDebut)}</div>
              </div>
              <div style={{ background:'#eef2f7', borderRadius:10, padding:'16px', border:'1px solid #d1d5db', borderLeft:'4px solid #0f1f3d' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:10, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'.7px', marginBottom:8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f1f3d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16"/><path d="M8 2v5"/><path d="M16 2v5"/></svg>
                  Date heure fin (clôture)
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:'#0f1f3d' }}>{formatDateTime(rca.dateHeureFin)}</div>
              </div>
            </div>

            {/* Cause d'arrêt */}
            {rca.causeArret && (
              <div>
                <SectionTitle icon="⚠️">Cause d'arrêt</SectionTitle>
                <div style={{ background:'#fff', borderRadius:10, padding:'14px 18px', border:'1.5px solid #e2e8f0', borderLeft:'4px solid #f59e0b', fontSize:13.5, color:'#374151', lineHeight:1.65 }}>
                  {rca.causeArret}
                </div>
              </div>
            )}

            {/* ── Analyse ── */}
            {methode && (
              <div>
                <SectionTitle icon={isKaizen ? '⚡' : '🌳'}>
                  {isKaizen ? 'Analyse Quick Kaizen' : 'Arbre des causes — 5 Pourquoi'}
                </SectionTitle>
                {!isKaizen && <ReadOnlyFiveWhyTree noeuds={noeuds} phenomene={rca.phenomene} />}
                {isKaizen  && <ReadOnlyKaizen noeuds={noeuds} />}
              </div>
            )}

            {/* Actions */}
            {actions.length > 0 && (
              <div>
                <SectionTitle icon="📋">Plan d'actions correctives</SectionTitle>
                <ReadOnlyActions actions={actions} rcaStartDate={rca.dateHeureDebut} />
              </div>
            )}

            {/* Notice */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 16px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:9, fontSize:12, color:'#92400e' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Vue en lecture seule — les modifications doivent être effectuées depuis le site concerné.
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

const METHODE_BADGE = {
  '5why':   { label: 'Arbre De Causes', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  '2':      { label: 'Arbre De Causes', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  2:        { label: 'Arbre De Causes', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  'kaizen': { label: 'Quick Kaizen',    bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  '1':      { label: 'Quick Kaizen',    bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  1:        { label: 'Quick Kaizen',    bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
}

function MethodeBadge({ methode }) {
  const m = METHODE_BADGE[methode] || { label: methode || '—', bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:7, fontSize:11, fontWeight:700, background:m.bg, color:m.color, border:`1.5px solid ${m.border}`, whiteSpace:'nowrap' }}>
      {m.label}
    </span>
  )
}

const PART_COLORS = ['#1a3a6b','#059669','#d97706','#dc2626','#7c3aed','#0891b2']

// ── Page principale ──────────────────────────────────────────────────────────
export default function GlobalViewPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const userSite = user?.site || null
  const [filterSite,  setFilterSite]  = useState('others')
  const [search,      setSearch]      = useState('')
  const [selectedRCA, setSelectedRCA] = useState(null)
  const [allRCAs,     setAllRCAs]     = useState([])
  const [globalNewCount, setGlobalNewCount] = useState(0)
  const [globalSeenAt, setGlobalSeenAt] = useState(() => user?.id ? getGlobalTrackingSeenAt(user.id) : 0)

  const loadRCAs = useCallback(() => {
    Promise.all([api.getClosedSessionsAll(), api.getEquipements()])
      .then(([sessions, equips]) => {
        const equipMap = {}
        equips.forEach(e => {
          equipMap[e.id] = {
            designation: e.designation || e.id,
            niveau:      e.entite  || null,
            famille:     e.famille || null,
          }
        })
        const closed = sessions.map(s => ({
          ...s,
          equipLabel:   equipMap[s.equipId]?.designation || s.equipId,
          equipNiveau:  equipMap[s.equipId]?.niveau      || null,
          equipFamille: equipMap[s.equipId]?.famille     || null,
          _site:        s.siteName || s.siteId || '—',
        }))

        const seenAt = user?.id ? getGlobalTrackingSeenAt(user.id) : 0
        const latestTs = sessions.reduce((max, s) => Math.max(max, getClosedSessionTimestamp(s)), 0)

        if (user?.id) {
          setGlobalTrackingSeenAt(user.id, latestTs || Date.now())
          setGlobalSeenAt(latestTs || Date.now())
          setGlobalNewCount(0)
        } else {
          const newCount = seenAt
            ? sessions.filter(s => String(s.siteId) !== String(user?.site_id) && getClosedSessionTimestamp(s) > seenAt).length
            : 0
          setGlobalNewCount(newCount)
        }

        setAllRCAs(closed)
      }).catch(() => {})
  }, [user?.id, user?.site_id])

  useEffect(() => { loadRCAs() }, [loadRCAs])

  useEffect(() => {
    window.addEventListener('focus', loadRCAs)
    window.addEventListener('jesaClosedRcaNotification', loadRCAs)
    window.addEventListener('storage', loadRCAs)
    return () => {
      window.removeEventListener('focus', loadRCAs)
      window.removeEventListener('jesaClosedRcaNotification', loadRCAs)
      window.removeEventListener('storage', loadRCAs)
    }
  }, [loadRCAs])

  const siteOptions = useMemo(() => {
    const s = new Set(allRCAs.map(r => r._site).filter(Boolean).filter(site => site !== userSite))
    return ['others', ...Array.from(s)]
  }, [allRCAs, userSite])

  const filtered = useMemo(() => {
    let list = allRCAs.filter(r => userSite ? r._site !== userSite : true)
    if (filterSite !== 'others') {
      list = list.filter(r => r._site === filterSite)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        (r.equipId || '').toLowerCase().includes(q) ||
        (r.equipLabel || '').toLowerCase().includes(q) ||
        (r.id || '').toLowerCase().includes(q) ||
        (r.causeArret || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [allRCAs, filterSite, search, userSite])

  const nbArbre  = allRCAs.filter(r => r.methode === '5why'   || r.methode === 2 || r.methode === '2').length
  const nbKaizen = allRCAs.filter(r => r.methode === 'kaizen' || r.methode === 1 || r.methode === '1').length

  useEffect(() => {
    if (!selectedRCA) return undefined
    const timer = window.setTimeout(() => setSelectedRCA(null), 10000)
    return () => window.clearTimeout(timer)
  }, [selectedRCA])

  function handleLogout() { logout(); navigate('/login', { replace:true }) }
  const initials = user?.username?.slice(0,2).toUpperCase() || '??'

  const thS = {
    padding: '11px 16px', fontSize: 10.5, fontWeight: 700, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '.07em',
    background: '#f8fafc', borderBottom: '2px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap', textAlign: 'left',
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f4f6fa', fontFamily:"'DM Sans','Inter',sans-serif" }}>

      {/* ── Header ── */}
      <header style={{ background:'#fff', borderBottom:'1px solid #e2e8f0', padding:'0 32px', height:62, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:50, boxShadow:'0 1px 4px rgba(15,30,53,.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button onClick={() => navigate('/hub')}
            style={{ background:'none', border:'1.5px solid #e2e8f0', borderRadius:8, padding:'6px 12px', cursor:'pointer', color:'#475569', display:'flex', alignItems:'center', gap:6, fontSize:12.5, fontFamily:"'DM Sans',sans-serif", transition:'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#1a3a6b'; e.currentTarget.style.color='#1a3a6b' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#475569' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            HUB
          </button>
          <div style={{ width:1, height:28, background:'#e2e8f0' }} />
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:32, height:32, borderRadius:8, background:'#eef2f9', border:'1.5px solid #c7d4eb' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a3a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><polyline points="9 12 11 14 15 10"/></svg>
            </span>
            <div>
              <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:14.5, color:'#0f1f3d', letterSpacing:'-.1px' }}>Vue Globale — RCA Clôturées</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:1 }}>Lecture seule · Autres sites uniquement · Cliquez sur une ligne pour consulter</div>
            </div>
            {globalNewCount > 0 && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:999, background:'#fef2f2', border:'1px solid #fecaca', color:'#c2410c', fontSize:12, fontWeight:700 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#dc2626', display:'inline-block' }} />
                {globalNewCount} nouvelle{globalNewCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:'#0f1f3d', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>{initials}</div>
            <div style={{ fontSize:13, color:'#374151', fontWeight:600 }}>{user?.username}</div>
          </div>
          <button onClick={handleLogout}
            style={{ background:'none', border:'1.5px solid #e2e8f0', borderRadius:8, padding:'6px 14px', fontSize:12.5, color:'#64748b', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#dc2626'; e.currentTarget.style.color='#dc2626' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#64748b' }}>
            Déconnexion
          </button>
        </div>
      </header>

      <div style={{ padding:'28px 36px' }}>

        {/* ── Stats + Filtres ── */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>

          {/* Badges stats */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, background:'#ecfdf5', border:'1px solid #a7f3d0' }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#059669', flexShrink:0 }} />
            <span style={{ fontSize:12, fontWeight:700, color:'#059669' }}>{allRCAs.length} analyse{allRCAs.length !== 1 ? 's' : ''} clôturée{allRCAs.length !== 1 ? 's' : ''}</span>
          </div>
          {nbArbre > 0 && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, background:'#fef2f2', border:'1px solid #fecaca' }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#dc2626' }}>{nbArbre} Arbre De Causes</span>
            </div>
          )}
          {nbKaizen > 0 && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:20, background:'#fffbeb', border:'1px solid #fde68a' }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#d97706' }}>{nbKaizen} Quick Kaizen</span>
            </div>
          )}

          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            {/* Recherche */}
            <div style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 12px', borderRadius:8, background:'#fff', border:'1.5px solid #e2e8f0', minWidth:220 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un équipement, cause…"
                style={{ border:'none', outline:'none', background:'transparent', fontSize:12.5, color:'#0f172a', fontFamily:"'DM Sans',sans-serif", width:'100%' }} />
              {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:14, lineHeight:1 }}>✕</button>}
            </div>
            {/* Filtre site */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <label style={{ fontSize:12.5, color:'#64748b', fontWeight:500, whiteSpace:'nowrap' }}>Site :</label>
              <select value={filterSite} onChange={e => setFilterSite(e.target.value)}
                style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:12.5, color:'#374151', background:'#fff', cursor:'pointer', outline:'none', fontFamily:"'DM Sans',sans-serif" }}>
                <option value="others">Tous les autres sites</option>
                {siteOptions.filter(s => s !== 'others').map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Tableau ── */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden', boxShadow:'0 2px 12px rgba(15,30,53,.06)' }}>
          {allRCAs.length === 0 ? (
            <div style={{ padding:'64px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
              <div style={{ width:56, height:56, borderRadius:14, background:'#f0fdf4', border:'1.5px solid #a7f3d0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><polyline points="9 12 11 14 15 10"/></svg>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#334155', marginBottom:4 }}>Aucune analyse clôturée</div>
                <div style={{ fontSize:12, color:'#94a3b8' }}>Les analyses RCA clôturées apparaîtront ici automatiquement</div>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:'48px 24px', textAlign:'center', fontSize:13, color:'#94a3b8' }}>
              Aucun résultat pour «&nbsp;{search || filterSite}&nbsp;»
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thS, width:52, textAlign:'center' }}>Rang</th>
                    <th style={{ ...thS, width:'14%' }}>Poste technique</th>
                    <th style={{ ...thS, width:'18%' }}>Désignation du poste technique</th>
                    <th style={{ ...thS, width:80 }}>Site</th>
                    <th style={{ ...thS, width:150 }}>Méthode</th>
                    <th style={{ ...thS }}>Cause d'arrêt</th>
                    <th style={{ ...thS, width:140 }}>Participants</th>
                    <th style={{ ...thS, width:115 }}>Clôturé le</th>
                    <th style={{ ...thS, width:90, borderRight:'none', textAlign:'center' }}>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((rca, idx) => {
                    const isLast = idx === filtered.length - 1
                    const parts = Array.isArray(rca.participants) ? rca.participants : []
                    const td = (extra={}) => ({
                      padding:'13px 16px', verticalAlign:'middle', fontSize:13, color:'#475569',
                      borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                      borderRight:'1px solid #f1f5f9', ...extra
                    })
                    return (
                      <tr key={rca.id || idx}
                        onClick={() => setSelectedRCA(rca)}
                        style={{ cursor:'pointer', transition:'background .1s' }}
                        onMouseEnter={e => e.currentTarget.style.background='#f0f6ff'}
                        onMouseLeave={e => e.currentTarget.style.background=''}>

                        {/* # */}
                        <td style={td({ textAlign:'center', background:'#fafcff' })}>
                          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:27, height:27, borderRadius:7, background:'#f1f5f9', border:'1px solid #e2e8f0', fontSize:11, fontWeight:700, color:'#64748b' }}>
                            {idx + 1}
                          </div>
                        </td>

                        {/* Poste technique */}
                        <td style={td()}>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:12.5, color:'#1a3a6b' }}>{rca.equipId || '—'}</div>
                          <div style={{ fontSize:10.5, color:'#94a3b8', fontFamily:"'JetBrains Mono',monospace" }}>{rca.id}</div>
                        </td>

                        {/* Désignation */}
                        <td style={td()}>
                          <div style={{ fontWeight:600, fontSize:13, color:'#374151' }}>{rca.equipLabel || '—'}</div>
                        </td>

                        {/* Site */}
                        <td style={td()}><SiteBadge site={rca._site} /></td>

                        {/* Méthode */}
                        <td style={td()}><MethodeBadge methode={rca.methode} /></td>

                        {/* Cause */}
                        <td style={td({ color:'#475569' })}>
                          <span style={{ lineHeight:1.5 }}>{rca.causeArret || '—'}</span>
                        </td>

                        {/* Participants */}
                        <td style={td()}>
                          <div style={{ display:'flex' }}>
                            {parts.slice(0,4).map((p, i) => {
                              const nom = typeof p === 'string' ? p : (p.nom || '?')
                              const ini = nom.trim().split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()
                              const col = PART_COLORS[i % PART_COLORS.length]
                              return (
                                <div key={i} title={nom} style={{ width:28, height:28, borderRadius:'50%', background:col, color:'#fff', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #fff', marginLeft: i>0 ? -8 : 0, flexShrink:0 }}>{ini}</div>
                              )
                            })}
                            {parts.length > 4 && <div style={{ width:28, height:28, borderRadius:'50%', background:'#e2e8f0', color:'#64748b', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #fff', marginLeft:-8 }}>+{parts.length-4}</div>}
                            {parts.length === 0 && <span style={{ fontSize:12, color:'#94a3b8' }}>—</span>}
                          </div>
                        </td>

                        {/* Date clôture */}
                        <td style={td({ color:'#059669', fontWeight:600 })}>
                          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            {formatDate(rca.dateHeureFin)}
                          </div>
                        </td>

                        {/* Détail */}
                        <td style={td({ borderRight:'none', textAlign:'center' })}>
                          <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:8, background:'#eff6ff', border:'1.5px solid #bfdbfe', color:'#1a3a6b' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          </div>
                        </td>

                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sync notice */}
        <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#94a3b8' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Données synchronisées automatiquement à chaque modification
        </div>
      </div>

      {selectedRCA && <GlobalRCADetail rca={selectedRCA} onClose={() => setSelectedRCA(null)} />}
    </div>
  )
}
