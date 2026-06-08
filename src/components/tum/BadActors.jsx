// src/components/tum/BadActors.jsx
// Vue Pareto des Bad Actors — Refonte complète
// 3 vues : Pareto (défaut) | Équipements en alerte | Analyse cumul & fréquence
// ✦ Vue "Suivi des équipements RCA" remplacée par tableau Image 1
// 🔥 CORRECTION : Les cumuls ne prennent plus en compte les sessions clôturées

import { useState, useMemo, useEffect, useRef } from 'react'
import C from '../../tokens/colors'
import ProfessionalScatter from './ProfessionalScatter'
import { getStatut } from '../../hooks/useTUM'
import { jsPDF } from 'jspdf'
import { api } from '../../lib/api'

// ─── Helper date display ───────────────────────────────────────────────────────
const fmtDate = str => {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

const trunc = (str, max = 15) => str.length > max ? str.slice(0, max) + '…' : str

const getParetoSegment = (items, field, targetPct = 20) => {
  const sorted = [...items].sort((a, b) => (b[field] || 0) - (a[field] || 0))
  const total = sorted.reduce((sum, item) => sum + (item[field] || 0), 0)
  const segment = []
  let running = 0
  for (const item of sorted) {
    const share = total > 0 ? ((item[field] || 0) / total) * 100 : 0
    if (segment.length === 0 || running < targetPct) {
      segment.push(item)
      running += share
    } else {
      break
    }
  }
  return segment
}

// ─── Capture SVG en PNG HD (scale ×3) ────────────────────────────────────────
async function captureCardAsImage(cardEl, filename = 'pareto.png') {
  const allSvgs = Array.from(cardEl.querySelectorAll('svg'))
  const svg = allSvgs.reduce((best, s) => {
    const r = s.getBoundingClientRect()
    const br = best ? best.getBoundingClientRect() : { width: 0, height: 0 }
    return r.width * r.height > br.width * br.height ? s : best
  }, null)
  if (!svg) return 'no-svg'

  const rect = svg.getBoundingClientRect()
  const vb = svg.getAttribute('viewBox')
  const [, , vbW, vbH] = vb ? vb.split(' ').map(Number) : [0, 0, rect.width, rect.height]
  const scale = 3
  const W = Math.round(vbW || rect.width)
  const H = Math.round(vbH || rect.height)

  const clone = svg.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', W)
  clone.setAttribute('height', H)

  const serializer = new XMLSerializer()
  const svgStr = '<?xml version="1.0" encoding="UTF-8"?>' + serializer.serializeToString(clone)
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })

  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0)
  URL.revokeObjectURL(url)

  return new Promise(resolve => {
    canvas.toBlob(async pngBlob => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
        resolve('copied')
      } catch {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(pngBlob)
        a.download = filename
        a.click()
        resolve('downloaded')
      }
    }, 'image/png', 1.0)
  })
}

// ─── Bouton Copier (icône seule, sans texte) ──────────────────────────────────
function CopyButton({ cardRef, filename }) {
  const [state, setState] = useState('idle')
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={async () => {
          if (!cardRef?.current || state === 'loading') return
          setState('loading')
          try {
            await captureCardAsImage(cardRef.current, filename || 'pareto.png')
            setState('done')
            setTimeout(() => setState('idle'), 2500)
          } catch {
            setState('idle')
          }
        }}
        title="Copier le graphique en HD"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, borderRadius: 7,
          border: `1.5px solid ${state === 'done' ? '#059669' : state === 'loading' ? '#e2e8f0' : C.border2}`,
          background: state === 'done' ? '#ecfdf5' : '#fff',
          color: state === 'done' ? '#059669' : state === 'loading' ? C.text4 : C.text3,
          cursor: state === 'loading' ? 'wait' : 'pointer',
          transition: 'all .2s', flexShrink: 0,
        }}
      >
        {state === 'done' ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        ) : state === 'loading' ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10"/></svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        )}
      </button>
      {state === 'done' && (
        <span style={{
          position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)',
          background: '#0f172a', color: '#fff', fontSize: 10.5, fontWeight: 600,
          padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap',
          fontFamily: "'DM Sans', sans-serif", pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,.2)',
        }}>
          Copié !
        </span>
      )}
    </div>
  )
}

// ─── Export PDF ───────────────────────────────────────────────────────────────
async function exportCardAsPDF(cardEl, filename = 'pareto.pdf') {
  const allSvgs = Array.from(cardEl.querySelectorAll('svg'))
  const svg = allSvgs.reduce((best, s) => {
    const r = s.getBoundingClientRect()
    return (!best || r.width * r.height > best._area)
      ? Object.assign(s, { _area: r.width * r.height })
      : best
  }, null)
  if (!svg) return

  const rect = svg.getBoundingClientRect()
  const vb = svg.getAttribute('viewBox')
  const [, , vbW, vbH] = vb ? vb.split(' ').map(Number) : [0, 0, rect.width, rect.height]
  const W = Math.round(vbW || rect.width)
  const H = Math.round(vbH || rect.height)

  const clone = svg.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', W)
  clone.setAttribute('height', H)
  const serializer = new XMLSerializer()
  const svgStr = '<?xml version="1.0" encoding="UTF-8"?>' + serializer.serializeToString(clone)
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = 3
      canvas.width = W * scale
      canvas.height = H * scale
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)

      const imgData = canvas.toDataURL('image/png')
      const orientation = W > H ? 'landscape' : 'portrait'
      const pdf = new jsPDF({ orientation, unit: 'px', format: [W, H] })
      pdf.addImage(imgData, 'PNG', 0, 0, W, H)
      pdf.save(filename)
      resolve()
    }
    img.onerror = reject
    img.src = url
  })
}

function PDFButton({ cardRef, filename }) {
  const [state, setState] = useState('idle')
  return (
    <button
      onClick={async () => {
        if (!cardRef?.current || state === 'loading') return
        setState('loading')
        try {
          await exportCardAsPDF(cardRef.current, filename || 'pareto.pdf')
          setState('done')
          setTimeout(() => setState('idle'), 2500)
        } catch { setState('idle') }
      }}
      title="Exporter en PDF"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 5, padding: '4px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600,
        border: `1.5px solid ${state === 'done' ? '#059669' : '#e2e8f0'}`,
        background: state === 'done' ? '#ecfdf5' : '#fff',
        color: state === 'done' ? '#059669' : '#dc2626',
        cursor: state === 'loading' ? 'wait' : 'pointer',
        transition: 'all .2s', flexShrink: 0,
      }}
    >
      {state === 'loading' ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10"/></svg>
      ) : state === 'done' ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
      )}
      {state === 'done' ? 'Exporté !' : 'PDF'}
    </button>
  )
}

// ─── Diagramme Pareto SVG (cumul durée) ───────────────────────────────────────
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
    running += pct
    return { ...item, cumulPct: Math.min(running, 100) }
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
    <>
      <defs>
        {withPct.map((item, i) => (
          <linearGradient key={i} id={`bgC${i}`} x1="0" y1="0" x2="0" y2="1">
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
            <rect x={x} y={y} width={bW} height={barH} fill={`url(#bgC${i})`} rx="4" opacity={isHov ? 1 : 0.9} />
            {(n <= 18 || isHov) && (
              <text x={x + bW / 2} y={y - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill={item.isBadActor ? C.navy : C.text4} fontFamily="Sora,sans-serif" opacity={isHov || item.isBadActor ? 1 : 0.65}>{item.cumul.toFixed(1)}h</text>
            )}
            <text x={x + bW / 2} y={pad.top + gH + 10} textAnchor="end" fontSize={n > 20 ? '8' : n > 12 ? '9' : '9.5'} fill={item.isBadActor ? C.navy : C.text4} fontWeight={item.isBadActor ? '700' : '400'} fontFamily="DM Sans,sans-serif" transform={`rotate(-45, ${x + bW / 2}, ${pad.top + gH + 10})`}>{item.id}</text>
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
    </>
  )
}

// ─── Diagramme Pareto SVG (fréquence) ─────────────────────────────────────────
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
    <>
      <defs>
        {withPct.map((item, i) => (
          <linearGradient key={i} id={`bgF${i}`} x1="0" y1="0" x2="0" y2="1">
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
            <rect x={x} y={y} width={bW} height={barH} fill={`url(#bgF${i})`} rx="4" opacity={isHov ? 1 : 0.9} />
            {(n <= 18 || isHov) && (
              <text x={x + bW / 2} y={y - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill={item.isBadActorFreq ? C.navy : C.text4} fontFamily="Sora,sans-serif" opacity={isHov || item.isBadActorFreq ? 1 : 0.65}>{item.freq}</text>
            )}
            <text x={x + bW / 2} y={pad.top + gH + 10} textAnchor="end" fontSize={n > 20 ? '8' : n > 12 ? '9' : '9.5'} fill={item.isBadActorFreq ? C.navy : C.text4} fontWeight={item.isBadActorFreq ? '700' : '400'} fontFamily="DM Sans,sans-serif" transform={`rotate(-45, ${x + bW / 2}, ${pad.top + gH + 10})`}>{item.id}</text>
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
    </>
  )
}

// ─── Graphique courbe cumul ────────────────────────────────────────────────────
function CumulLineChart({ data, seuilN1, seuilN2, seuilLabel, title, unit, colorKey, svgRef }) {
  const [hovered, setHovered] = useState(null)
  const cardRef = useRef(null)
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
    <div ref={cardRef} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '18px 16px 14px', boxShadow: '0 1px 8px rgba(15,30,53,.06)', marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 3, height: 17, background: C.navy, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text2, fontFamily: "'Sora',sans-serif" }}>{title}</span>
          </div>
          <div style={{ fontSize: 10.5, color: C.text4, marginTop: 3, marginLeft: 11 }}>Postes techniques triés par ordre décroissant · Seuils N1/N2 selon le paramétrage TUM</div>
        </div>
        <CopyButton cardRef={cardRef} filename={`${title.toLowerCase().replace(/\s+/g,'-')}.png`} />
      </div>
      {/* ── Bande récapitulatif PAR ZONE — au-dessus du graphique ── */}
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
              <div style={{ fontSize: 8.5, color: C.text4, marginTop: 2 }}>poste technique{total > 1 ? 's' : ''}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: '#f1f5f9', border: `1px solid #e2e8f0`, textAlign: 'center' }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 3 }}>● Alerte</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#AD1010', fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{nbAlerte}</div>
              <div style={{ fontSize: 8.5, color: C.text4, marginTop: 2 }}>poste technique{nbAlerte > 1 ? 's' : ''}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: '#f1f5f9', border: `1px solid #e2e8f0`, textAlign: 'center' }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 3 }}>● Surveillance</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#b45309', fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{nbSurveillance}</div>
              <div style={{ fontSize: 8.5, color: C.text4, marginTop: 2 }}>poste technique{nbSurveillance > 1 ? 's' : ''}</div>
            </div>
            <div style={{ padding: '8px 10px', borderRadius: 7, background: '#f1f5f9', border: `1px solid #e2e8f0`, textAlign: 'center' }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 3 }}>● Normal</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#059669', fontFamily: "'Sora',sans-serif", lineHeight: 1 }}>{nbNormal}</div>
              <div style={{ fontSize: 8.5, color: C.text4, marginTop: 2 }}>poste technique{nbNormal > 1 ? 's' : ''}</div>
            </div>
          </div>
        )
      })()}
      <div style={{ overflowX: 'auto', background: '#f8fafd', borderRadius: 10, border: `1px solid ${C.border}`, padding: '10px 6px' }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: W, height: H, display: 'block', overflow: 'visible', background: '#fff', borderRadius: 8 }}>
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
          <text x={14} y={pad.top + gH / 2} textAnchor="middle" fontSize="9.5" fill={C.text3} fontWeight="600" transform={`rotate(-90, 14, ${pad.top + gH / 2})`} fontFamily="DM Sans,sans-serif">{seuilLabel}</text>
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', padding: '8px 12px', borderRadius: 8, background: '#f8fafd', border: `1px solid ${C.border}` }}>
          {[
            { color: '#dc2626', dash: false, label: 'Seuil N2' },
            { color: '#d97706', dash: true,  label: 'Seuil N1' },
          ].map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 20, height: 2.5, borderTop: l.dash ? `2.5px dashed ${l.color}` : `2.5px solid ${l.color}`, flexShrink: 0 }} />
              <span style={{ fontSize: 9.5, color: C.text3 }}>{l.label}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: '8px 14px', borderRadius: 8, background: '#f8fafd', border: `1px solid ${C.border}`, fontSize: 11, color: C.text3, lineHeight: 1.7, minWidth: 280 }}>
          <strong style={{ color: '#AD1010' }}>🔴 Alerte</strong> : Arbre de Causes requis &nbsp;·&nbsp; <strong style={{ color: '#d97706' }}>🟡 Surveillance</strong> : Quick Kaizen recommandé &nbsp;·&nbsp; <strong style={{ color: '#059669' }}>🟢 Normal</strong> : situation normale
        </div>
      </div>
    </div>
  )
}

// ─── Badge Statut ──────────────────────────────────────────────────────────────
function StatutBadge({ statut }) {
  const cfg = {
    alert: { label: 'Alerte', bg: '#fef2f2', color: '#dc2626', border: '#f87171', dot: '#dc2626' },
    watch: { label: 'Surveillance', bg: '#fffbeb', color: '#b45309', border: '#fbbf24', dot: '#d97706' },
    normal: { label: 'Normal', bg: '#f0fdf4', color: '#16a34a', border: '#4ade80', dot: '#22c55e' },
  }[statut] || { label: 'Normal', bg: '#f0fdf4', color: '#16a34a', border: '#4ade80', dot: '#22c55e' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px 4px 9px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `2px solid ${cfg.border}`, whiteSpace: 'nowrap', boxShadow: `0 0 0 1px ${cfg.border}22` }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0, boxShadow: `0 0 4px ${cfg.dot}88` }} />
      {cfg.label}
    </span>
  )
}

// ─── Export PDF vue Pareto complète ──────────────────────────────────────────
function ExportParetoPDFButton({ containerRef }) {
  const [state, setState] = useState('idle')

  const handleExport = async () => {
    if (state === 'loading' || !containerRef?.current) return
    setState('loading')
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const el = containerRef.current
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafd',
        scrollX: 0,
        scrollY: -window.scrollY,
      })

      const imgData = canvas.toDataURL('image/png')
      const imgW = canvas.width
      const imgH = canvas.height
      const pdfW = 1190  // A3 landscape width in px ~
      const pdfH = Math.round((imgH / imgW) * pdfW)

      const pdf = new jsPDF({ orientation: imgW > imgH ? 'landscape' : 'portrait', unit: 'px', format: [pdfW, pdfH + 40] })
      // En-tête
      pdf.setFillColor(11, 46, 99)
      pdf.rect(0, 0, pdfW, 34, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(13)
      pdf.setFont('helvetica', 'bold')
      pdf.text('JESA Reliability Hub — Vue Pareto Bad Actors', 20, 22)
      const now = new Date().toLocaleDateString('fr-FR')
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Exporté le ${now}`, pdfW - 20, 22, { align: 'right' })
      // Contenu
      pdf.addImage(imgData, 'PNG', 0, 36, pdfW, pdfH)
      pdf.save(`pareto-bad-actors-${now.replace(/\//g, '-')}.pdf`)

      setState('done')
      setTimeout(() => setState('idle'), 2500)
    } catch (e) { console.error(e); setState('idle') }
  }

  return (
    <button onClick={handleExport}
      title="Exporter toute la vue Pareto en PDF"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
        border: `1.5px solid ${state === 'done' ? '#059669' : '#dc2626'}`,
        background: state === 'done' ? '#ecfdf5' : '#fef2f2',
        color: state === 'done' ? '#059669' : '#dc2626',
        cursor: state === 'loading' ? 'wait' : 'pointer',
        transition: 'all .2s', fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {state === 'loading' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10"/></svg>
      ) : state === 'done' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
      )}
      {state === 'loading' ? 'Export en cours…' : state === 'done' ? 'Exporté !' : 'Exporter Pareto PDF'}
    </button>
  )
}

// ─── Export PDF Suivi équipements ────────────────────────────────────────────
function PDFSuiviButton({ rows }) {
  const [state, setState] = useState('idle')
  const handleExport = async () => {
    if (state === 'loading' || !rows.length) return
    setState('loading')
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

      pdf.setFillColor(11, 46, 99)
      pdf.rect(0, 0, pageW, 36, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(13)
      pdf.setFont('helvetica', 'bold')
      pdf.text('JESA Reliability Hub — Suivi Équipements RCA', 20, 23)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.text(`Exporté le ${now}`, pageW - 20, 23, { align: 'right' })

      const cols = ['Rang', 'Poste technique', 'Zone', 'Cumul (h)', 'Arrêts', 'Dernière panne', 'Cause d\'arrêt', 'Statut', 'Méthode']
      const colWidths = [30, 140, 40, 50, 40, 70, 150, 55, 65]
      let x = 20, y = 52

      pdf.setFillColor(240, 244, 255)
      pdf.rect(20, y - 11, pageW - 40, 15, 'F')
      pdf.setTextColor(26, 58, 107)
      pdf.setFontSize(7.5)
      pdf.setFont('helvetica', 'bold')
      cols.forEach((col, i) => { pdf.text(col, x + 2, y); x += colWidths[i] })

      y += 8
      rows.forEach((r, idx) => {
        if (y > 540) { pdf.addPage(); y = 30 }
        pdf.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 255)
        pdf.rect(20, y - 9, pageW - 40, 13, 'F')
        pdf.setTextColor(15, 23, 61)
        pdf.setFont('helvetica', r.rcaStatut === 'cloturee' ? 'normal' : 'bold')
        pdf.setFontSize(7)
        x = 20
        const vals = [
          String(r.rang),
          r.equipId || '—',
          r.zone || '—',
          r.cumul ? `${r.cumul.toFixed(1)}h` : '0h',
          r.freq ? `${r.freq} fois` : '0',
          r.datePanne || '—',
          r.cause ? r.cause.slice(0, 40) : '—',
          r.rcaStatut === 'cloturee' ? 'Clôturé' : 'À réaliser',
          r.methode === '5why' ? 'Arbre De Causes' : r.methode === 'kaizen' ? 'Quick Kaizen' : '—',
        ]
        vals.forEach((v, i) => { pdf.text(String(v), x + 2, y); x += colWidths[i] })
        y += 13
      })

      pdf.save(`suivi-equipements-rca-${now.replace(/\//g, '-')}.pdf`)
      setState('done')
      setTimeout(() => setState('idle'), 2500)
    } catch (e) { console.error(e); setState('idle') }
  }

  return (
    <button onClick={handleExport} disabled={!rows.length}
      title="Exporter le tableau en PDF"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 600,
        border: `1.5px solid ${state === 'done' ? '#059669' : '#e2e8f0'}`,
        background: state === 'done' ? '#ecfdf5' : '#fff',
        color: state === 'done' ? '#059669' : '#dc2626',
        cursor: rows.length ? 'pointer' : 'not-allowed', opacity: rows.length ? 1 : 0.5,
        transition: 'all .2s',
      }}
    >
      {state === 'loading' ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="10"/></svg>
      ) : state === 'done' ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
      )}
      {state === 'done' ? 'Exporté !' : 'Export PDF'}
    </button>
  )
}

// ─── Vue Suivi RCA — Tableau style Image 1 ─────────────────────────────────────
function RCASuiviTableView({ alertItems, arrets, arretsAll, seuils, onLancerRCA, search, setSearch }) {
  const [sessions, setSessions] = useState([])
  const [filterStatut, setFilterStatut] = useState('all')

  useEffect(() => {
    api.getSessions().then(setSessions).catch(() => {})
  }, [])

  const allRows = useMemo(() => {
    const rows = []

    // 1. Équipements OPEN — cycle actif en cours
    alertItems.forEach(item => {
      const sess = sessions.find(s => s.equipId === item.id && s.statut !== 'cloturee')
      const datePanne = item.dernierArret
        ? new Date(item.dernierArret.startTime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : null
      rows.push({
        key: `open-${item.id}`,
        rang: 0,
        equipId: item.id,
        cumul: item.cumul,
        freq: item.freq,
        datePanne,
        cause: item.dernierArret?.cause || null,
        zone: item.dernierArret?.zone || null,
        rcaId: sess?.id || null,
        rcaStatut: sess ? 'a-realiser' : 'a-realiser',
        methode: sess?.methode || null,
        statut: item.statut,
      })
    })

    // 2. Sessions CLÔTURÉES — toujours visibles, figées, lecture seule
    // Chaque session clôturée a sa propre ligne, même si l'équipement a un nouveau cycle actif
    sessions
      .filter(s => s.statut === 'cloturee')
      .forEach(s => {
        // Cumul et fréquence depuis l'arrêt lié à cette session précise (via incidentSessionId)
        const linkedArret = (arretsAll || arrets).find(a => a.sessionId === s.incidentSessionId)
        const realFreq  = linkedArret?.frequence ?? s.frequence ?? 0
        const realCumul = linkedArret?.duration  ?? s.cumulArret ?? 0
        rows.push({
          key: `closed-${s.id}`,
          rang: 0,
          equipId: s.equipId,
          cumul: realCumul,
          freq: realFreq,
          datePanne: s.dateOuverture
            ? new Date(s.dateOuverture).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : null,
          cause: s.causeArret || null,
          zone: s.zone || null,
          rcaId: s.id,
          rcaStatut: 'cloturee',
          methode: s.methode || null,
          statut: 'normal',
          readonly: true,
        })
      })

    rows.sort((a, b) => b.cumul - a.cumul)
    rows.forEach((r, i) => r.rang = i + 1)

    return rows
  }, [alertItems, sessions, arrets])

  const filtered = allRows.filter(r => {
    const matchSearch = !search.trim() || r.equipId.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filterStatut === 'all' ||
      (filterStatut === 'a-realiser' && r.rcaStatut !== 'cloturee') ||
      (filterStatut === 'cloturee' && r.rcaStatut === 'cloturee')
    return matchSearch && matchFilter
  })

  const nbTotal = allRows.length
  const nbARealiser = allRows.filter(r => r.rcaStatut !== 'cloturee').length
  const nbClotures = allRows.filter(r => r.rcaStatut === 'cloturee').length

  const thStyle = {
    padding: '11px 16px',
    textAlign: 'left',
    fontSize: 10.5,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '.7px',
    borderBottom: '2px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    whiteSpace: 'nowrap',
    background: '#f8fafc',
  }
  const tdBase = {
    padding: '13px 16px',
    verticalAlign: 'middle',
    fontSize: 13,
    color: '#475569',
    borderRight: '1px solid #e2e8f0',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>{nbTotal} analyse{nbTotal > 1 ? 's' : ''} au total</span>
          <span style={{ color: C.border2 }}>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#dc2626' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />{nbARealiser} à réaliser
          </span>
          <span style={{ color: C.border2 }}>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#059669' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />{nbClotures} clôturé{nbClotures > 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 5 }}>
          {[{ key: 'all', label: 'Tous' }, { key: 'a-realiser', label: 'À réaliser' }, { key: 'cloturee', label: 'Clôturés' }].map(f => (
            <button key={f.key} onClick={() => setFilterStatut(f.key)} style={{
              padding: '4px 12px', borderRadius: 20,
              border: `1.5px solid ${filterStatut === f.key ? C.navy : C.border2}`,
              background: filterStatut === f.key ? C.navy : '#fff',
              color: filterStatut === f.key ? '#fff' : C.text3,
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'all .15s',
            }}>{f.label}</button>
          ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.35 }}>🔍</div>
          <div style={{ fontSize: 13, color: C.text3, fontWeight: 600 }}>
            {search ? `Aucun résultat pour "${search}"` : 'Aucune analyse RCA pour ce filtre'}
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ ...thStyle, width: 52, textAlign: 'center' }}>Rang</th>
                <th style={{ ...thStyle, width: '22%' }}>Poste technique</th>
                <th style={{ ...thStyle, width: 80 }}>Zone</th>
                <th style={{ ...thStyle, width: 85 }}>Cumul (h)</th>
                <th style={{ ...thStyle, width: 72 }}>Arrêts</th>
                <th style={{ ...thStyle, width: 115 }}>Dernière panne</th>
                <th style={{ ...thStyle }}>Cause d'arrêt</th>
                <th style={{ ...thStyle, width: 130 }}>Statut</th>
                <th style={{ ...thStyle, width: 130, borderRight: 'none' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                const isCloture = r.rcaStatut === 'cloturee'
                const isLast = idx === filtered.length - 1
                const td = (extra = {}) => ({ ...tdBase, borderBottom: isLast ? 'none' : '1px solid #f1f5f9', ...extra })
                return (
                  <tr key={r.key} style={{ transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fbff'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={td({ textAlign: 'center', background: '#fafcff' })}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 7, background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#64748b', fontFamily: "'DM Sans',sans-serif" }}>
                        {r.rang}
                      </div>
                    </td>
                    <td style={td()}>
                      <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13, color: '#1a3a6b' }}>{r.equipId}</div>
                    </td>
                    <td style={td()}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>{r.zone || '—'}</span>
                    </td>
                    <td style={td()}>
                      <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 13, color: '#1a3a6b' }}>{r.cumul.toFixed(1)}h</span>
                    </td>
                    <td style={td()}>
                      {r.freq} fois
                    </td>
                    <td style={td({ color: '#64748b' })}>
                      {r.datePanne || '—'}
                    </td>
                    <td style={td()}>
                      <span style={{ display: 'block', lineHeight: 1.5 }}>
                        {r.cause || '—'}
                      </span>
                    </td>
                    <td style={td()}>
                      {isCloture ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#ecfdf5', color: '#059669', border: '1.5px solid #a7f3d0', whiteSpace: 'nowrap' }}>● Clôturé</span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', whiteSpace: 'nowrap' }}>● À réaliser</span>
                      )}
                    </td>
                    <td style={td({ borderRight: 'none' })}>
                      {isCloture ? (
                        <button
                          onClick={() => r.rcaId && onLancerRCA && onLancerRCA(r.rcaId, r.statut === 'alert' ? 2 : 1, true)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: '1.5px solid #a7f3d0', background: '#f0fdf4', color: '#059669', fontWeight: 700, cursor: 'pointer', fontSize: 11.5, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                          Consulter
                        </button>
                      ) : r.statut === 'alert' ? (
                        <button
                          onClick={() => onLancerRCA && onLancerRCA(r.equipId, 2)}
                          style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: 11.5, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>
                          Arbre De Causes
                        </button>
                      ) : (
                        <button
                          onClick={() => onLancerRCA && onLancerRCA(r.equipId, 1)}
                          style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#b45309', fontWeight: 700, cursor: 'pointer', fontSize: 11.5, fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>
                          Quick Kaizen
                        </button>
                      )}
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

// ─── Composant principal ───────────────────────────────────────────────────────
export default function BadActors({ arrets, arretsAll, seuils, onLancerRCA, viewMode: externalViewMode, onViewModeChange }) {
  const [internalViewMode, setInternalViewMode] = useState('pareto')
  const viewMode = externalViewMode !== undefined ? externalViewMode : internalViewMode
  const setViewMode = onViewModeChange || setInternalViewMode

  const thisMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }
  const oneYearAgo = () => { const d = new Date(); return new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()).toISOString().slice(0, 10) }
  const today = () => new Date().toISOString().slice(0, 10)

  const [paretoDebutStr, setParetoDebutStr] = useState(thisMonth)
  const lastDayOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10) }
  const [paretoFinStr, setParetoFinStr] = useState(lastDayOfMonth)
  const [histDebutStr, setHistDebutStr] = useState(oneYearAgo)
  const [histFinStr, setHistFinStr] = useState(today)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('cumul')
  const [filterImpact, setFilterImpact] = useState('all')
  const [selectedCrossItemId, setSelectedCrossItemId] = useState(null)
  const selectedCrossRowRef = useRef(null)
  const [showScatterInfo, setShowScatterInfo] = useState(false)

  const paretoCumulRef = useRef(null)
  const paretoFreqRef = useRef(null)
  const histCumulRef = useRef(null)
  const histFreqRef = useRef(null)
  const paretoCumulCardRef = useRef(null)
  const paretoFreqCardRef = useRef(null)
  const paretoViewRef = useRef(null)

  const paretoDebut = useMemo(() => { const [y, m, d] = paretoDebutStr.split('-').map(Number); return new Date(y, m - 1, d, 0, 0, 0) }, [paretoDebutStr])
  const paretoFin = useMemo(() => { const [y, m, d] = paretoFinStr.split('-').map(Number); return new Date(y, m - 1, d, 23, 59, 59) }, [paretoFinStr])
  const histDebut = useMemo(() => { const [y, m, d] = histDebutStr.split('-').map(Number); return new Date(y, m - 1, d, 0, 0, 0) }, [histDebutStr])
  const histFin = useMemo(() => { const [y, m, d] = histFinStr.split('-').map(Number); return new Date(y, m - 1, d, 23, 59, 59) }, [histFinStr])

  // Pareto : toutes les sessions (OPEN + CLOSED) dans la période sélectionnée
  const { paretoItems, badActors, paretoCumul, paretoNbArrets } = useMemo(() => {
    const equipIds = [...new Set(arrets.map(a => a.equipId))]
    const raw = equipIds.map(id => {
      // Toutes les sessions dans la période — la date est le seul filtre
      const filtered = arrets.filter(a => {
        const dt = new Date(a.startTime)
        return a.equipId === id && dt >= paretoDebut && dt <= paretoFin
      })

      const cumul = filtered.reduce((s, a) => s + (a.duration  || 0), 0)
      const freq  = filtered.reduce((s, a) => s + (a.frequence || 1), 0)
      const dernierArret = [...filtered].sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0] || null
      const statut = getStatut(cumul, freq, seuils)
      return { id, cumul, freq, statut, dernierArret }
    }).filter(r => r.cumul > 0 || r.freq > 0).sort((a, b) => b.cumul - a.cumul)
    
    const paretoCumul = raw.reduce((s, r) => s + r.cumul, 0)
    const paretoNbArrets = raw.reduce((s, r) => s + r.freq, 0)
    let running = 0
    const withPareto = raw.map(r => {
      const pct = paretoCumul > 0 ? (r.cumul / paretoCumul) * 100 : 0
      const prevRunning = running
      running += pct
      return { ...r, pct, cumulPct: Math.min(running, 100), isBadActor: prevRunning < 80 }
    })
    return { paretoItems: withPareto, badActors: withPareto.filter(r => r.isBadActor), paretoCumul, paretoNbArrets }
  }, [arrets, paretoDebut, paretoFin, seuils])

  const alertItems = useMemo(() => {
    const equipIds = [...new Set(arrets.map(a => a.equipId))]
    return equipIds.map(id => {
      // Sessions OPEN uniquement dans l'horizon N1/N2 (calculs actifs = OPEN seulement)
      const isOpen = a => !a.sessionStatus || a.sessionStatus === 'OPEN'
      const cutoffN2 = new Date(Date.now() - seuils.n2.horizon * 86_400_000)
      const filteredN2 = arrets.filter(a => a.equipId === id && new Date(a.startTime) >= cutoffN2 && isOpen(a))
      const cumulN2 = filteredN2.reduce((s, a) => s + (a.duration  || 0), 0)
      const freqN2  = filteredN2.reduce((s, a) => s + (a.frequence || 1), 0)

      const cutoffN1 = new Date(Date.now() - seuils.n1.horizon * 86_400_000)
      const filteredN1 = arrets.filter(a => a.equipId === id && new Date(a.startTime) >= cutoffN1 && isOpen(a))
      const cumulN1 = filteredN1.reduce((s, a) => s + (a.duration  || 0), 0)
      const freqN1  = filteredN1.reduce((s, a) => s + (a.frequence || 1), 0)
      
      const statutN2 = getStatut(cumulN2, freqN2, seuils)
      const statutN1 = getStatut(cumulN1, freqN1, seuils)
      
      const isAlert = statutN2 === 'alert'
      const statut = isAlert ? 'alert' : statutN1
      const cumul = isAlert ? cumulN2 : cumulN1
      const freq = isAlert ? freqN2 : freqN1
      
      const allFiltered = arrets.filter(a => a.equipId === id)
      const dernierArret = [...allFiltered].sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0] || null
      
      return { id, cumul, freq, statut, dernierArret }
    }).filter(r => (r.cumul > 0 || r.freq > 0) && (r.statut === 'alert' || r.statut === 'watch'))
  }, [arrets, seuils])

  const { histData, histCumul, histNbArrets } = useMemo(() => {
    const equipIds = [...new Set(arrets.map(a => a.equipId))]
    const stats = equipIds.map(id => {
      const allArrets = arrets.filter(a => { 
        const dt = new Date(a.startTime)
        return a.equipId === id && dt >= histDebut && dt <= histFin
      })
      
      // 🔥 CORRECTION : Pour l'historique, on garde TOUTES les sessions (CLOSED + OPEN)
      // Car l'historique doit montrer le cumul total sur la période
      const cumul = allArrets.reduce((s, a) => s + (a.duration  || 0), 0)
      const freq  = allArrets.reduce((s, a) => s + (a.frequence || 1), 0)
      return { id, cumul, freq }
    }).filter(d => d.cumul > 0 || d.freq > 0)
    return { histData: stats, histCumul: stats.reduce((s, d) => s + d.cumul, 0), histNbArrets: stats.reduce((s, d) => s + d.freq, 0) }
  }, [arrets, histDebut, histFin])

  const pctCapture = paretoCumul > 0 ? ((badActors.reduce((s, r) => s + r.cumul, 0) / paretoCumul) * 100).toFixed(1) : '0'
  const counts = { alert: paretoItems.filter(r => r.statut === 'alert').length, watch: paretoItems.filter(r => r.statut === 'watch').length, normal: paretoItems.filter(r => r.statut === 'normal').length }

  const [rcaSessions, setRcaSessions] = useState([])
  useEffect(() => {
    api.getSessions().then(setRcaSessions).catch(() => {})
  }, [])

  const rcaStats = useMemo(() => {
    const total = alertItems.length
    const clotures = rcaSessions.filter(s => s.statut === 'cloturee').length
    const aRealiser = alertItems.filter(item => !rcaSessions.some(s => s.equipId === item.id && s.statut === 'cloturee')).length
    return { total, clotures, aRealiser }
  }, [alertItems, rcaSessions])

  useEffect(() => {
    if (selectedCrossItemId && selectedCrossRowRef.current) {
      selectedCrossRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedCrossItemId])

  const tableData = badActors.filter(r => !search.trim() || r.id.toLowerCase().includes(search.toLowerCase()))
  const sortedByFreq = [...paretoItems].sort((a, b) => b.freq - a.freq)
  const totalFreq = sortedByFreq.reduce((s, r) => s + r.freq, 0)
  const topFreqItems = getParetoSegment(sortedByFreq, 'freq', 20)
  const badActorsFreq = getParetoSegment(sortedByFreq, 'freq', 80)
  const pctCaptureFreq = totalFreq > 0 ? ((badActorsFreq.reduce((s, r) => s + r.freq, 0) / totalFreq) * 100).toFixed(1) : '0'
  const totalCumul = paretoCumul || 0
  let runCumul = 0
  const sortedByCumul = [...paretoItems].sort((a, b) => b.cumul - a.cumul)
  const topCumulItems = getParetoSegment(sortedByCumul, 'cumul', 20)
  const topFreqIds = new Set(topFreqItems.map(r => r.id))
  const topCumulIds = new Set(topCumulItems.map(r => r.id))
  const freqThreshold = topFreqItems.length ? Math.min(...topFreqItems.map(r => r.freq)) : 0
  const cumulThreshold = topCumulItems.length ? Math.min(...topCumulItems.map(r => r.cumul)) : 0
  const crossItems = paretoItems.map(item => {
    const isTopFreq = topFreqIds.has(item.id)
    const isTopCumul = topCumulIds.has(item.id)
    const criticite = isTopFreq && isTopCumul ? 'Critique' : (isTopFreq || isTopCumul) ? 'Élevé' : 'Faible'
    return {
      ...item,
      isTopFreq,
      isTopCumul,
      criticite,
    }
  })
  const crossTopItems = crossItems.filter(item => item.isTopFreq || item.isTopCumul)
  // Show all items in the cross-analysis table, but allow filtering by criticity
  const filteredCrossItems = filterImpact === 'all' ? crossItems : crossItems.filter(item => item.criticite === filterImpact)
  const selectedCrossItem = filteredCrossItems.find(item => item.id === selectedCrossItemId) || null
  const scatterMaxFreq = paretoItems.length ? Math.max(...paretoItems.map(item => item.freq), 1) : 1
  const scatterMaxCumul = paretoItems.length ? Math.max(...paretoItems.map(item => item.cumul), 1) : 1
  const scatterXThreshold = scatterMaxFreq > 0 ? 60 + (freqThreshold / scatterMaxFreq) * 440 : 60
  const scatterYThreshold = scatterMaxCumul > 0 ? 320 - (cumulThreshold / scatterMaxCumul) * 280 : 320

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── 3 BOUTONS VUE ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          {
            key: 'pareto',
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><path d="M2 20h20"/><path d="M6 14 Q12 8 18 10" strokeDasharray="3 2"/></svg>,
            label: null,
            labelLine1: 'Vue Pareto',
            labelLine2: 'Bad Actors',
            stat: null,
            statColor: '#94a3b8',
            customStat: null,
          },
          {
            key: 'alert',
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
            label: 'Suivi équipements RCA',
            labelLine1: null, labelLine2: null,
            stat: null,
            statColor: '#94a3b8',
            customStat: alertItems.length > 0 ? { total: rcaStats.total, aRealiser: rcaStats.aRealiser, clotures: rcaStats.clotures } : null,
          },
          {
            key: 'histogram',
            icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/><line x1="1" y1="22" x2="23" y2="22"/></svg>,
            label: 'Cumul total arrêts',
            labelLine1: null, labelLine2: null,
            stat: histCumul > 0 ? `${histCumul.toFixed(1)}h · ${histNbArrets} arrêt${histNbArrets > 1 ? 's' : ''}` : 'aucune donnée',
            statColor: histCumul > 0 ? C.navy : '#94a3b8',
            customStat: null,
          },
        ].map(({ key, icon, label, labelLine1, labelLine2, stat, statColor, customStat }) => {
          const active = viewMode === key
          return (
            <button key={key} onClick={() => { setViewMode(key); setSearch('') }} style={{
              padding: '10px 22px 9px', borderRadius: 30,
              background: active ? C.navy : '#fff', color: active ? '#fff' : C.text3,
              border: `1.5px solid ${active ? C.navy : C.border2}`,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif", transition: 'all .15s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 170,
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.color = C.navy } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text3 } }}>
              {labelLine1 ? (
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {labelLine1}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{labelLine2}</span>
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {label}</span>
              )}
              {customStat ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700 }}>
                  <span style={{ color: active ? 'rgba(255,255,255,.9)' : C.text3 }}>{customStat.total} équip.</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ color: active ? 'rgba(255,255,255,.85)' : '#dc2626' }}>{customStat.aRealiser} à réaliser</span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span style={{ color: active ? 'rgba(255,255,255,.85)' : '#059669' }}>{customStat.clotures} clôturé{customStat.clotures > 1 ? 's' : ''}</span>
                </span>
              ) : stat !== null ? (
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? 'rgba(255,255,255,.75)' : statColor, transition: 'color .15s' }}>{stat}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* ── HEADER ── */}
      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: viewMode === 'alert' ? '14px 14px 0 0' : '14px 14px 0 0', padding: '12px 20px', borderBottom: `1px solid ${C.border}`, position: 'relative', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Tableau Pareto</div>
              {viewMode === 'alert' && (
                null
              )}
            </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {(viewMode === 'pareto' || viewMode === 'histogram') && (() => {
              const debutStr = viewMode === 'pareto' ? paretoDebutStr : histDebutStr
              const finStr = viewMode === 'pareto' ? paretoFinStr : histFinStr
              const setDebut = viewMode === 'pareto' ? setParetoDebutStr : setHistDebutStr
              const setFin = viewMode === 'pareto' ? setParetoFinStr : setHistFinStr
              return (
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowDatePicker(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: showDatePicker ? C.bluePale : '#fff', border: `1.5px solid ${showDatePicker ? C.navy : C.border2}`, borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.navy, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', transition: 'all .15s' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Horizon : {fmtDate(debutStr)} → {fmtDate(finStr)}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.text4} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {showDatePicker && (
                    <>
                      <div onClick={() => setShowDatePicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 99, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.15)', padding: '16px', minWidth: 260 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text3, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.5px' }}>Horizon — {viewMode === 'pareto' ? 'Pareto Bad Actors' : 'Cumul total arrêts'}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, color: C.text4, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date début</label>
                            <input type="date" value={debutStr} max={finStr} onChange={e => setDebut(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12.5, fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, color: C.text4, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date fin</label>
                            <input type="date" value={finStr} min={debutStr} onChange={e => setFin(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12.5, fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                            {[
                              { label: 'Ce mois', action: () => { const d = new Date(); setDebut(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)); setFin(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)) } },
                              { label: 'Cette année', action: () => { const d = new Date(); setDebut(new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10)); setFin(d.toISOString().slice(0, 10)) } },
                              { label: '1 an', action: () => { const d = new Date(); setDebut(new Date(d.getFullYear() - 1, d.getMonth(), d.getDate()).toISOString().slice(0, 10)); setFin(d.toISOString().slice(0, 10)) } },
                            ].map(({ label, action }) => (
                              <button key={label} onClick={action} style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg2, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: C.text3, fontFamily: "'DM Sans', sans-serif", transition: 'all .15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.color = C.navy }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text3 }}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

              {(viewMode === 'pareto' || viewMode === 'alert') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, minWidth: 200 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.text4} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un poste technique..."
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: C.text, fontFamily: "'DM Sans', sans-serif", width: '100%' }} />
                {viewMode === 'pareto' && (
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ marginLeft: 8, padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', fontSize: 12, color: C.text4 }} title="Trier">
                    <option value="cumul">Trier par cumul durée</option>
                    <option value="freq">Trier par cumul fréquence</option>
                  </select>
                )}
                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text4, fontSize: 14, lineHeight: 1 }}>✕</button>}
              </div>
            )}
          </div>
        </div>
      </div>

      

      {/* ─── VUE 1 : PARETO ─────────────────────────────────────────────────── */}
      {viewMode === 'pareto' && (
        paretoItems.length === 0 ? (
          <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '0 0 14px 14px', borderTop: 'none', padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16, opacity: .35 }}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><path d="M2 20h20"/>
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text3, marginBottom: 6 }}>Aucun arrêt enregistré sur cette période</div>
            <div style={{ fontSize: 12.5, color: C.text4 }}>Changez la période ou importez des données dans l'onglet <strong>Data TUM</strong></div>
          </div>
        ) : (
          <div ref={paretoViewRef} style={{ display: 'flex', flexDirection: 'column', background: '#f8fafd', border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden', gap: 0 }}>

            {/* ── Bouton export PDF vue Pareto complète ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px 0' }}>
              <ExportParetoPDFButton containerRef={paretoViewRef} />
            </div>

            {/* ── BLOC 1 : Pareto Cumul Durée — Tableau + Graphique ── */}
            <div style={{ background: '#fff', borderBottom: `2px solid ${C.border}` }}>

              

              {/* Tableau unifié — Cumul et Fréquence (80/20) */}
              {(() => {
                const sorted = [...paretoItems].sort((a, b) => {
                  if (sortBy === 'freq') return b.freq - a.freq
                  // default: cumul
                  return b.cumul - a.cumul
                })
                const totalC = paretoCumul || 0
                const totalF = paretoNbArrets || 0
                let runC = 0
                let runF = 0
                const rows = sorted.map((r, i) => {
                  const pctC = totalC > 0 ? (r.cumul / totalC) * 100 : 0
                  const pctF = totalF > 0 ? (r.freq / totalF) * 100 : 0
                  runC += pctC
                  runF += pctF
                  return { ...r, rank: i + 1, pctC, cumPctC: Math.min(runC, 100), pctF, cumPctF: Math.min(runF, 100) }
                }).filter(r => !search.trim() || r.id.toLowerCase().includes(search.toLowerCase()))

                return rows.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: C.bg, position: 'sticky', top: 0, zIndex: 1 }}>                          {['Rang', 'Poste technique', 'Zone géo.', 'Cumul durée (h)', 'Cumul fréquence (fois)', 'Dernière panne', 'Cause arrêt', 'Statut'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.7px', borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((d, idx) => {
                          const datePanne = d.dernierArret ? new Date(d.dernierArret.startTime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
                          const cause = d.dernierArret?.cause || '—'
                          return (
                            <tr key={d.id} style={{ borderBottom: `1px solid ${C.bg2}`, transition: 'background .1s', background: selectedCrossItemId === d.id ? '#eef2ff' : 'transparent', cursor: 'pointer' }}
                              onClick={() => setSelectedCrossItemId(d.id)}
                              onMouseEnter={e => e.currentTarget.style.background = '#f0f5ff'}
                              onMouseLeave={e => e.currentTarget.style.background = selectedCrossItemId === d.id ? '#eef2ff' : 'transparent'}>
                              <td style={{ padding: '12px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#64748b', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>{d.rank}</div>
                              </td>
                              <td style={{ padding: '12px 8px 12px 12px' }}>
                                <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13, color: C.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.id}</div>
                              </td>
                              <td style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>{d.dernierArret?.zone || '—'}</span>
                              </td>
                              <td style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: 800, fontSize: 14, color: C.navy, fontFamily: "'Sora', sans-serif" }}>{d.cumul.toFixed(1)}h</div>
                                <div style={{ fontSize: 11, color: C.text4, marginTop: 4 }}>
                                  <span style={{ display: 'inline-flex', gap: 8 }}>
                                    <span>{d.pctC.toFixed(1)}%</span>
                                    <span>{d.cumPctC.toFixed(1)}%</span>
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: 800, fontSize: 14, color: C.navy, fontFamily: "'Sora', sans-serif" }}>{d.freq} fois</div>
                                <div style={{ fontSize: 11, color: C.text4, marginTop: 4 }}>
                                  <span style={{ display: 'inline-flex', gap: 8 }}>
                                    <span>{d.pctF.toFixed(1)}%</span>
                                    <span>{d.cumPctF.toFixed(1)}%</span>
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 12px', color: C.text3, fontSize: 12, whiteSpace: 'nowrap' }}>{datePanne}</td>
                              <td style={{ padding: '12px 12px' }}>
                                <span style={{ display: 'block', fontSize: 12, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cause}>{cause}</span>
                              </td>
                              <td style={{ padding: '12px 12px', whiteSpace: 'nowrap' }}><StatutBadge statut={d.statut} /></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
              {/* Graphique Cumul */}
              <div style={{ padding: '20px 20px 24px' }}>
                <div ref={paretoCumulCardRef} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '18px 16px 14px', boxShadow: '0 1px 8px rgba(15,30,53,.06)' }}>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1E35', marginBottom: 6 }}>Pareto cumul durée</div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: 10.5, color: C.text4 }}>{badActors.length} postes techniques représentent <strong style={{ color: '#dc2626' }}>{pctCapture}%</strong> du temps d'arrêt total</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <CopyButton cardRef={paretoCumulCardRef} filename="pareto-cumul-duree.png" />
                        <PDFButton cardRef={paretoCumulCardRef} filename="pareto-cumul-duree.pdf" />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                    {[
                      { lbl: 'Cumul total', val: `${paretoCumul.toFixed(1)}h`, col: C.navy },
                      { lbl: 'Bad Actors', val: badActors.length, col: '#dc2626' },
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
                  <div style={{ overflow: 'auto' }}>
                    <svg ref={paretoCumulRef} viewBox={`0 0 ${Math.max(720, 120 + paretoItems.length * 58)} 420`} style={{ width: '100%', minWidth: Math.max(720, 120 + paretoItems.length * 58), height: '340px', display: 'block', overflow: 'visible', background: '#fff' }}>
                      <ParetoSVGCumul items={paretoItems} />
                    </svg>
                  </div>
                  {badActors.length > 0 && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#eff6ff', borderLeft: '3px solid #1a3a6b', borderRadius: '0 8px 8px 0', fontSize: 12, color: '#1e3a5f', lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 700 }}>Interprétation — </span>
                      Les postes techniques identifiés ci-dessus concentrent la majorité du temps d'arrêt cumulé, conformément au principe de Pareto (80/20).
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── BLOC 2 : Pareto Fréquence — Tableau + Graphique ── */}
            <div style={{ background: '#fff' }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 14px', borderBottom: `1px solid ${C.border}`, background: '#fff' }}>
                {/* title removed */}
                
              </div>

              {/* Tableau Fréquence remplacé par tableau unifié */}
              {/* Graphique Fréquence */}
              <div style={{ padding: '20px 20px 24px' }}>
                <div ref={paretoFreqCardRef} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '18px 16px 14px', boxShadow: '0 1px 8px rgba(15,30,53,.06)' }}>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F1E35', marginBottom: 6 }}>Pareto cumul fréquence</div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: 10.5, color: C.text4 }}>{badActorsFreq.length} postes techniques représentent <strong style={{ color: '#dc2626' }}>{pctCaptureFreq}%</strong> du nombre total d'arrêts</div>
                      <CopyButton cardRef={paretoFreqCardRef} filename="pareto-frequence-arrets.png" />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                    {[
                      { lbl: 'Cumul total arrêts', val: paretoNbArrets, col: C.navy },
                      { lbl: 'Bad Actors fréq.', val: badActorsFreq.length, col: '#dc2626' },
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
                  <div style={{ overflow: 'auto' }}>
                    <svg ref={paretoFreqRef} viewBox={`0 0 ${Math.max(720, 120 + paretoItems.length * 58)} 420`} style={{ width: '100%', minWidth: Math.max(720, 120 + paretoItems.length * 58), height: '340px', display: 'block', overflow: 'visible', background: '#fff' }}>
                      <ParetoSVGFreq items={paretoItems} />
                    </svg>
                  </div>
                  {badActorsFreq.length > 0 && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#eff6ff', borderLeft: '3px solid #1a3a6b', borderRadius: '0 8px 8px 0', fontSize: 12, color: '#1e3a5f', lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 700 }}>Interprétation — </span>
                      Les postes techniques identifiés présentent la fréquence de défaillance la plus élevée et nécessitent une attention particulière en maintenance.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', borderTop: `1px solid ${C.border}`, padding: '22px 20px 24px' }}>
              <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Analyse de criticité croisée Pareto</div>
                  <div style={{ fontSize: 12.5, color: C.text4, marginTop: 6, maxWidth: 560, lineHeight: 1.5, margin: '0 auto' }}>
                    Méthode : sélection du top 20% des équipements selon la fréquence des pannes et la durée des arrêts, puis analyse de leur intersection afin d'identifier les équipements critiques à double impact.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {[
                    { key: 'all', label: 'Tous', color: '#374151' },
                    { key: 'Critique', label: 'Critique', color: '#dc2626' },
                    { key: 'Élevé', label: 'Élevé', color: '#f59e0b' },
                    { key: 'Faible', label: 'Faible', color: '#16a34a' },
                  ].map(b => (
                    <button
                      key={b.key}
                      onClick={() => setFilterImpact(b.key)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10,
                        border: `1.5px solid ${filterImpact === b.key ? (b.key === 'all' ? '#cbd5e1' : b.color) : '#e6eef8'}`,
                        background: filterImpact === b.key ? (b.key === 'all' ? '#fff' : `${b.color}15`) : '#fff',
                        color: filterImpact === b.key ? (b.key === 'all' ? '#111827' : b.color) : '#111827',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      {b.key !== 'all' && <span style={{ width: 10, height: 10, borderRadius: 999, background: b.color, display: 'inline-block' }} />}
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'stretch', width: '100%', overflow: 'visible' }}>
                <div style={{ flex: '1.8 1 600px', minWidth: 360, maxWidth: 640, display: 'flex', flexDirection: 'column', alignItems: 'stretch', minHeight: 560 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', textAlign: 'center' }}>Scatter plot</div>
                    <button onClick={() => setShowScatterInfo(true)} title="Info scatter" style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/></svg>
                    </button>
                  </div>
                  <div style={{ width: '100%', background: '#fff', borderRadius: 18, border: `1px solid ${C.border}`, padding: 18, boxShadow: '0 8px 28px rgba(15,23,42,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 560 }}>
                    <div style={{ width: '100%', maxWidth: 600, display: 'flex', justifyContent: 'center' }}>
                      <ProfessionalScatter
                        items={filteredCrossItems}
                        allItems={crossItems}
                        width={600}
                        height={470}
                        freqThreshold={freqThreshold}
                        cumulThreshold={cumulThreshold}
                        selectedId={selectedCrossItemId}
                        onPointClick={(id) => setSelectedCrossItemId(id)}
                        showLabels={false}
                      />
                    </div>
                    {showScatterInfo && (
                      <>
                        <div onClick={() => setShowScatterInfo(false)} style={{ position: 'fixed', inset: 0, zIndex: 220 }} />
                        <div style={{ position: 'fixed', top: '8%', left: '50%', transform: 'translateX(-50%)', zIndex: 221, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 12px 40px rgba(2,6,23,.28)', padding: 18, width: 'min(900px, 96%)', maxHeight: '80vh', overflowY: 'auto' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Les 4 quadrants</div>
                            <button onClick={() => setShowScatterInfo(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>✕</button>
                          </div>
                          {/* Table removed as requested; keep headings and explanation below */}
                          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Comment lire les points</div>
                          <ul style={{ marginTop: 0, lineHeight: 1.6 }}>
                            <li>Les points verts (cluster) = équipements avec un comportement normal/acceptable</li>
                            <li>Le point rouge = poste identifié comme critique (coin haut droite, priorité maximale)</li>
                            <li>Le point orange = équipement à surveiller, proche de la zone critique</li>
                            <li>La ligne pointillée orange marque les seuils au-delà desquels un équipement devient préoccupant</li>
                          </ul>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                            <button onClick={() => setShowScatterInfo(false)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700 }}>Fermer</button>
                          </div>
                        </div>
                      </>
                    )}
                    <div style={{ marginTop: 20, fontSize: 13, color: C.text4, lineHeight: 1.6, textAlign: 'center', width: '100%' }}>
                      <div>Axe X = fréquence des pannes</div>
                      <div>Axe Y = durée des arrêts</div>
                    </div>
                  </div>
                </div>

                <div style={{ flex: '1 1 650px', minWidth: 560, maxWidth: 720, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', minHeight: 560, marginTop: 16 }}>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, border: `1px solid ${C.border}`, padding: '20px 20px 24px', boxShadow: '0 6px 20px rgba(15,23,42,0.08)', minHeight: 560 }}>
                    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed', color: C.text, minWidth: 0 }}>
                        <colgroup>
                          <col style={{ width: '52%' }} />
                          <col style={{ width: '16%' }} />
                          <col style={{ width: '16%' }} />
                          <col style={{ width: '16%' }} />
                        </colgroup>
                        <thead>
                          <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>
                            {['Poste technique', 'Top fréquence', 'Top durée', 'Criticité'].map(h => (
                              <th key={h} style={{ padding: '12px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.7px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap', lineHeight: 1.2, overflow: 'visible', minWidth: h === 'Poste technique' ? 180 : 100 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCrossItems.map(item => (
                            <tr
                              key={item.id}
                              ref={selectedCrossItemId === item.id ? selectedCrossRowRef : null}
                              style={{ borderBottom: `1px solid ${C.bg2}`, background: selectedCrossItemId === item.id ? '#eef2ff' : 'transparent', transition: 'background .2s' }}
                              onClick={() => setSelectedCrossItemId(item.id)}
                            >
                              <td style={{ padding: '12px 10px', whiteSpace: 'normal', wordBreak: 'break-word', fontWeight: 700, color: C.navy, lineHeight: 1.4 }}>{item.id}</td>
                              <td style={{ padding: '12px 8px', textAlign: 'center', color: item.isTopFreq ? C.navy : C.text4 }}>{item.isTopFreq ? 'Oui' : 'Non'}</td>
                              <td style={{ padding: '12px 8px', textAlign: 'center', color: item.isTopCumul ? C.navy : C.text4 }}>{item.isTopCumul ? 'Oui' : 'Non'}</td>
                              <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                                  <span style={{ width: 10, height: 10, borderRadius: 999, background: item.criticite === 'Critique' ? '#dc2626' : item.criticite === 'Élevé' ? '#f59e0b' : '#16a34a' }} />
                                  <span style={{ fontWeight: 700, color: C.text }}>{item.criticite}</span>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )
      )}

      {/* ─── VUE 2 : SUIVI RCA — tableau Image 1 ─── */}
      {viewMode === 'alert' && (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '0 0 14px 14px', borderTop: 'none', overflow: 'hidden', minHeight: 200 }}>
          <RCASuiviTableView alertItems={alertItems} arrets={arrets} arretsAll={arretsAll || arrets} seuils={seuils} onLancerRCA={onLancerRCA} search={search} setSearch={setSearch} />
        </div>
      )}

      {/* ─── VUE 3 : CUMUL TOTAL ARRÊTS ─────────────────────────────────────── */}
      {viewMode === 'histogram' && (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: '0 0 14px 14px', borderTop: 'none', overflow: 'hidden', padding: '22px 20px' }}>
          {histData.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>📊</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text3 }}>Aucune donnée sur cette période</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <CumulLineChart data={histData} seuilN1={seuils?.n1?.cumul || 2} seuilN2={seuils?.n2?.cumul || 4} seuilLabel="Cumul (h)" title="Cumul durée d'arrêt par équipement" unit="h" colorKey="cumul" svgRef={histCumulRef} />
                <CumulLineChart data={histData} seuilN1={seuils?.n1?.frequence || 2} seuilN2={seuils?.n2?.frequence || 3} seuilLabel="Fréquence (arrêts)" title="Cumul fréquence d'arrêts par équipement" unit=" arr." colorKey="freq" svgRef={histFreqRef} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
