// src/components/dashboard/DashboardPage.jsx
// Dashboard Fiabilité — synchronisé avec jesa_arrets + jesa_rca_sessions + jesa_seuils

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import C from '../../tokens/colors'
import { getStatut, calcCumul, calcFrequence } from '../../hooks/useTUM'
import useTUM from '../../hooks/useTUM'
import { api } from '../../lib/api'
import { DEFAULT_SEUILS } from '../../data/seuils'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MOIS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const EQSEQ_COLORS = {
  'STADE OP':        '#1a3a6b',
  'CAPITAL':         '#059669',
  'SOUS-EQUIPEMENT': '#d97706',
}
const FALLBACK_COLORS = ['#94a3b8','#f59e0b','#06b6d4','#8b5cf6','#ec4899','#84cc16']
function getFamille(equipId, niveauEqSeq) {
  if (niveauEqSeq) {
    const eqSeq = niveauEqSeq.split(' - ').pop()?.trim()
    if (eqSeq && EQSEQ_COLORS[eqSeq]) return { label: eqSeq, color: EQSEQ_COLORS[eqSeq] }
    if (eqSeq) return { label: eqSeq, color: '#94a3b8' }
  }
  const prefix = equipId?.split('-')[0]?.toUpperCase()
  return { label: prefix || 'Autre', color: '#94a3b8' }
}

function getPeriodBounds(periode) {
  const days = { semaine: 7, mois: 30, trimestre: 90 }[periode] || 30
  const fin = new Date(); fin.setHours(23, 59, 59, 999)
  const debut = new Date(fin - days * 86_400_000); debut.setHours(0, 0, 0, 0)
  return { debut, fin, periodHours: days * 24 }
}

function getLast6Months() {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1); d.setMonth(d.getMonth() - (5 - i))
    const debut = new Date(d.getFullYear(), d.getMonth(), 1)
    const fin   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
    return { mois: MOIS_FR[d.getMonth()], debut, fin }
  })
}

function calcAvancement(s) {
  if (s.statut === 'cloturee') return 100
  if (s.statut === 'non-commencee') return 0
  if (s.actionsGenerees?.length > 0) return 75
  if (s.noeuds?.length > 2) return 50
  if (s.noeuds?.length > 0) return 30
  return 15
}


// ─── Graphiques SVG ───────────────────────────────────────────────────────────
function ParetoSVGCumul({ items }) {
  const [hovered, setHovered] = useState(null)
  const minBarStep = 58
  const pad = { top: 30, right: 64, bottom: 150, left: 56 }
  const n = items.length
  const W = Math.max(720, pad.left + pad.right + n * minBarStep)
  const H = 420
  const gW = W - pad.left - pad.right
  const gH = H - pad.top - pad.bottom
  const maxCumul = Math.max(...items.map(d => d.cumul), 0.1)
  const step = gW / Math.max(n, 1)
  const bW = Math.min(step * 0.62, 44)
  const total = items.reduce((s, d) => s + d.cumul, 0)
  let running = 0
  const withPct = items.map(item => {
    const pct = total > 0 ? (item.cumul / total) * 100 : 0
    const prevRunning = running
    running += pct
    return { ...item, cumulPct: Math.min(running, 100), isBadActor: prevRunning < 80 }
  })
  const pts = withPct.map((item, i) => ({
    cx: pad.left + i * step + step / 2,
    cy: pad.top + gH * (1 - item.cumulPct / 100),
    pct: item.cumulPct,
  }))
  const curvePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(' ')
  const y80 = pad.top + gH * 0.2
  const labelStep = n > 20 ? 5 : n > 10 ? 3 : n > 6 ? 2 : 1
  const ptsToLabel = pts.filter((_, i) => i % labelStep === 0 || i === pts.length - 1)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: W, height: '340px', display: 'block', overflow: 'visible', background: '#fff' }}>
      <defs>
        {withPct.map((item, i) => (
          <linearGradient key={i} id={`dbgC${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={item.isBadActor ? '#1a3a6b' : '#94a3b8'} stopOpacity="1" />
            <stop offset="100%" stopColor={item.isBadActor ? '#3b72c4' : '#cbd5e1'} stopOpacity="0.75" />
          </linearGradient>
        ))}
      </defs>
      <rect x={pad.left} y={pad.top} width={gW} height={gH * 0.2} fill="#fef2f2" opacity="0.45" />
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const y = pad.top + gH * (1 - p)
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={pad.left + gW} y2={y} stroke={C.border} strokeWidth="1" strokeDasharray="3,5" />
            <text x={pad.left - 6} y={y + 4} fontSize="10" fill={C.text4} textAnchor="end" fontFamily="DM Sans,sans-serif">{(maxCumul * p).toFixed(1)}h</text>
          </g>
        )
      })}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + gH} stroke={C.border2} strokeWidth="1.5" />
      <line x1={pad.left} y1={pad.top + gH} x2={pad.left + gW} y2={pad.top + gH} stroke={C.border2} strokeWidth="1.5" />
      {withPct.map((item, i) => {
        const barH = Math.max((item.cumul / maxCumul) * gH, 2)
        const x = pad.left + i * step + (step - bW) / 2
        const y = pad.top + gH - barH
        const isHov = hovered === item.id
        return (
          <g key={item.id} onMouseEnter={() => setHovered(item.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
            {item.isBadActor && <rect x={x} y={y - 3} width={bW} height={3} rx="1.5" fill="#dc2626" opacity="0.85" />}
            <rect x={x} y={y} width={bW} height={barH} fill={`url(#dbgC${i})`} rx="4" opacity={isHov ? 1 : 0.9} />
            {(n <= 18 || isHov) && (
              <text x={x + bW / 2} y={y - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill={item.isBadActor ? C.navy : C.text4} fontFamily="Sora,sans-serif" opacity={isHov || item.isBadActor ? 1 : 0.65}>{item.cumul.toFixed(1)}h</text>
            )}
            <text x={x + bW / 2} y={pad.top + gH + 10} textAnchor="end" fontSize={n > 20 ? '8' : '9.5'} fill={item.isBadActor ? C.navy : C.text4} fontWeight={item.isBadActor ? '700' : '400'} fontFamily="DM Sans,sans-serif" transform={`rotate(-45, ${x + bW / 2}, ${pad.top + gH + 10})`}>{item.id}</text>
            {isHov && (
              <g>
                <rect x={Math.min(x + bW / 2 - 80, W - 170)} y={Math.max(y - 52, 2)} width={160} height={42} rx="6" fill="#0f172a" opacity="0.94" />
                <text x={Math.min(x + bW / 2 - 80, W - 170) + 80} y={Math.max(y - 52, 2) + 15} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontFamily="DM Sans,sans-serif">{item.id}</text>
                <text x={Math.min(x + bW / 2 - 80, W - 170) + 80} y={Math.max(y - 52, 2) + 30} textAnchor="middle" fontSize="9.5" fill="#fff" fontFamily="DM Sans,sans-serif">{item.cumul.toFixed(1)}h · {item.freq} arrêt(s) · {(total > 0 ? item.cumul / total * 100 : 0).toFixed(1)}%</text>
              </g>
            )}
          </g>
        )
      })}
      {pts.length > 1 && (
        <>
          <path d={curvePath} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r="3.5" fill="#d97706" stroke="#fff" strokeWidth="1.5" />)}
          {ptsToLabel.map((p, i) => <text key={i} x={p.cx + 6} y={p.cy - 6} fontSize="9" fill="#d97706" fontWeight="700" fontFamily="DM Sans,sans-serif">{p.pct.toFixed(0)}%</text>)}
        </>
      )}
      <line x1={pad.left - 5} y1={y80} x2={pad.left + gW} y2={y80} stroke="#dc2626" strokeWidth="1.8" strokeDasharray="5,3" />
      <rect x={pad.left + gW - 30} y={y80 - 11} width={30} height={15} rx="4" fill="#fef2f2" stroke="#fecaca" strokeWidth="1" />
      <text x={pad.left + gW - 15} y={y80 + 1} textAnchor="middle" fontSize="10" fill="#dc2626" fontWeight="800" fontFamily="DM Sans,sans-serif">80%</text>
      <text x={14} y={pad.top + gH / 2} textAnchor="middle" fontSize="10" fill={C.text3} fontWeight="600" transform={`rotate(-90, 14, ${pad.top + gH / 2})`} fontFamily="DM Sans,sans-serif">Cumul (h)</text>
      <text x={pad.left + gW + 44} y={pad.top + gH / 2} textAnchor="middle" fontSize="10" fill="#d97706" fontWeight="600" transform={`rotate(90, ${pad.left + gW + 44}, ${pad.top + gH / 2})`} fontFamily="DM Sans,sans-serif">% Cumulé</text>
    </svg>
  )
}

function ParetoSVGFreq({ items }) {
  const [hovered, setHovered] = useState(null)
  const sorted = [...items].sort((a, b) => b.freq - a.freq)
  const n = sorted.length
  const minBarStep = 58
  const pad = { top: 30, right: 64, bottom: 150, left: 56 }
  const W = Math.max(720, pad.left + pad.right + n * minBarStep)
  const H = 420
  const gW = W - pad.left - pad.right
  const gH = H - pad.top - pad.bottom
  const maxFreq = Math.max(...sorted.map(d => d.freq), 1)
  const step = gW / Math.max(n, 1)
  const bW = Math.min(step * 0.62, 44)
  const total = sorted.reduce((s, d) => s + d.freq, 0)
  let running = 0
  const withPct = sorted.map(item => {
    const pct = total > 0 ? (item.freq / total) * 100 : 0
    running += pct
    const cumulPct = Math.min(running, 100)
    const prevRunning = running - pct
    return { ...item, cumulPct, isBadActorFreq: prevRunning < 80 }
  })
  const pts = withPct.map((item, i) => ({ cx: pad.left + i * step + step / 2, cy: pad.top + gH * (1 - item.cumulPct / 100), pct: item.cumulPct }))
  const curvePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`).join(' ')
  const y80 = pad.top + gH * 0.2
  const labelStep = n > 20 ? 5 : n > 10 ? 3 : n > 6 ? 2 : 1
  const ptsToLabel = pts.filter((_, i) => i % labelStep === 0 || i === pts.length - 1)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: W, height: '340px', display: 'block', overflow: 'visible', background: '#fff' }}>
      <defs>
        {withPct.map((item, i) => (
          <linearGradient key={i} id={`dbgF${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={item.isBadActorFreq ? '#1a3a6b' : '#94a3b8'} stopOpacity="1" />
            <stop offset="100%" stopColor={item.isBadActorFreq ? '#3b72c4' : '#cbd5e1'} stopOpacity="0.75" />
          </linearGradient>
        ))}
      </defs>
      <rect x={pad.left} y={pad.top} width={gW} height={gH * 0.2} fill="#fef2f2" opacity="0.45" />
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
        const y = pad.top + gH * (1 - p)
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={pad.left + gW} y2={y} stroke={C.border} strokeWidth="1" strokeDasharray="3,5" />
            <text x={pad.left - 6} y={y + 4} fontSize="10" fill={C.text4} textAnchor="end" fontFamily="DM Sans,sans-serif">{Math.round(maxFreq * p)}</text>
          </g>
        )
      })}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + gH} stroke={C.border2} strokeWidth="1.5" />
      <line x1={pad.left} y1={pad.top + gH} x2={pad.left + gW} y2={pad.top + gH} stroke={C.border2} strokeWidth="1.5" />
      {withPct.map((item, i) => {
        const barH = Math.max((item.freq / maxFreq) * gH, 2)
        const x = pad.left + i * step + (step - bW) / 2
        const y = pad.top + gH - barH
        const isHov = hovered === item.id
        return (
          <g key={item.id} onMouseEnter={() => setHovered(item.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
            {item.isBadActorFreq && <rect x={x} y={y - 3} width={bW} height={3} rx="1.5" fill="#dc2626" opacity="0.85" />}
            <rect x={x} y={y} width={bW} height={barH} fill={`url(#dbgF${i})`} rx="4" opacity={isHov ? 1 : 0.9} />
            {(n <= 18 || isHov) && (
              <text x={x + bW / 2} y={y - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill={item.isBadActorFreq ? C.navy : C.text4} fontFamily="Sora,sans-serif" opacity={isHov || item.isBadActorFreq ? 1 : 0.65}>{item.freq}</text>
            )}
            <text x={x + bW / 2} y={pad.top + gH + 10} textAnchor="end" fontSize={n > 20 ? '8' : '9.5'} fill={item.isBadActorFreq ? C.navy : C.text4} fontWeight={item.isBadActorFreq ? '700' : '400'} fontFamily="DM Sans,sans-serif" transform={`rotate(-45, ${x + bW / 2}, ${pad.top + gH + 10})`}>{item.id}</text>
            {isHov && (
              <g>
                <rect x={Math.min(x + bW / 2 - 80, W - 170)} y={Math.max(y - 52, 2)} width={160} height={42} rx="6" fill="#0f172a" opacity="0.94" />
                <text x={Math.min(x + bW / 2 - 80, W - 170) + 80} y={Math.max(y - 52, 2) + 15} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontFamily="DM Sans,sans-serif">{item.id}</text>
                <text x={Math.min(x + bW / 2 - 80, W - 170) + 80} y={Math.max(y - 52, 2) + 30} textAnchor="middle" fontSize="9.5" fill="#fff" fontFamily="DM Sans,sans-serif">{item.freq} arrêts · {item.cumul.toFixed(1)}h · {(total > 0 ? item.freq / total * 100 : 0).toFixed(1)}%</text>
              </g>
            )}
          </g>
        )
      })}
      {pts.length > 1 && (
        <>
          <path d={curvePath} fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r="3.5" fill="#d97706" stroke="#fff" strokeWidth="1.5" />)}
          {ptsToLabel.map((p, i) => <text key={i} x={p.cx + 6} y={p.cy - 6} fontSize="9" fill="#d97706" fontWeight="700" fontFamily="DM Sans,sans-serif">{p.pct.toFixed(0)}%</text>)}
        </>
      )}
      <line x1={pad.left - 5} y1={y80} x2={pad.left + gW} y2={y80} stroke="#dc2626" strokeWidth="1.8" strokeDasharray="5,3" />
      <rect x={pad.left + gW - 30} y={y80 - 11} width={30} height={15} rx="4" fill="#fef2f2" stroke="#fecaca" strokeWidth="1" />
      <text x={pad.left + gW - 15} y={y80 + 1} textAnchor="middle" fontSize="10" fill="#dc2626" fontWeight="800" fontFamily="DM Sans,sans-serif">80%</text>
      <text x={14} y={pad.top + gH / 2} textAnchor="middle" fontSize="10" fill={C.text3} fontWeight="600" transform={`rotate(-90, 14, ${pad.top + gH / 2})`} fontFamily="DM Sans,sans-serif">Fréquence</text>
      <text x={pad.left + gW + 44} y={pad.top + gH / 2} textAnchor="middle" fontSize="10" fill="#d97706" fontWeight="600" transform={`rotate(90, ${pad.left + gW + 44}, ${pad.top + gH / 2})`} fontFamily="DM Sans,sans-serif">% Cumulé</text>
    </svg>
  )
}

function CumulLineChart({ data, seuilN1, seuilN2, title, colorKey }) {
  const [hovered, setHovered] = useState(null)
  const n = data.length
  const minBarStep = 58
  const pad = { top: 48, right: 70, bottom: 150, left: 60 }
  const W = Math.max(720, pad.left + pad.right + n * minBarStep)
  const H = 420
  const gW = W - pad.left - pad.right
  const gH = H - pad.top - pad.bottom
  const sorted = [...data].sort((a, b) => b[colorKey] - a[colorKey])
  const maxVal = Math.max(...sorted.map(d => d[colorKey]), seuilN2 * 1.15, 0.1)
  const step = gW / Math.max(n, 1)
  const bW = Math.min(step * 0.55, 42)
  const yScale = v => pad.top + gH - (v / maxVal) * gH
  const yN1 = yScale(seuilN1)
  const yN2 = yScale(seuilN2)
  const getColor = val => val >= seuilN2 ? '#AD1010' : val >= seuilN1 ? '#F5DD27' : '#009929'
  const pts = sorted.map((item, i) => ({ x: pad.left + i * step + step / 2, y: yScale(item[colorKey]), val: item[colorKey], id: item.id }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '18px 16px 14px', boxShadow: '0 1px 8px rgba(15,30,53,.06)', marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 3, height: 17, background: C.navy, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text2, fontFamily: "'Sora',sans-serif" }}>{title}</span>
      </div>
      <div style={{ fontSize: 10.5, color: C.text4, marginBottom: 10 }}>Équipements triés par ordre décroissant · Seuils N1/N2 selon le paramétrage TUM</div>
      {(() => {
        const nbAlerte = data.filter(d => d[colorKey] >= seuilN2).length
        const nbSurveillance = data.filter(d => d[colorKey] >= seuilN1 && d[colorKey] < seuilN2).length
        const nbNormal = data.filter(d => d[colorKey] < seuilN1).length
        const total = data.length
        return (
          <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: '#f1f5f9', border: `1px solid #e2e8f0`, textAlign: 'center' }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: C.text4, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 3 }}>Total</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{total}</div>
              <div style={{ fontSize: 8.5, color: C.text4, marginTop: 2 }}>équipement{total > 1 ? 's' : ''}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: '#f1f5f9', border: `1px solid #e2e8f0`, textAlign: 'center' }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 3 }}>● Alerte</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#AD1010', fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{nbAlerte}</div>
              <div style={{ fontSize: 8.5, color: C.text4, marginTop: 2 }}>équipement{nbAlerte > 1 ? 's' : ''}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: '#f1f5f9', border: `1px solid #e2e8f0`, textAlign: 'center' }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 3 }}>● Surveillance</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#b45309', fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{nbSurveillance}</div>
              <div style={{ fontSize: 8.5, color: C.text4, marginTop: 2 }}>équipement{nbSurveillance > 1 ? 's' : ''}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: '#f1f5f9', border: `1px solid #e2e8f0`, textAlign: 'center' }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 3 }}>● Normal</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#059669', fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{nbNormal}</div>
              <div style={{ fontSize: 8.5, color: C.text4, marginTop: 2 }}>équipement{nbNormal > 1 ? 's' : ''}</div>
            </div>
          </div>
        )
      })()}
      <div style={{ overflowX: 'auto', background: '#f8fafd', borderRadius: 10, border: `1px solid ${C.border}`, padding: '10px 6px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: W, height: H, display: 'block', overflow: 'visible', background: '#fff', borderRadius: 8 }}>
          <rect x={pad.left} y={pad.top} width={gW} height={Math.max(yN2 - pad.top, 0)} fill="#fef2f2" opacity="0.5" />
          <rect x={pad.left} y={yN2} width={gW} height={Math.max(yN1 - yN2, 0)} fill="#fffbeb" opacity="0.5" />
          <rect x={pad.left} y={yN1} width={gW} height={Math.max(pad.top + gH - yN1, 0)} fill="#f0fdf4" opacity="0.5" />
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
            const y = pad.top + gH * (1 - p)
            return (
              <g key={i}>
                <line x1={pad.left} y1={y} x2={pad.left + gW} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,4" />
                <text x={pad.left - 6} y={y + 4} fontSize="9" fill={C.text4} textAnchor="end" fontFamily="DM Sans,sans-serif">{colorKey === 'cumul' ? (maxVal * p).toFixed(1) + 'h' : Math.round(maxVal * p)}</text>
              </g>
            )
          })}
          <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + gH} stroke={C.border2} strokeWidth="1.5" />
          <line x1={pad.left} y1={pad.top + gH} x2={pad.left + gW} y2={pad.top + gH} stroke={C.border2} strokeWidth="1.5" />
          {sorted.map((item, i) => {
            const x = pad.left + i * step + (step - bW) / 2
            const val = item[colorKey]
            const col = getColor(val)
            const barH = Math.max((val / maxVal) * gH, 2)
            const by = pad.top + gH - barH
            const isHov = hovered === item.id
            return (
              <g key={item.id} onMouseEnter={() => setHovered(item.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
                <rect x={x} y={by} width={bW} height={barH} fill={col} rx="3" opacity={isHov ? 0.85 : 0.65} />
                <text x={pad.left + i * step + step / 2} y={pad.top + gH + 10} textAnchor="end" fontSize={n > 20 ? '7.5' : n > 12 ? '8.5' : '9'} fill={isHov ? C.navy : C.text4} fontWeight={isHov ? '700' : '400'} fontFamily="DM Sans,sans-serif" transform={`rotate(-45, ${pad.left + i * step + step / 2}, ${pad.top + gH + 10})`}>{item.id}</text>
              </g>
            )
          })}
          {pts.length > 1 && <path d={linePath} fill="none" stroke={C.navy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />}
          {pts.map((p, i) => {
            const col = getColor(p.val)
            const isHov = hovered === p.id
            return (
              <g key={i} onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
                <circle cx={p.x} cy={p.y} r={isHov ? 8 : 5.5} fill={col} stroke="#fff" strokeWidth="2" />
                {(n <= 20 || isHov) && <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={col} fontFamily="Sora,sans-serif">{colorKey === 'cumul' ? p.val.toFixed(1) + 'h' : p.val}</text>}
                {isHov && (
                  <g>
                    <rect x={Math.min(p.x - 80, W - 170)} y={Math.max(p.y - 58, 2)} width={160} height={44} rx="7" fill="#0f172a" opacity="0.94" />
                    <text x={Math.min(p.x - 80, W - 170) + 80} y={Math.max(p.y - 58, 2) + 16} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontFamily="DM Sans,sans-serif">{p.id}</text>
                    <text x={Math.min(p.x - 80, W - 170) + 80} y={Math.max(p.y - 58, 2) + 32} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700" fontFamily="Sora,sans-serif">{colorKey === 'cumul' ? p.val.toFixed(1) + 'h' : p.val + ' arrêts'}</text>
                  </g>
                )}
              </g>
            )
          })}
          <line x1={pad.left} y1={yN2} x2={pad.left + gW} y2={yN2} stroke="#dc2626" strokeWidth="2" />
          <rect x={pad.left + gW - 2} y={yN2 - 12} width={68} height={16} rx="4" fill="#fef2f2" stroke="#fecaca" strokeWidth="1" />
          <text x={pad.left + gW + 32} y={yN2 + 1} textAnchor="middle" fontSize="9.5" fill="#dc2626" fontWeight="800" fontFamily="DM Sans,sans-serif">Seuil N2</text>
          <line x1={pad.left} y1={yN1} x2={pad.left + gW} y2={yN1} stroke="#d97706" strokeWidth="1.8" strokeDasharray="6,3" />
          <rect x={pad.left + gW - 2} y={yN1 - 12} width={68} height={16} rx="4" fill="#fffbeb" stroke="#fde68a" strokeWidth="1" />
          <text x={pad.left + gW + 32} y={yN1 + 1} textAnchor="middle" fontSize="9.5" fill="#d97706" fontWeight="800" fontFamily="DM Sans,sans-serif">Seuil N1</text>
        </svg>
      </div>
    </div>
  )
}

function ActionsChart({ data }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.ouvertes, d.cloturees)), 1)
  const H = 110, bw = 16, gap = 4, gapG = 18
  const chartW = data.length * (bw * 2 + gap + gapG) - gapG
  return (
    <svg viewBox={`0 0 ${chartW} ${H + 22}`} width="100%" height={H + 22}>
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1={0} y1={H * (1 - p)} x2={chartW} y2={H * (1 - p)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,4" />
      ))}
      {data.map((d, i) => {
        const x = i * (bw * 2 + gap + gapG)
        const h1 = (d.ouvertes / maxVal) * H
        const h2 = (d.cloturees / maxVal) * H
        return (
          <g key={i}>
            <rect x={x} y={H - h1} width={bw} height={h1} rx="3" fill="#f59e0b" opacity="0.85" />
            <rect x={x + bw + gap} y={H - h2} width={bw} height={h2} rx="3" fill="#10b981" opacity="0.85" />
            <text x={x + bw} y={H + 12} textAnchor="middle" fontSize="9" fill={C.text4} fontFamily="DM Sans,sans-serif">{d.mois}</text>
            <text x={x + bw / 2} y={H - h1 - 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#d97706" fontFamily="DM Sans,sans-serif">{d.ouvertes}</text>
            <text x={x + bw + gap + bw / 2} y={H - h2 - 4} textAnchor="middle" fontSize="8" fontWeight="700" fill="#059669" fontFamily="DM Sans,sans-serif">{d.cloturees}</text>
          </g>
        )
      })}
    </svg>
  )
}

function DonutChart({ data }) {
  if (!data.length) return <EmptyChart label="Aucun arrêt sur la période" />
  const size = 130, r = 46, cx = size / 2, cy = size / 2
  const total = data.reduce((s, d) => s + d.val, 0)
  let angle = -90
  const slices = data.map(d => {
    const sweep = (d.val / total) * 360; const start = angle; angle += sweep
    const r1 = (start * Math.PI) / 180, r2 = ((start + sweep) * Math.PI) / 180
    const x1 = cx + r * Math.cos(r1), y1 = cy + r * Math.sin(r1)
    const x2 = cx + r * Math.cos(r2), y2 = cy + r * Math.sin(r2)
    return { ...d, path: `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z` }
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity="0.88" />)}
        <circle cx={cx} cy={cy} r={30} fill="#fff" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="12" fontWeight="800" fill={C.text} fontFamily="Sora,sans-serif">{total}</text>
        <text x={cx} y={cy + 9} textAnchor="middle" fontSize="7.5" fill={C.text4} fontFamily="DM Sans,sans-serif">pannes</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: C.text2, flex: 1 }}>{d.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 40, height: 3, background: '#e2e8f0', borderRadius: 2 }}>
                <div style={{ width: `${d.val}%`, height: '100%', background: d.color, borderRadius: 2 }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 11.5, color: C.text, minWidth: 26, textAlign: 'right' }}>{d.val}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyChart({ label }) {
  return (
    <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text4, fontSize: 12, background: C.bg2, borderRadius: 8 }}>
      {label || 'Aucune donnée'}
    </div>
  )
}

// ─── UI Components ────────────────────────────────────────────────────────────
function Card({ title, badge, children, style = {} }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,.06)', ...style }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13.5, color: C.text }}>{title}</span>
          {badge && <span style={{ fontSize: 11, fontWeight: 700, color: C.navy, background: C.bluePale, border: `1px solid ${C.blueMid}`, borderRadius: 20, padding: '2px 10px' }}>{badge}</span>}
        </div>
      )}
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  )
}

function SectionHeader({ label, type = 'lagging', subtitle }) {
  const cfg = {
    lagging: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '▼' },
    leading: { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', dot: '▲' },
  }[type]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 4 }}>
      <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.border}`, letterSpacing: '.5px', textTransform: 'uppercase' }}>
        {cfg.dot} {label}
      </span>
      {subtitle && <span style={{ fontSize: 11.5, color: C.text4 }}>{subtitle}</span>}
    </div>
  )
}

function LaggingCard({ icon, label, value, value2, sublabel, color, progress, progressMax, detail }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: `1px solid ${C.border}`, boxShadow: '0 2px 10px rgba(0,0,0,.06)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -24, right: -24, width: 90, height: 90, borderRadius: '50%', background: `${color}12` }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative' }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, background: `${color}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.text4, textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4, lineHeight: 1.3 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 34, color, lineHeight: 1 }}>{value}</span>
            {value2 !== undefined && <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 500, fontSize: 18, color: C.text3 }}>/ {value2}</span>}
          </div>
          {sublabel && <div style={{ fontSize: 11.5, color: C.text3, marginTop: 4 }}>{sublabel}</div>}
        </div>
      </div>
      {progress !== undefined && progressMax ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressMax > 0 ? Math.min((progress / progressMax) * 100, 100) : 0}%`, background: color, borderRadius: 3 }} />
          </div>
          {detail && <div style={{ fontSize: 10.5, color: C.text4, marginTop: 5 }}>{detail}</div>}
        </div>
      ) : detail ? (
        <div style={{ fontSize: 10.5, color: C.text4, marginTop: 10 }}>{detail}</div>
      ) : null}
    </div>
  )
}

function LeadingCard({ abbrev, label, value, unit, sub, color, accent }) {
  return (
    <div style={{ background: accent || '#fff', borderRadius: 14, padding: '16px 14px', border: `1.5px solid ${color}30`, boxShadow: '0 2px 8px rgba(0,0,0,.05)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 900, color, textTransform: 'uppercase', letterSpacing: '1.2px', padding: '2px 8px', borderRadius: 8, background: `${color}15` }}>{abbrev}</div>
      <div style={{ fontSize: 10, color: C.text4, lineHeight: 1.3, minHeight: 26, display: 'flex', alignItems: 'center', textAlign: 'center' }}>{label}</div>
      <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 28, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: `${color}cc` }}>{unit}</div>
      {sub && <div style={{ fontSize: 10, color: C.text4, padding: '2px 8px', borderRadius: 8, background: '#f8fafc', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function IconInline({ children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, marginRight: 6, flexShrink: 0 }}>{children}</span>
  )
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4v6h6" />
      <path d="M20 20v-6h-6" />
      <path d="M5 19a9 9 0 1 0 0-14" />
      <path d="M19 5a9 9 0 1 1 0 14" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86l-7 12A2 2 0 0 0 5 19h14a2 2 0 0 0 1.71-3.14l-7-12a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function RCAIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a3a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M4 12h10" />
      <path d="M4 17h7" />
      <path d="M18 13v6" />
      <path d="M15 16l3 3 3-3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function IdeaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 9a3.5 3.5 0 1 1 5 0c0 2-1.5 2.75-1.5 2.75a1 1 0 0 0-.5.5L12 14" />
      <path d="M12 3v1" />
      <path d="M16 5l-.7.7" />
      <path d="M8 5l.7.7" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  )
}

function ParetoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a3a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17h4" />
      <path d="M3 12h7" />
      <path d="M3 7h14" />
      <path d="M10 17V7l7 7 4-4" />
    </svg>
  )
}

function TrendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 13 14 20 7" />
      <polyline points="20 14 20 7 13 7" />
    </svg>
  )
}

function DonutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10h-4" />
      <path d="M12 2v6" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86l-7 12A2 2 0 0 0 5 19h14a2 2 0 0 0 1.71-3.14l-7-12a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09A1.65 1.65 0 0 0 9 4.6V4a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [periode, setPeriode] = useState('mois')
  const [rawSessions, setRawSessions] = useState([])
  const [lastUpdate,  setLastUpdate]  = useState(null)
  const [exportingPDF, setExportingPDF] = useState(false)
  const dashboardRef = useRef(null)

  const handleExportPDF = async () => {
    if (exportingPDF || !dashboardRef.current) return
    setExportingPDF(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#fff', scrollX: 0, scrollY: -window.scrollY,
      })
      const imgData = canvas.toDataURL('image/png')
      const imgW = canvas.width, imgH = canvas.height
      const pdfW = 1190
      const pdfH = Math.round((imgH / imgW) * pdfW)
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [pdfW, pdfH + 40] })
      pdf.setFillColor(11, 46, 99)
      pdf.rect(0, 0, pdfW, 34, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(13); pdf.setFont('helvetica', 'bold')
      pdf.text('JESA Reliability Hub — Dashboard Fiabilité', 20, 22)
      const now = new Date().toLocaleDateString('fr-FR')
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
      pdf.text(`Exporté le ${now}`, pdfW - 20, 22, { align: 'right' })
      pdf.addImage(imgData, 'PNG', 0, 36, pdfW, pdfH)
      pdf.save(`dashboard-fiabilite-${now.replace(/\//g, '-')}.pdf`)
    } catch (e) { console.error(e) }
    setExportingPDF(false)
  }

  const { arrets: rawArrets, seuils } = useTUM()

  const loadData = useCallback(() => {
    api.getSessions().then(s => { setRawSessions(s); setLastUpdate(new Date()) }).catch(() => {})
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Calcul de toutes les métriques
  const kpi = useMemo(() => {
    const { debut, fin, periodHours } = getPeriodBounds(periode)

    // Arrets filtrés par période
    const arretsPeriode = rawArrets.filter(a => {
      const dt = new Date(a.startTime)
      return dt >= debut && dt <= fin
    })

    // Tous les équipements connus
    const allEquipIds = [...new Set(rawArrets.map(a => a.equipId))]
    const nbEquip = Math.max(allEquipIds.length, 1)

    // ── Statuts équipements (utilise tout l'historique + seuils configurés)
    const equipStatuts = allEquipIds.map(id => ({
      id,
      statut: getStatut(
        calcCumul(rawArrets, id, seuils.n2?.horizon || 90),
        calcFrequence(rawArrets, id, seuils.n2?.horizon || 90),
        seuils
      ),
    }))
    const equipN2 = equipStatuts.filter(e => e.statut === 'alert').length
    const equipN1 = equipStatuts.filter(e => e.statut === 'watch').length

    // ── Lagging KPIs (sessions RCA)
    const rcaTotal       = rawSessions.length
    const rcaOuvertes    = rawSessions.filter(s => s.statut !== 'cloturee').length
    const rcaCloturees   = rawSessions.filter(s => s.statut === 'cloturee').length
    const recommandations = rawSessions.reduce((s, sess) => s + (sess.actionsGenerees?.length || 0), 0)
    const txCloture      = rcaTotal > 0 ? Math.round((rcaCloturees / rcaTotal) * 100) : 0

    // ── Leading KPIs (calculés sur la période)
    const tdTotal  = arretsPeriode.reduce((s, a) => s + (a.duration || 0), 0)
    const nbArrets = arretsPeriode.length
    // T0 = temps nominal total de la flotte sur la période
    const t0Fleet  = periodHours * nbEquip
    const tsFleet  = Math.max(t0Fleet - tdTotal, 0)
    // MTTB = temps de bon fonctionnement / nombre de pannes (par équip en moyenne)
    const mttb = nbArrets > 0 ? (tsFleet / nbArrets).toFixed(1) : '—'
    // MTTR = durée moyenne de réparation
    const mttr = nbArrets > 0 ? (tdTotal / nbArrets).toFixed(1) : '—'
    // TS et TD = moyennes par équipement (plus lisibles)
    const tdMoy = (tdTotal / nbEquip).toFixed(1)
    const tsMoy = Math.max(periodHours - tdTotal / nbEquip, 0).toFixed(1)

    // ── Bad Actors (Pareto sur la période)
    const badActorItems = allEquipIds.map(id => {
      const eq = arretsPeriode.filter(a => a.equipId === id)
      const cumul = eq.reduce((s, a) => s + (a.duration || 0), 0)
      const freq  = eq.length
      const dernierArret = [...eq].sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0] || null
      return { id, cumul, freq, dernierArret }
    }).filter(r => r.cumul > 0).sort((a, b) => b.cumul - a.cumul).slice(0, 8)

    // ── Familles pannes (cumul par famille sur la période)
    const famMap = {}
    arretsPeriode.forEach(a => {
      const f = getFamille(a.equipId, a.niveauEqSeq)
      if (!famMap[f.label]) famMap[f.label] = { label: f.label, color: f.color, cumul: 0 }
      famMap[f.label].cumul += a.duration || 0
    })
    const famTotal = Object.values(famMap).reduce((s, f) => s + f.cumul, 0)
    // Assign fallback colors for unknown families
    let colorIdx = 0
    const famillesPannes = Object.values(famMap)
      .map(f => ({
        ...f,
        color: f.color || FALLBACK_COLORS[colorIdx++ % FALLBACK_COLORS.length],
        val: famTotal > 0 ? Math.round((f.cumul / famTotal) * 100) : 0,
      }))
      .sort((a, b) => b.val - a.val)

    // ── Évolution sessions RCA — 6 derniers mois
    const actionsEvol = getLast6Months().map(({ mois, debut: mD, fin: mF }) => {
      const inMonth = rawSessions.filter(s => {
        if (!s.dateOuverture) return false
        const d = new Date(s.dateOuverture)
        return d >= mD && d <= mF
      })
      return { mois, ouvertes: inMonth.length, cloturees: inMonth.filter(s => s.statut === 'cloturee').length }
    })

    // ── RCA en cours (pour la carte)
    const rcaEnCours = rawSessions
      .filter(s => s.statut !== 'cloturee')
      .slice(0, 4)
      .map(s => ({
        id: s.id,
        equip: s.equipId,
        methode: s.methode === '5why' ? 'ARBRE DE CAUSES' : s.methode === 'kaizen' ? 'QUICK KAIZEN' : s.methode || '—',
        animateur: s.responsable || s.participants?.[0]?.nom || '—',
        avancement: calcAvancement(s),
        niveau: s.niveau,
      }))

    // ── Tendance actions (dernier mois vs avant-dernier)
    const lastMonth = actionsEvol.at(-1)
    const prevMonth = actionsEvol.at(-2)
    const improving = lastMonth.ouvertes > 0
      ? lastMonth.cloturees >= lastMonth.ouvertes
      : prevMonth?.cloturees >= prevMonth?.ouvertes

    // ── Domaine le plus touché
    const topFamille = famillesPannes[0]

    const badActorFreqItems = allEquipIds.map(id => {
      const eq = arretsPeriode.filter(a => a.equipId === id)
      const cumul = eq.reduce((s, a) => s + (a.duration || 0), 0)
      const freq  = eq.length
      return { id, cumul, freq }
    }).filter(r => r.freq > 0).sort((a, b) => b.freq - a.freq).slice(0, 8)

    const histData = allEquipIds.map(id => {
      const eq = arretsPeriode.filter(a => a.equipId === id)
      return { id, cumul: eq.reduce((s, a) => s + (a.duration || 0), 0), freq: eq.length }
    }).filter(d => d.cumul > 0 || d.freq > 0)

    return {
      equipN2, equipN1,
      rcaTotal, rcaOuvertes, rcaCloturees, recommandations, txCloture,
      mttb, mttr,
      t0: periodHours,
      td: parseFloat(tdMoy),
      ts: parseFloat(tsMoy),
      nbArrets, nbEquip,
      badActors: badActorItems,
      badActorsFreq: badActorFreqItems,
      histData,
      famillesPannes,
      actionsEvol,
      rcaEnCours,
      improving, lastMonth,
      topFamille,
    }
  }, [rawArrets, rawSessions, seuils, periode])

  const badActorsCount = useMemo(() => {
    const total = kpi.badActors.reduce((s, d) => s + d.cumul, 0)
    let running = 0
    return kpi.badActors.filter(d => {
      const pct = total > 0 ? (d.cumul / total) * 100 : 0
      const prev = running; running += pct
      return prev < 80
    }).length
  }, [kpi.badActors])

  const totalCumulBadActors = kpi.badActors.reduce((s, d) => s + d.cumul, 0)
  const hasData = rawArrets.length > 0 || rawSessions.length > 0

  return (
    <div ref={dashboardRef} style={{ animation: 'fadeUp .2s ease', fontFamily: "'DM Sans',sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 20, color: C.navy }}>
            Dashboard Fiabilité
          </div>
          <div style={{ fontSize: 11.5, color: C.text4, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasData
              ? <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Synchronisé · {kpi.nbArrets} arrêt{kpi.nbArrets !== 1 ? 's' : ''} · {rawSessions.length} session{rawSessions.length !== 1 ? 's' : ''} RCA</>
              : <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> Aucune donnée — importez des arrêts dans TUM</>
            }
            {lastUpdate && <span>· màj {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={handleExportPDF} disabled={exportingPDF} style={{
            padding: '6px 14px', borderRadius: 8, border: '1.5px solid #fecaca',
            background: exportingPDF ? '#fff7f7' : '#fef2f2', cursor: exportingPDF ? 'wait' : 'pointer',
            fontSize: 12, fontWeight: 700, color: '#dc2626',
            fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 5, transition: 'all .15s',
          }}>
            {exportingPDF
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10"/></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            }
            {exportingPDF ? 'Export…' : 'Export PDF'}
          </button>
          <button onClick={loadData} style={{
            padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: '#fff', cursor: 'pointer', fontSize: 12, color: C.text3,
            fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <RefreshIcon /> Rafraîchir
          </button>
          <div style={{ display: 'flex', gap: 5, background: C.bg2, borderRadius: 25, padding: 4 }}>
            {['Semaine', 'Mois', 'Trimestre'].map(p => (
              <button key={p} onClick={() => setPeriode(p.toLowerCase())} style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: periode === p.toLowerCase() ? C.navy : 'transparent',
                color: periode === p.toLowerCase() ? '#fff' : C.text3,
                fontFamily: "'DM Sans',sans-serif", transition: 'all .15s',
              }}>{p}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ══ LAGGING KPIs ══════════════════════════════════════════════════════ */}
      <SectionHeader label="Lagging KPI" type="lagging" subtitle="Indicateurs de résultat" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>

        <LaggingCard
          icon={<AlertIcon />}
          label="Équipements ayant atteint le seuil RCA"
          value={kpi.equipN2 + kpi.equipN1}
          sublabel={`${kpi.equipN2} en alerte N2 · ${kpi.equipN1} en surveillance N1`}
          color="#dc2626"
          detail={kpi.equipN2 > 0 ? `${kpi.equipN2} analyse${kpi.equipN2 > 1 ? 's' : ''} obligatoire${kpi.equipN2 > 1 ? 's' : ''}` : 'Aucun dépassement N2'}
        />

        <LaggingCard
          icon={<RCAIcon />}
          label="RCA déclenchées"
          value={kpi.rcaTotal}
          sublabel={`${kpi.rcaOuvertes} ouvertes · ${kpi.rcaCloturees} clôturées`}
          color="#1a3a6b"
          progress={kpi.rcaCloturees}
          progressMax={kpi.rcaTotal}
          detail={`Taux de clôture : ${kpi.txCloture}%`}
        />

        <LaggingCard
          icon={<CheckIcon />}
          label="Analyses clôturées"
          value={kpi.rcaCloturees}
          value2={kpi.rcaTotal}
          sublabel={`${kpi.txCloture}% du portefeuille RCA`}
          color="#059669"
          progress={kpi.rcaCloturees}
          progressMax={kpi.rcaTotal}
          detail={`Sessions en cours : ${kpi.rcaOuvertes}`}
        />

        <LaggingCard
          icon={<IdeaIcon />}
          label="Recommandations générées"
          value={kpi.recommandations}
          sublabel={`Issues de ${kpi.rcaCloturees} analyse${kpi.rcaCloturees !== 1 ? 's' : ''} clôturée${kpi.rcaCloturees !== 1 ? 's' : ''}`}
          color="#7c3aed"
          detail={kpi.rcaCloturees > 0
            ? `Moy. ${(kpi.recommandations / kpi.rcaCloturees).toFixed(1)} actions / analyse`
            : 'Aucune analyse clôturée'}
        />
      </div>

      {/* ══ LEADING KPIs ═════════════════════════════════════════════════════ */}
      <SectionHeader label="Leading KPI" type="leading" subtitle="Indicateurs de performance — santé de la flotte" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 26 }}>
        <LeadingCard abbrev="MTTB" label="Mean Time To Breakdown" value={kpi.mttb} unit="heures" sub={kpi.nbArrets > 0 ? `${kpi.nbArrets} arrêt${kpi.nbArrets > 1 ? 's' : ''} sur la période` : 'Aucun arrêt'} color="#1a3a6b" accent="#f0f4ff" />
        <LeadingCard abbrev="MTTR" label="Mean Time To Repair" value={kpi.mttr} unit="heures" sub="Durée moy. réparation" color="#0891b2" accent="#f0fbff" />
        <LeadingCard abbrev="T0" label="Temps nominal (référence)" value={kpi.t0} unit="heures" sub={`Base de calcul (${periode})`} color="#6366f1" accent="#f5f3ff" />
        <LeadingCard abbrev="TS" label="Temps de service" value={kpi.ts} unit="h / équip. moy." sub={`${kpi.nbEquip} équipement${kpi.nbEquip !== 1 ? 's' : ''} suivi${kpi.nbEquip !== 1 ? 's' : ''}`} color="#059669" accent="#f0fdf4" />
        <LeadingCard abbrev="TD" label="Temps d'arrêt" value={kpi.td} unit="h / équip. moy." sub={kpi.t0 > 0 ? `${((kpi.td / kpi.t0) * 100).toFixed(1)}% du temps nominal` : ''} color="#dc2626" accent="#fff5f5" />
      </div>

      {/* ══ GRAPHIQUES PARETO ════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        {/* ── Pareto cumul durée ── */}
        {(() => {
          const totalCumul = kpi.badActors.reduce((s, d) => s + d.cumul, 0)
          let run = 0
          const badCnt = kpi.badActors.filter(d => { const pct = totalCumul > 0 ? d.cumul / totalCumul * 100 : 0; const prev = run; run += pct; return prev < 80 }).length
          const badCumul = kpi.badActors.slice(0, badCnt).reduce((s, d) => s + d.cumul, 0)
          const pctCapture = totalCumul > 0 ? ((badCumul / totalCumul) * 100).toFixed(1) : '0'
          return (
            <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '18px 16px 14px', boxShadow: '0 1px 8px rgba(15,30,53,.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 3, height: 17, background: C.navy, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text2, fontFamily: "'Sora',sans-serif", display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconInline><ParetoIcon /></IconInline>Pareto Bad Actors — Cumul durée</span>
              </div>
              <div style={{ fontSize: 10.5, color: C.text4, marginBottom: 10 }}>{badCnt} équipements représentent <strong style={{ color: '#dc2626' }}>{pctCapture}%</strong> du temps d'arrêt total</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                {[
                  { lbl: 'Cumul total', val: `${totalCumul.toFixed(1)}h`, col: C.navy },
                  { lbl: 'Bad Actors', val: badCnt, col: '#dc2626' },
                  { lbl: '% capturé 80/20', val: `${pctCapture}%`, col: '#d97706' },
                ].map((s, i) => (
                  <div key={i} style={{ padding: '5px 8px', borderRadius: 7, background: '#f8fafd', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 8.5, color: C.text4, textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>{s.lbl}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: s.col, fontFamily: "'Sora', sans-serif", marginTop: 2 }}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'center', marginBottom: 10 }}>
                {[{ color: C.navy, shape: 'rect', label: 'Bad Actor (80%)' }, { color: '#94a3b8', shape: 'rect', label: 'Hors Pareto' }, { color: '#d97706', shape: 'line', label: 'Courbe cumulée' }, { color: '#dc2626', shape: 'dash', label: 'Seuil 80%' }].map((l, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {l.shape === 'rect' && <div style={{ width: 9, height: 9, background: l.color, borderRadius: 2 }} />}
                    {l.shape === 'line' && <div style={{ width: 14, height: 2.5, background: l.color, borderRadius: 2 }} />}
                    {l.shape === 'dash' && <div style={{ width: 14, height: 0, borderTop: `2px dashed ${l.color}` }} />}
                    <span style={{ fontSize: 9.5, color: C.text3 }}>{l.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ overflowX: 'auto' }}>
                {kpi.badActors.length > 0
                  ? <ParetoSVGCumul items={kpi.badActors} />
                  : <EmptyChart label="Aucun arrêt sur la période" />}
              </div>
              {badCnt > 0 && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#eff6ff', borderLeft: '3px solid #1a3a6b', borderRadius: '0 8px 8px 0', fontSize: 12, color: '#1e3a5f', lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700 }}>Interprétation — </span>
                  Les équipements identifiés ci-dessus concentrent la majorité du temps d'arrêt cumulé, conformément au principe de Pareto (80/20).
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Pareto fréquence ── */}
        {(() => {
          const freqData = kpi.badActorsFreq || []
          const totalFreq = freqData.reduce((s, d) => s + d.freq, 0)
          let run = 0
          const badFreqCnt = freqData.filter(d => { const pct = totalFreq > 0 ? d.freq / totalFreq * 100 : 0; const prev = run; run += pct; return prev < 80 }).length
          const badFreqSum = freqData.slice(0, badFreqCnt).reduce((s, d) => s + d.freq, 0)
          const pctCaptureFreq = totalFreq > 0 ? ((badFreqSum / totalFreq) * 100).toFixed(1) : '0'
          return (
            <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '18px 16px 14px', boxShadow: '0 1px 8px rgba(15,30,53,.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 3, height: 17, background: C.navy, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text2, fontFamily: "'Sora',sans-serif", display: 'inline-flex', alignItems: 'center', gap: 8 }}><IconInline><ParetoIcon /></IconInline>Pareto Fréquence arrêts</span>
              </div>
              <div style={{ fontSize: 10.5, color: C.text4, marginBottom: 10 }}>{badFreqCnt} équipements représentent <strong style={{ color: '#dc2626' }}>{pctCaptureFreq}%</strong> du nombre total d'arrêts</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                {[
                  { lbl: 'Cumul total arrêts', val: totalFreq, col: C.navy },
                  { lbl: 'Bad Actors fréq.', val: badFreqCnt, col: '#dc2626' },
                  { lbl: '% capturé 80/20', val: `${pctCaptureFreq}%`, col: '#d97706' },
                ].map((s, i) => (
                  <div key={i} style={{ padding: '5px 8px', borderRadius: 7, background: '#f8fafd', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 8.5, color: C.text4, textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>{s.lbl}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: s.col, fontFamily: "'Sora', sans-serif", marginTop: 2 }}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'center', marginBottom: 10 }}>
                {[{ color: C.navy, shape: 'rect', label: 'Bad Actor fréq (80%)' }, { color: '#94a3b8', shape: 'rect', label: 'Hors Pareto' }, { color: '#d97706', shape: 'line', label: 'Courbe cumulée' }, { color: '#dc2626', shape: 'dash', label: 'Seuil 80%' }].map((l, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {l.shape === 'rect' && <div style={{ width: 9, height: 9, background: l.color, borderRadius: 2 }} />}
                    {l.shape === 'line' && <div style={{ width: 14, height: 2.5, background: l.color, borderRadius: 2 }} />}
                    {l.shape === 'dash' && <div style={{ width: 14, height: 0, borderTop: `2px dashed ${l.color}` }} />}
                    <span style={{ fontSize: 9.5, color: C.text3 }}>{l.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ overflowX: 'auto' }}>
                {freqData.length > 0
                  ? <ParetoSVGFreq items={freqData} />
                  : <EmptyChart label="Aucun arrêt sur la période" />}
              </div>
              {badFreqCnt > 0 && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#eff6ff', borderLeft: '3px solid #1a3a6b', borderRadius: '0 8px 8px 0', fontSize: 12, color: '#1e3a5f', lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700 }}>Interprétation — </span>
                  Les équipements identifiés présentent la fréquence de défaillance la plus élevée et nécessitent une attention particulière en maintenance.
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* ══ CUMUL ARRÊTS ══════════════════════════════════════════════════════ */}
      {kpi.histData && kpi.histData.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 18 }}>
          <CumulLineChart data={kpi.histData} seuilN1={seuils?.n1?.cumul || 2} seuilN2={seuils?.n2?.cumul || 4} title="Cumul durée d'arrêt par équipement" colorKey="cumul" />
          <CumulLineChart data={kpi.histData} seuilN1={seuils?.n1?.frequence || 2} seuilN2={seuils?.n2?.frequence || 3} title="Cumul fréquence d'arrêts par équipement" colorKey="freq" />
        </div>
      )}

      {/* ══ GRAPHIQUES LIGNE 2 (Évolution RCA + Famille + RCA en cours) ══════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.15fr', gap: 18, marginBottom: 18 }}>

        <Card title={<><IconInline><TrendIcon /></IconInline>Évolution analyses RCA — 6 mois</>}>
          <ActionsChart data={kpi.actionsEvol} />
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: '#f59e0b' }} />
              <span style={{ color: C.text3 }}>Ouvertes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: '#10b981' }} />
              <span style={{ color: C.text3 }}>Clôturées</span>
            </div>
          </div>
          {kpi.lastMonth && (
            <div style={{
              marginTop: 14, padding: '8px 12px', borderRadius: 8, fontSize: 11.5,
              background: kpi.improving ? '#ecfdf5' : '#fff7ed',
              border: `1px solid ${kpi.improving ? '#a7f3d0' : '#fed7aa'}`,
              color: kpi.improving ? '#059669' : '#d97706', fontWeight: 600,
            }}>
              {kpi.improving ? <><IconInline><TrendIcon /></IconInline>Tendance positive</> : <><IconInline><TrendIcon /></IconInline>Volume en hausse</>} · Dernier mois : {kpi.lastMonth.cloturees} / {kpi.lastMonth.ouvertes} clôturée{kpi.lastMonth.cloturees !== 1 ? 's' : ''}
            </div>
          )}
        </Card>

        <Card title={<><IconInline><DonutIcon /></IconInline>Répartition par famille d'équipements</>}>
          <DonutChart data={kpi.famillesPannes} />
          {kpi.topFamille && (
            <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 8, fontSize: 11.5, background: '#fafbfd', border: `1px solid ${C.border}`, color: C.text3 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 6 }}><WarningIcon /></span><strong style={{ color: C.navy }}>{kpi.topFamille.label}</strong> représente{' '}
              <strong>{kpi.topFamille.val}%</strong> du temps d'arrêt — priorité d'action recommandée
            </div>
          )}
        </Card>

        <Card title={<><IconInline><RCAIcon /></IconInline>RCA en cours</>} badge={`${kpi.rcaOuvertes} actives`}>
          {kpi.rcaEnCours.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: C.text4, fontSize: 12 }}>
              {rawSessions.length === 0 ? 'Aucune session RCA — lancez une analyse depuis TUM' : <><IconInline><CheckIcon /></IconInline>Toutes les analyses sont clôturées</>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {kpi.rcaEnCours.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: C.navy }}>{r.id}</span>
                      {r.methode !== '—' && (
                        <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: r.methode === 'ARBRE DE CAUSES' ? '#fef2f2' : '#eff6ff', color: r.methode === 'ARBRE DE CAUSES' ? '#dc2626' : C.navy, border: `1px solid ${r.methode === 'ARBRE DE CAUSES' ? '#fecaca' : C.blueMid}` }}>{r.methode}</span>
                      )}
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: r.niveau === 2 ? '#fef2f2' : '#fffbeb', color: r.niveau === 2 ? '#dc2626' : '#d97706', fontWeight: 700 }}>N{r.niveau}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: C.text2, fontWeight: 600, marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><GearIcon />{r.equip}</span>
                      {r.animateur !== '—' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><UserIcon />{r.animateur}</span> : null}
                    </div>
                    <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${r.avancement}%`, background: r.avancement >= 70 ? '#059669' : r.avancement >= 40 ? '#d97706' : C.navy, borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 20, color: r.avancement >= 70 ? '#059669' : r.avancement >= 40 ? '#d97706' : C.navy }}>{r.avancement}%</div>
                    <div style={{ fontSize: 10, color: C.text4 }}>avancement</div>
                  </div>
                </div>
              ))}
              {kpi.rcaCloturees > 0 && (
                <div style={{ padding: '10px 16px', borderRadius: 10, background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CheckIcon /></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#059669' }}>{kpi.rcaCloturees} analyse{kpi.rcaCloturees !== 1 ? 's' : ''} clôturée{kpi.rcaCloturees !== 1 ? 's' : ''}</div>
                    <div style={{ fontSize: 11.5, color: '#047857', marginTop: 1 }}>
                      {kpi.recommandations} recommandation{kpi.recommandations !== 1 ? 's' : ''} générée{kpi.recommandations !== 1 ? 's' : ''} · Taux clôture {kpi.txCloture}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
