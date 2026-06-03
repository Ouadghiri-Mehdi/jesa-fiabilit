// src/components/ia/IABasedSolutionPage.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import C from '../../tokens/colors'
import { api } from '../../lib/api'

const COLS = [
  { key: 'zone_geographique', label: 'Zone Géographique', keywords: ['zone_geographique', 'zone geographique', 'zone géographique', 'zone'] },
  { key: 'poste_technique',   label: 'Poste Technique',   keywords: ['poste_technique', 'poste technique', 'poste'] },
  { key: 'designation',       label: 'Désignation',        keywords: ['designation', 'désignation', 'désignation équipement'] },
  { key: 'niveau',            label: 'Niveau',             keywords: ['niveau'] },
  { key: 'categorie',         label: 'Catégorie',          keywords: ['categorie', 'catégorie'] },
  { key: 'date_debut',        label: 'Date Début',         keywords: ['date_debut', 'date debut', 'date début'] },
  { key: 'heure_debut',       label: 'Heure Début',        keywords: ['heure_debut', 'heure debut', 'heure début'] },
  { key: 'date_fin',          label: 'Date Fin',           keywords: ['date_fin', 'date fin'] },
  { key: 'heure_fin',         label: 'Heure Fin',          keywords: ['heure_fin', 'heure fin'] },
  { key: 'cause_arret',       label: "Cause d'Arrêt",      keywords: ["cause_arret", "cause d'arret", "cause d'arrêt", 'cause'] },
  { key: 'description',       label: 'Description',        keywords: ['description'] },
]

function findKey(headers, keywords) {
  return headers.find(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())))
}

const CRIT_STYLE = {
  CRITIQUE: { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5', dot: '#ef4444' },
  'MODÉRÉE':{ bg: '#fffbeb', color: '#d97706', border: '#fcd34d', dot: '#f59e0b' },
  FAIBLE:   { bg: '#f0fdf4', color: '#16a34a', border: '#86efac', dot: '#22c55e' },
}



function RiskBar({ score }) {
  const pct   = Math.round(score * 100)
  const color = pct >= 65 ? '#ef4444' : pct >= 35 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 30 }}>{pct}%</span>
    </div>
  )
}

function StepBtn({ label, onClick, loading, done, disabled, active }) {
  const bg     = active ? '#1a3a6b' : done ? '#f3f4f6' : disabled ? '#f9fafb' : '#fff'
  const border = active ? '#1a3a6b' : done ? '#d1d5db' : C.border2
  const color  = active ? '#fff'    : done ? '#6b7280' : disabled ? C.text4 : C.navy
  const iconColor = active ? '#fff' : '#475569'

  const Icon = () => {
    if (label === 'Arbre causal') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20v-4" />
          <path d="M8 16h8" />
          <path d="M12 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4Z" />
          <path d="M9 9.5c-1.1 0-2 .9-2 2s.9 2 2 2" />
          <path d="M15 9.5c1.1 0 2 .9 2 2s-.9 2-2 2" />
        </svg>
      )
    }
    if (label === 'Priorisation Agents') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 18h4" />
          <path d="M6 12h8" />
          <path d="M6 6h12" />
          <path d="M18 8l3-3-3-3" />
        </svg>
      )
    }
    if (label === 'AMDEC') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l6 3v5c0 4-2 7-6 8-4-1-6-4-6-8V6l6-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      )
    }
    return null
  }

  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: `1.5px solid ${border}`, background: bg, color,
      transition: 'all .15s', opacity: disabled ? 0.5 : 1,
    }}>
      {loading && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke={active ? '#fff' : 'currentColor'} strokeWidth="2.5"
          style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      )}
      {!loading && <Icon />}
      {loading ? 'Chargement…' : label}
    </button>
  )
}

function formatSyntheseParagraph(text) {
  if (text === null || text === undefined) return ''
  let cleaned = String(text).trim()
  cleaned = cleaned.replace(/\s+/g, ' ')
  cleaned = cleaned.replace(/^(l['’]orchestrateur mcp\s*)/i, '')
  cleaned = cleaned.replace(/^\s*(?:A|a) identifié\s+/i, 'La synthèse met en évidence ')
  cleaned = cleaned.replace(/^\s*([a-zàâäéèêëîïôöùûüç])/, (_, first) => first.toUpperCase())
  if (!/[.!?]$/.test(cleaned)) cleaned += '.'
  return cleaned
}

function SectionPanel({ title, children }) {
  return (
    <div style={{ marginTop: 16, background: '#fafafa', borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', background: C.bg, borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 12, color: C.navy }}>
        {title}
      </div>
      <div style={{ padding: 16 }}>
        {children}
      </div>
    </div>
  )
}

function CausesPanel({ data }) {
  if (!data?.causes?.length) return <p style={{ color: C.text3, fontSize: 13 }}>Aucune cause renseignée dans TUM pour cet équipement.</p>
  const max = Math.max(...data.causes.map(c => c.poids))
  return (
    <div>
      <p style={{ fontSize: 11, color: C.text3, margin: '0 0 12px' }}>{data.total_arrets} arrêt(s) sur 12 mois</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.causes.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.text, minWidth: 180, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={c.cause}>{c.cause}</span>
            <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(c.poids / max) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#1a3a6b,#7c3aed)', borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 11, color: C.text3, minWidth: 60, textAlign: 'right' }}>{c.freq}× {c.cumul_h}h</span>
            <span style={{ fontSize: 10, color: C.text4, minWidth: 36 }}>{c.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Nœud lecture seule (arbre IA) ──────────────────────────────────────────
const IA_CARD_W = 178
const IA_LEVEL_COLORS = [
  '#1a3a6b', '#2d5fa6', '#4a7fc1', '#7c3aed',
  '#0369a1', '#059669', '#b45309', '#be123c', '#6366f1',
]
const IA_LEVEL_LABELS = [
  'Phénomène',
  'Pourquoi 1', 'Pourquoi 2', 'Pourquoi 3',
  'Pourquoi 4', 'Pourquoi 5', 'Pourquoi 6',
  'Pourquoi 7', 'Pourquoi 8',
]

function IACauseNoeud({ noeud, depth }) {
  const isRoot   = depth === 0
  const color    = '#1a3a6b'
  const hasKids  = noeud.enfants?.length > 0
  const HALF_GAP = 6

  return (
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>

      {/* ── Carte ── */}
      <div style={{
        width: IA_CARD_W, flexShrink: 0,
        background: '#f1f5f9',
        border: '1.5px solid #d2d6dc',
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: '0 2px 8px rgba(15,30,53,.08)',
        minHeight: 68,
      }}>
        {/* Label de position : C1 / C1.1 / C2.1 … */}
        {!isRoot && noeud.nodeLabel && (
          <div style={{
            display: 'inline-block', fontSize: 9, fontWeight: 800,
            color: '#fff', background: color,
            borderRadius: 20, padding: '1px 7px', marginBottom: 5,
            letterSpacing: '.4px',
          }}>
            {noeud.nodeLabel}
          </div>
        )}
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#1a3a6b',
          lineHeight: 1.45,
        }}>
          {noeud.texte}
        </div>
        {isRoot && (
          <div style={{ fontSize: 9.5, color: '#1a3a6b', marginTop: 5, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a3a6b', display: 'inline-block' }} />
            Cause arret prédite
          </div>
        )}
      </div>

      {/* ── Connecteur + enfants ── */}
      {hasKids && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 32, height: 2, background: '#cbd5e1', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {noeud.enfants.map((enfant, i) => {
              const isFirst = i === 0
              const isLast  = i === noeud.enfants.length - 1
              const isOnly  = noeud.enfants.length === 1
              return (
                <div key={enfant.id} style={{ display: 'flex', alignItems: 'center',
                  position: 'relative', marginBottom: isLast ? 0 : 14 }}>
                  {!isOnly && (
                    <div style={{
                      position: 'absolute', left: -1, width: 2, background: '#cbd5e1',
                      top:    isFirst ? '50%' : -HALF_GAP,
                      bottom: isLast  ? '50%' : -HALF_GAP,
                    }} />
                  )}
                  <div style={{ width: 24, height: 2, background: '#cbd5e1', flexShrink: 0 }} />
                  <IACauseNoeud noeud={enfant} depth={depth + 1} nodeLabel={enfant.nodeLabel} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CauseTree({ data, equip_id, phenomene, defaillance }) {
  const [zoom, setZoom] = useState(1)
  if (!data?.arbre?.length) return null

  const MIN_ZOOM = 0.4, MAX_ZOOM = 1.4, ZOOM_STEP = 0.1
  const NAVY = '#1a3a6b'
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const delta = e.deltaY
      if (delta > 0) setZoom(z => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))
      else if (delta < 0) setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    const onKey = (e) => {
      if (e.key === '+' || (e.key === '=' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2))) }
      if (e.key === '-' || (e.key === '_' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); setZoom(z => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2))) }
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setZoom(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => { el.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKey) }
  }, [MIN_ZOOM, MAX_ZOOM, ZOOM_STEP])

  // Texte racine = défaillance prédite (en priorité), sinon phénomène, sinon équipement
  const rootTexte = defaillance && defaillance !== 'À déterminer'
    ? defaillance
    : (phenomene
        ? phenomene.replace(/\s*—\s*arrêt\s+forcé\s+[\d.,]+\s*h\b/i, '').trim()
        : equip_id || '')

  // Conversion récursive : supporte le nouveau format "enfants" ET l'ancien "sous_causes"
  function convertNode(n, labelPrefix) {
    // Nouveau format : enfants récursifs
    let kids = Array.isArray(n.enfants) && n.enfants.length > 0 ? n.enfants : null
    // Compat ancien format : sous_causes (array de strings ou objets)
    if (!kids && Array.isArray(n.sous_causes) && n.sous_causes.length > 0) {
      kids = n.sous_causes.map((sc, j) => ({
        id: `${labelPrefix}.${j + 1}`,
        cause: typeof sc === 'string' ? sc : (sc.label || sc.cause || ''),
        enfants: [],
      }))
    }
    return {
      id:        n.id || labelPrefix,
      texte:     n.cause || n.label || '',
      nodeLabel: n.id || labelPrefix,
      enfants:   kids ? kids.map((child, j) =>
        convertNode(child, `${labelPrefix}.${j + 1}`)
      ) : [],
    }
  }

  const tree = {
    id:        'root',
    texte:     rootTexte,
    nodeLabel: null,
    enfants:   data.arbre.map((n, i) => convertNode(n, `C${i + 1}`)),
  }

  // Calcul des largeurs de colonnes pour la bande de labels
  function getMaxDepth(n, d = 0) {
    if (!n.enfants?.length) return d
    return Math.max(...n.enfants.map(c => getMaxDepth(c, d + 1)))
  }
  const maxDepth  = getMaxDepth(tree)
  const colWidths = Array.from({ length: maxDepth + 1 }, (_, d) =>
    IA_CARD_W + (d < maxDepth ? 56 : 0)
  )

  return (
    <div>

      {/* ── Contrôles zoom ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc',
          border: '1.5px solid #e2e8f0', borderRadius: 20, padding: '3px 10px' }}>
          <button
            onClick={() => setZoom(z => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(1)))}
            disabled={zoom <= MIN_ZOOM}
            style={{ width: 24, height: 24, borderRadius: '50%', border: 'none',
              background: zoom <= MIN_ZOOM ? '#f1f5f9' : '#fff',
              color:      zoom <= MIN_ZOOM ? '#cbd5e1' : '#1a3a6b',
              cursor: zoom <= MIN_ZOOM ? 'not-allowed' : 'pointer',
              fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', minWidth: 36, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(1)))}
            disabled={zoom >= MAX_ZOOM}
            style={{ width: 24, height: 24, borderRadius: '50%', border: 'none',
              background: zoom >= MAX_ZOOM ? '#f1f5f9' : '#fff',
              color:      zoom >= MAX_ZOOM ? '#cbd5e1' : '#1a3a6b',
              cursor: zoom >= MAX_ZOOM ? 'not-allowed' : 'pointer',
              fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>
      </div>

      {/* ── Conteneur arbre ── */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#f8fafd' }}>

        {/* Bande labels de niveau */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0',
          padding: '6px 20px', gap: 0 }}>
          {colWidths.map((w, d) => (
            <div key={d} style={{ width: w * zoom, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <span style={{
                display: 'inline-block', fontSize: 10.5, fontWeight: 800,
                color: '#64748b', background: '#fff', border: '1.5px solid #e2e8f0',
                borderRadius: 20, padding: '3px 12px', letterSpacing: '.4px', whiteSpace: 'nowrap',
              }}>
                {IA_LEVEL_LABELS[d]}
              </span>
            </div>
          ))}
        </div>

        {/* Arbre zoomable + scrollable */}
        <div style={{ overflowX: 'auto', overflowY: 'auto' }} ref={containerRef}>
          <div style={{
            transformOrigin: 'top left',
            transform: `scale(${zoom})`,
            transition: 'transform .2s ease',
            width: `${100 / zoom}%`,
            padding: 20,
            minWidth: 'max-content',
          }}>
            <IACauseNoeud noeud={tree} depth={0} />
          </div>
        </div>
      </div>

    </div>
  )
}

function PrioritisationPanel({ data, leafIdMap = {} }) {
  const [expanded, setExpanded] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)

  if (!data?.scores?.length) return null

  const getMcpLevel = (niveau, score) => {
    const normalized = String(niveau || '').trim().toUpperCase().replace('ELEVÉ', 'ÉLEVÉ')
    if (normalized === 'CRITIQUE') return 'CRITIQUE'
    if (normalized === 'ÉLEVÉ') return 'ÉLEVÉ'
    if (normalized === 'MOYEN') return 'MOYEN'
    const s = parseFloat(score)
    if (!isNaN(s)) {
      if (s >= 0.85) return 'CRITIQUE'
      if (s >= 0.70) return 'ÉLEVÉ'
      if (s >= 0.50) return 'MOYEN'
    }
    return 'FAIBLE'
  }

  const priorityOrder = (niveau, score) => {
    const level = getMcpLevel(niveau, score)
    if (level === 'CRITIQUE') return 0
    if (level === 'ÉLEVÉ') return 1
    if (level === 'MOYEN') return 2
    return 3
  }

  const sorted = [...data.scores].sort((a, b) => {
    const pa = priorityOrder(a.niveau, a.score_mcp)
    const pb = priorityOrder(b.niveau, b.score_mcp)
    if (pa !== pb) return pa - pb
    return (a.rang || 99) - (b.rang || 99)
  })

  // Styles niveau MCP (alignés sur les règles fournies)
  const NIVEAU_STYLE = {
    'CRITIQUE': { bg: '#fee2e2', color: '#dc2626', border: '#fecaca', dot: '#dc2626' },
    'ÉLEVÉ':    { bg: '#fff7ed', color: '#b45309', border: '#ffedd5', dot: '#b45309' },
    'MOYEN':    { bg: '#fffbeb', color: '#f59e0b', border: '#fef3c7', dot: '#f59e0b' },
    'FAIBLE':   { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', dot: '#16a34a' },
  }

  // Labels agents pour le tableau détail
  const AGENTS = [
    { key: 'rca',         label: 'RCA (cause racine)',      color: '#1a3a6b' },
    { key: 'historique',  label: 'Récurrence (historique)', color: '#7c3aed' },
    { key: 'frequence',   label: 'Fréquence',               color: '#0369a1' },
    { key: 'duree',       label: 'Durée',                   color: '#d97706' },
    { key: 'propagation', label: 'Propagation',             color: '#dc2626' },
  ]

  // Valeur de score MCP
  function ScoreBar({ score, color }) {
    return (
      <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 34, display: 'inline-block', textAlign: 'right' }}>
        {score != null ? score.toFixed(2) : ''}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      

      {/* ── Table principale : Rang | Cause | Score MCP | Niveau ── */}
      <div style={{ borderRadius: 10, border: `1.5px solid ${C.border}`, overflow: 'hidden', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: C.text3, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', width: 60 }}>Rang</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: C.text3, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', width: 60 }}>Nœud</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: C.text3, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.6px', width: 280 }}>Cause</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.text3, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', width: 90 }}>Score</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.text3, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', width: 90 }}>Niveau</th>
              <th style={{ padding: '10px 10px', width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const isOpen  = expanded === i
              const isTop   = i === 0
              const normalizedLevel = getMcpLevel(s.niveau, s.score_mcp)
              const ns      = NIVEAU_STYLE[normalizedLevel] || NIVEAU_STYLE['FAIBLE']
              const mcpColor = ns.color
              const isLast  = i === sorted.length - 1

              return (
                <React.Fragment key={`prio-${i}`}>
                  {/* ── Ligne principale ── */}
                  <tr
                    key={`row-${i}`}
                    onClick={() => setExpanded(isOpen ? null : i)}
                    style={{
                      borderBottom: isOpen || isLast ? 'none' : `1px solid ${C.bg2}`,
                      background: isOpen ? '#f0f4ff' : isTop ? '#fafcff' : 'transparent',
                      cursor: 'pointer', transition: 'background .15s',
                    }}
                    onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#f8faff' }}
                    onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = isTop ? '#fafcff' : 'transparent' }}
                  >
                    {/* Rang */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: '50%', fontSize: 11, fontWeight: 800,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: isTop ? '#1a3a6b' : '#f1f5f9',
                        color: isTop ? '#fff' : '#64748b',
                      }}>{s.rang || i + 1}</span>
                    </td>

                    {/* Node ID */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {leafIdMap[s.cause] ? (
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: '#eef2f9',
                          color: '#1a3a6b',
                          fontFamily: "'JetBrains Mono', monospace", letterSpacing: '.3px',
                        }}>{leafIdMap[s.cause]}</span>
                      ) : (
                        <span style={{
                          width: 28, height: 28, borderRadius: '50%', fontSize: 11, fontWeight: 800,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: '#f1f5f9',
                          color: '#64748b',
                        }}>—</span>
                      )}
                    </td>

                    {/* Cause with inline Prioritaire badge */}
                    <td style={{ padding: '12px 14px', textAlign: 'left', fontWeight: isTop ? 700 : 600, color: C.navy, maxWidth: 320 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {['CRITIQUE', 'ÉLEVÉ'].includes(normalizedLevel) && (
                          <span style={{
                            fontSize: 9,
                            fontWeight: 800,
                            color: normalizedLevel === 'CRITIQUE' ? '#b91c1c' : '#7c2d12',
                            background: normalizedLevel === 'CRITIQUE' ? '#fee2e2' : '#fef3c7',
                            padding: '1px 6px',
                            borderRadius: 10,
                            textTransform: 'uppercase',
                            flex: '0 0 auto',
                          }}>
                            Prioritaire
                          </span>
                        )}
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left', overflowWrap: 'break-word' }}>{s.cause}</div>
                      </div>
                    </td>

                    {/* Score MCP — barre */}
                    <td style={{ padding: '12px 10px 12px 14px', textAlign: 'right', whiteSpace: 'nowrap', width: 90 }}>
                      <ScoreBar score={s.score_mcp} color={mcpColor} />
                    </td>

                    {/* Niveau text */}
                    <td style={{ padding: '12px 10px', textAlign: 'right', width: 90 }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700,
                        color: ns.color,
                        whiteSpace: 'nowrap',
                      }}>
                        {normalizedLevel || '—'}
                      </span>
                    </td>

                    {/* Info icon cell (aligned next to Statut) */}
                    <td style={{ padding: '12px 10px', textAlign: 'center', width: 32 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDetail(s)
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '0.7'
                          e.currentTarget.style.transform = 'scale(1.2)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1'
                          e.currentTarget.style.transform = 'scale(1)'
                        }}
                        title="Voir les détails"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
                          <path d="M12 8v4" />
                          <circle cx="12" cy="16" r="1" fill="#94a3b8" stroke="none" />
                        </svg>
                      </button>
                    </td>
                  </tr>

                  {/* ── Panel détail (agents + explication) ── */}
                  {isOpen && (
                    <tr key={`detail-${i}`}>
                      <td colSpan={5} style={{ padding: 0, borderBottom: isLast ? 'none' : `1px solid ${C.bg2}` }}>
                        <div style={{ padding: '16px 20px 18px', background: '#f8faff', borderTop: '1.5px solid #e0e9ff' }}>
                          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

                            {/* Tableau agents / valeur (style simplifié similaire à l'image 2) */}
                            <div style={{ minWidth: 260, background: '#f1f5f9', borderRadius: 10, padding: 12 }}>
                              <p style={{ fontSize: 10.5, fontWeight: 800, color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: '.7px', margin: '0 0 10px' }}>
                                Débat des agents
                              </p>
                              <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid #cbd5e1', background: '#f8fafc' }}>
                                <thead>
                                  <tr>
                                    <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#1a3a6b', textTransform: 'uppercase', background: '#e2e8f0', borderBottom: '1px solid #cbd5e1' }}>Agents</th>
                                    <th style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#1a3a6b', textTransform: 'uppercase', background: '#e2e8f0', borderBottom: '1px solid #cbd5e1' }}>Valeur</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {AGENTS.map((a, ai) => {
                                    const val = s.agents?.[a.key] ?? null
                                    return (
                                      <tr key={a.key} style={{ borderBottom: '1px solid #cbd5e1', background: ai % 2 === 0 ? '#f8fafc' : '#eef2f7' }}>
                                        <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#1a3a6b' }}>{a.label}</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: val !== null ? '#1a3a6b' : '#475569' }}>
                                          {val !== null ? val.toFixed(2) : ''}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                  <tr style={{ background: '#e2e8f0' }}>
                                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 800, color: '#1a3a6b' }}>Score final</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 900, color: '#1a3a6b' }}>{s.score_mcp != null ? s.score_mcp.toFixed(2) : ''}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            {/* Explication automatique */}
                            {s.explication && (
                              <div style={{ flex: 1, minWidth: 200 }}>
                                <p style={{ fontSize: 10.5, fontWeight: 800, color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: '.7px', margin: '0 0 10px' }}>
                                  Explication automatique
                                </p>
                                <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', fontSize: 12.5, color: '#334155', lineHeight: 1.65 }}>
                                  {s.explication}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      

      {/* ── Synthèse globale MCP ── */}
      {data.synthese_globale && (
        <div style={{ background: '#f0f4ff', border: '1.5px solid #c7d4eb', borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 12, background: '#eef2ff' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="7" width="16" height="12" rx="4" />
              <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <circle cx="9" cy="13" r="1.5" fill="#1e40af" stroke="none" />
              <circle cx="15" cy="13" r="1.5" fill="#1e40af" stroke="none" />
              <path d="M9 17c1 1.333 3 1.333 4 0" />
            </svg>
          </span>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 800, color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: '.7px', margin: '0 0 6px' }}>Synthèse</p>
            <p style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.65, margin: 0 }}>
              {formatSyntheseParagraph(data.synthese_globale)}
            </p>
          </div>
        </div>
      )}

      {/* ── Modal détail agents ── */}
      {selectedDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }} onClick={() => setSelectedDetail(null)}>
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1.5px solid ${C.border}`,
              maxWidth: 720,
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: 24,
              boxShadow: '0 20px 25px rgba(15, 23, 42, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Titre avec cause */}
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 800, color: C.navy }}>
                Détails de la cause
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: C.text, fontWeight: 600 }}>
                {selectedDetail.cause}
              </p>
            </div>

            {/* Contenu : Débat des agents + Explication */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Tableau agents / valeur */}
              <div style={{ minWidth: 260 }}>
                <p style={{ fontSize: 10.5, fontWeight: 800, color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: '.7px', margin: '0 0 12px' }}>
                  Débat des agents
                </p>
                <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid #cbd5e1', background: '#f8fafc' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#1a3a6b', textTransform: 'uppercase', background: '#e2e8f0', borderBottom: '1px solid #cbd5e1' }}>Agents</th>
                      <th style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontWeight: 800, color: '#1a3a6b', textTransform: 'uppercase', background: '#e2e8f0', borderBottom: '1px solid #cbd5e1' }}>Valeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AGENTS.map((a, ai) => {
                      const val = selectedDetail.agents?.[a.key] ?? null
                      return (
                        <tr key={a.key} style={{ borderBottom: '1px solid #cbd5e1', background: ai % 2 === 0 ? '#f8fafc' : '#eef2f7' }}>
                          <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#1a3a6b' }}>{a.label}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: val !== null ? '#1a3a6b' : '#475569' }}>
                            {val !== null ? val.toFixed(2) : ''}
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{ background: '#e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 800, color: '#1a3a6b' }}>Score final</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 900, color: '#1a3a6b' }}>{selectedDetail.score_mcp != null ? selectedDetail.score_mcp.toFixed(2) : ''}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Explication automatique */}
              {selectedDetail.explication && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontSize: 10.5, fontWeight: 800, color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: '.7px', margin: '0 0 12px' }}>
                    Explication automatique
                  </p>
                  <div style={{ background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', fontSize: 12.5, color: '#334155', lineHeight: 1.65 }}>
                    {selectedDetail.explication}
                  </div>
                </div>
              )}
            </div>

            {/* Bouton fermer */}
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedDetail(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: '#fff',
                  color: C.navy,
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = C.bg
                  e.currentTarget.style.borderColor = C.navy
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff'
                  e.currentTarget.style.borderColor = C.border
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AmdecPanel({ data, leafIdMap = {} }) {
  if (!data?.amdec?.length) return null

  const getAmdecLevel = (rpn) => {
    const value = parseFloat(rpn)
    if (isNaN(value)) return 'Moyen'
    if (value >= 300) return 'Critique'
    if (value >= 200) return 'Élevé'
    if (value >= 100) return 'Moyen'
    return 'Faible'
  }

  const STATUT_STYLE = {
    'Critique': { bg: '#fee2e2', color: '#dc2626', border: '#fecaca', dot: '#dc2626' },
    'Élevé':    { bg: '#fff7ed', color: '#b45309', border: '#ffedd5', dot: '#b45309' },
    'Moyen':    { bg: '#fffbeb', color: '#f59e0b', border: '#fef3c7', dot: '#f59e0b' },
    'Faible':   { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', dot: '#16a34a' },
  }
  const TYPE_RECO = {
    'maintenance':  { color: '#7c3aed', bg: '#f5f3ff' },
    'inspection':   { color: '#0369a1', bg: '#f0f9ff' },
    'surveillance': { color: '#059669', bg: '#f0fdf4' },
  }
  const PRIO_RECO = { haute: '#dc2626', moyenne: '#d97706', faible: '#16a34a' }

  const STATUT_RECO = {
    'Ouvert':      { bg: '#f0f9ff', color: '#0369a1', border: '#0369a1' },
    'En cours':    { bg: '#fffbeb', color: '#d97706', border: '#d97706' },
    'Cloturé':     { bg: '#f0fdf4', color: '#16a34a', border: '#16a34a' },
  }

  const recommandationsByCause = (data.recommandations || []).reduce((acc, item) => {
    if (item?.cause) acc[item.cause] = item
    return acc
  }, {})

  const sorted = [...data.amdec]
    .map(row => ({ ...row, computedStatut: getAmdecLevel(row.RPN) }))
    .sort((a, b) => (b.RPN || 0) - (a.RPN || 0))
  const [selected, setSelected] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const [recoStatus, setRecoStatus] = useState({}) // Tracker les statuts des recommandations
  const [statusDropdown, setStatusDropdown] = useState(null)

  const displayHighOnly = sorted.some(row => ['Critique', 'Élevé'].includes(row.computedStatut))
  const visibleRows = sorted.filter(row => {
    if (displayHighOnly) return ['Critique', 'Élevé'].includes(row.computedStatut)
    return row.computedStatut !== 'Faible'
  })

  if (visibleRows.length === 0) {
    return (
      <div style={{ padding: 18, borderRadius: 10, background: '#f8fafc', border: `1.5px solid ${C.border}` }}>
        <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>Aucune cause AMDEC disponible après filtrage des statuts.</p>
      </div>
    )
  }

  const updateRecoStatus = (cause, status) => {
    setRecoStatus(prev => ({ ...prev, [cause]: status }))
    setStatusDropdown(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Modal Info ── */}
      {showInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }} onClick={() => setShowInfo(false)}>
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              border: `1.5px solid ${C.border}`,
              maxWidth: 600,
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: 16,
              boxShadow: '0 20px 25px rgba(15, 23, 42, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: C.navy }}>
              Guide AMDEC - Légende RPN
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 10, borderRadius: 8, overflow: 'hidden', border: `1px solid #ccc` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <tbody>
                  {[
                    { label: 'RPN ≥ 300', status: 'Critique', color: '#dc2626', bg: '#fef2f2', desc: 'Risque critique nécessitant une action immédiate' },
                    { label: 'RPN 200-299', status: 'Élevé', color: '#d97706', bg: '#fffbeb', desc: 'Risque élevé nécessitant une attention rapide' },
                    { label: 'RPN 100-199', status: 'Moyen', color: '#ca8a04', bg: '#fefce8', desc: 'Risque moyen à surveiller et améliorer' },
                    { label: 'RPN < 100', status: 'Faible', color: '#16a34a', bg: '#ecfdf5', desc: 'Risque faible, monitorer régulièrement' },
                  ].map((item) => (
                    <tr key={item.label} style={{ borderBottom: `1px solid #ccc` }}>
                      <td style={{ padding: '6px 10px', background: item.bg, fontWeight: 700, color: item.color, whiteSpace: 'nowrap', borderRight: `1px solid #ccc` }}>
                        {item.label}{item.status}
                      </td>
                      <td style={{ padding: '6px 10px', background: item.bg, color: '#475569' }}>
                        {item.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ borderRadius: 8, border: `1px solid #ccc`, overflow: 'hidden', marginBottom: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <tbody>
                  <tr style={{ borderBottom: `1px solid #ccc` }}>
                    <td style={{ padding: '6px 10px', background: '#f0f0f0', fontWeight: 700, color: '#333', textAlign: 'center' }}>Formule RPN:</td>
                  </tr>
                  <tr style={{ borderBottom: `1px solid #ccc` }}>
                    <td style={{ padding: '6px 10px', background: '#fff', fontFamily: 'monospace', fontWeight: 600, color: '#333', textAlign: 'center' }}>
                      RPN = F × G × D
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 10px', background: '#fff', color: '#666', fontSize: 10, textAlign: 'center' }}>
                      Où: <strong>F</strong> = Fréquence | <strong>G</strong> = Gravité | <strong>D</strong> = Détectabilité
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={() => setShowInfo(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: '#fff',
                  color: C.navy,
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = C.bg
                  e.currentTarget.style.borderColor = C.navy
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff'
                  e.currentTarget.style.borderColor = C.border
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tableau AMDEC ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.navy }}>
          AMDEC — Causes retenues · Niveau de risque · Recommandations · Décision
        </h3>
        <button
          onClick={() => setShowInfo(!showInfo)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.7'
            e.currentTarget.style.transform = 'scale(1.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.transform = 'scale(1)'
          }}
          title="Informations sur la légende"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a3a6b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4"/>
            <path d="M12 8h.01"/>
          </svg>
        </button>
      </div>
      <div style={{ borderRadius: 16, border: '1.5px solid #cbd5e1', overflow: 'hidden', width: '100%', background: '#fff', boxShadow: '0 4px 6px rgba(15, 23, 42, 0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: '#1a3a6b', borderBottom: `2px solid #0f1a35` }}>
              <th style={{ padding: '14px 10px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 10, textTransform: 'uppercase', width: 90, borderRight: `1.5px solid #3d5a8e` }}>Noeud</th>
              <th style={{ padding: '14px 14px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.6px', borderRight: `1.5px solid #3d5a8e` }}>Causes retenues</th>
              <th style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 10, textTransform: 'uppercase', width: 50, borderRight: `1.5px solid #3d5a8e` }} title="Gravité (1-10)">G</th>
              <th style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 10, textTransform: 'uppercase', width: 50, borderRight: `1.5px solid #3d5a8e` }} title="Fréquence (1-10)">F</th>
              <th style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 10, textTransform: 'uppercase', width: 50, borderRight: `1.5px solid #3d5a8e` }} title="Détectabilité (1-10)">D</th>
              <th style={{ padding: '14px 12px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', width: 80, borderRight: `1.5px solid #3d5a8e` }}>RPN</th>
              <th style={{ padding: '14px 14px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', width: 120, borderRight: `1.5px solid #3d5a8e` }}>Statut</th>
              <th style={{ padding: '14px 14px', textAlign: 'center', fontWeight: 700, color: '#fff', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>Recommandations</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => {
              const ss = STATUT_STYLE[row.computedStatut] || STATUT_STYLE['Moyen']
              const recommendationObj = recommandationsByCause[row.cause]
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: `1px solid #e2e8f0` }}>
                  <td style={{ padding: '14px 10px', textAlign: 'center', fontWeight: 600, color: '#1a3a6b', borderRight: `1px solid #e2e8f0` }}>{leafIdMap[row.cause] || ''}</td>
                  <td style={{ padding: '14px 14px', textAlign: 'left', color: C.navy, fontWeight: 500, borderRight: `1px solid #e2e8f0` }}>
                    <button onClick={() => recommendationObj && setSelected(recommendationObj)} style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, color: C.navy, fontWeight: 500, textAlign: 'left', cursor: recommendationObj ? 'pointer' : 'default' }}>
                      {row.cause}
                    </button>
                  </td>
                  <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 700, color: '#1a3a6b', borderRight: `1px solid #e2e8f0` }}>{row.G}</td>
                  <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 700, color: '#1a3a6b', borderRight: `1px solid #e2e8f0` }}>{row.F}</td>
                  <td style={{ padding: '14px 8px', textAlign: 'center', fontWeight: 700, color: '#1a3a6b', borderRight: `1px solid #e2e8f0` }}>{row.D}</td>
                  <td style={{ padding: '14px 12px', textAlign: 'center', fontWeight: 900, color: ss.color, fontSize: 15, borderRight: `1px solid #e2e8f0` }}>{row.RPN}</td>
                  <td style={{ padding: '14px 14px', textAlign: 'center', borderRight: `1px solid #e2e8f0` }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 700,
                      background: ss.bg, color: ss.color, border: `1.5px solid ${ss.border}`,
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ss.dot, flexShrink: 0 }} />
                      {row.computedStatut}
                    </span>
                  </td>
                  <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                    {recommendationObj ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelected(recommendationObj)
                          const el = document.getElementById('amdec-reco-detail')
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }}
                        title="Afficher la recommandation"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 6,
                          color: '#5a6b7f',
                          padding: '6px 8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#eff6ff'
                          e.currentTarget.style.transform = 'scale(1.1)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.transform = 'scale(1)'
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 1 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/><circle cx="13.5" cy="13.5" r="2"/>
                        </svg>
                      </button>
                    ) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Recommandations ── */}
      {data.recommandations?.length > 0 && selected && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: C.navy, textTransform: 'uppercase', letterSpacing: '.7px', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Recommandations
          </p>
          <div id="amdec-reco-detail" style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 18, minHeight: 140, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {selected ? (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {selected.type && (
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: '6px 12px', borderRadius: 20,
                        background: TYPE_RECO[selected.type]?.bg || '#f0f9ff',
                        color: TYPE_RECO[selected.type]?.color || '#0369a1',
                        border: `1.5px solid ${TYPE_RECO[selected.type]?.color || '#0369a1'}40`,
                        textTransform: 'capitalize',
                      }}>
                        {selected.type}
                      </span>
                    )}
                    {selected.priorite && (
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: '6px 12px', borderRadius: 20,
                        background: '#fff',
                        color: PRIO_RECO[selected.priorite] || '#666',
                        border: `1.5px solid ${PRIO_RECO[selected.priorite] || '#666'}`,
                        textTransform: 'capitalize',
                      }}>
                        Priorité: {selected.priorite}
                      </span>
                    )}
                    {selected.delai && (
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: '6px 12px', borderRadius: 20,
                        background: '#f1f5f9',
                        color: '#334155',
                        border: `1.5px solid #cbd5e1`,
                        textTransform: 'capitalize',
                      }}>
                        Délai: {selected.delai}
                      </span>
                    )}
                  </div>
                  
                  {/* Bouton statut */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setStatusDropdown(statusDropdown === selected.cause ? null : selected.cause)}
                      style={{
                        fontSize: 10.5, fontWeight: 700, padding: '6px 12px', borderRadius: 20,
                        background: STATUT_RECO[recoStatus[selected.cause] || 'Ouvert'].bg,
                        color: STATUT_RECO[recoStatus[selected.cause] || 'Ouvert'].color,
                        border: `1.5px solid ${STATUT_RECO[recoStatus[selected.cause] || 'Ouvert'].border}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.8'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1'
                      }}
                    >
                      {recoStatus[selected.cause] || 'Ouvert'}
                    </button>
                    
                    {/* Dropdown menu */}
                    {statusDropdown === selected.cause && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: 4,
                        background: '#fff',
                        border: `1.5px solid ${C.border}`,
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
                        zIndex: 100,
                        minWidth: 140,
                      }}>
                        {['Ouvert', 'En cours', 'Cloturé'].map(status => (
                          <button
                            key={status}
                            onClick={() => updateRecoStatus(selected.cause, status)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '10px 12px',
                              border: 'none',
                              background: recoStatus[selected.cause] === status ? STATUT_RECO[status].bg : '#fff',
                              color: STATUT_RECO[status].color,
                              fontWeight: 700,
                              fontSize: 10.5,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              borderBottom: status !== 'Cloturé' ? `1px solid ${C.bg2}` : 'none',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = STATUT_RECO[status].bg
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = recoStatus[selected.cause] === status ? STATUT_RECO[status].bg : '#fff'
                            }}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, color: C.text, lineHeight: 1.6, minHeight: 80 }}>
                  {selected.action || 'Aucune recommandation disponible.'}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

    </div>
  )
}

function ExpandedPanel({ equip, analyses, dispatch }) {
  const { arbre, prio, amdec, leafIdMap, loadingArbre, loadingPrio, loadingAmdec } = analyses
  const [activeView, setActiveView] = useState(null)

  const hasArbre = !!arbre
  const hasPrio  = !!prio
  const hasAmdec = !!amdec
  const arbreOk  = hasArbre && (arbre.causes_racines?.length > 0)

  // ── Handlers : switche la vue ET lance le chargement si besoin ──────────────
  const handleArbre = () => {
    setActiveView('arbre')
    if (!hasArbre && !loadingArbre) dispatch({ type: 'LOAD_ARBRE', equip_id: equip.equip_id })
  }

  const handlePrio = () => {
    (async () => {
      setActiveView('prio')
      if (!hasPrio && !loadingPrio) {
        // Ensure we have an arbre first — charge si nécessaire
        let localArbre = arbre
        if (!hasArbre && !loadingArbre) {
          const arbRes = await dispatch({ type: 'LOAD_ARBRE', equip_id: equip.equip_id })
          // dispatch returns the loaded arbre when available
          if (arbRes && arbRes.arbre) localArbre = arbRes.arbre ? { arbre: arbRes.arbre, causes_racines: arbRes.causes || [] } : localArbre
        }

        const causes = []
        const leafIdMap = {}
        const seen = new Set()
        function collectCauses(nodes, isRoot = false) {
          ;(nodes || []).forEach(n => {
            const kids = Array.isArray(n.enfants) && n.enfants.length > 0 ? n.enfants
              : Array.isArray(n.sous_causes) && n.sous_causes.length > 0
                ? n.sous_causes.map(sc => ({ cause: typeof sc === 'string' ? sc : (sc.label || sc.cause || ''), enfants: [] }))
                : []
            const txt = n.texte || n.cause || n.label || ''
            const isRootParentWithKids = isRoot && kids.length > 0
            if (txt && !isRootParentWithKids && !seen.has(txt)) {
              seen.add(txt)
              causes.push(txt)
              const nodeId = n.nodeLabel || n.id || ''
              if (nodeId) leafIdMap[txt] = nodeId
            }
            if (kids.length > 0) {
              collectCauses(kids, false)
            }
          })
        }
        collectCauses((localArbre && localArbre.arbre) || [], true)
        dispatch({ type: 'LOAD_PRIO', equip_id: equip.equip_id, causes: causes.length > 0 ? causes : ((localArbre && localArbre.causes_racines) || []), leafIdMap })
      }
    })()
  }

  const handleAmdec = () => {
    setActiveView('amdec')
    if (!hasAmdec && !loadingAmdec) {
      const getMcpLevel = (niveau, score) => {
        const normalized = String(niveau || '').trim().toUpperCase().replace('ELEVÉ', 'ÉLEVÉ')
        if (normalized === 'CRITIQUE') return 'CRITIQUE'
        if (normalized === 'ÉLEVÉ') return 'ÉLEVÉ'
        if (normalized === 'MOYEN') return 'MOYEN'
        const s = parseFloat(score)
        if (!isNaN(s)) {
          if (s >= 0.85) return 'CRITIQUE'
          if (s >= 0.70) return 'ÉLEVÉ'
          if (s >= 0.50) return 'MOYEN'
        }
        return 'FAIBLE'
      }

      const scores = (prio?.scores || []).sort((a, b) => (a.rang || 99) - (b.rang || 99))
      const highCauses = scores
        .filter(s => ['CRITIQUE', 'ÉLEVÉ'].includes(getMcpLevel(s.niveau, s.score_mcp)))
        .map(s => s.cause)
        .filter(Boolean)

      const mediumCandidates = scores
        .filter(s => getMcpLevel(s.niveau, s.score_mcp) === 'MOYEN')
        .filter(s => s.cause && !highCauses.includes(s.cause))

      const repetitiveMedium = mediumCandidates
        .filter(s => {
          const hist = parseFloat(s.agents?.historique ?? s.historique ?? 0)
          return !isNaN(hist) && hist >= 0.75
        })
        .map(s => s.cause)
        .filter(Boolean)

      const selected = highCauses.length > 0 ? highCauses : [...new Set(repetitiveMedium)]

      const topCauses = selected.length > 0 ? selected : (arbre?.causes_racines || [])
      dispatch({ type: 'LOAD_AMDEC', equip_id: equip.equip_id, top_causes: topCauses })
    }
  }

  // ── Loading inline ───────────────────────────────────────────────────────────
  const isLoading = (activeView === 'arbre' && loadingArbre)
                 || (activeView === 'prio'  && loadingPrio)
                 || (activeView === 'amdec' && loadingAmdec)

  return (
    <div style={{ padding: '16px 20px', background: '#f8faff', borderTop: `1px solid ${C.border}` }}>

      {/* ── Barre d'onglets ── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 0 }}>
        <StepBtn
          label="Arbre causal"
          done={hasArbre}
          loading={loadingArbre && activeView === 'arbre'}
          active={activeView === 'arbre'}
          onClick={handleArbre}
        />
        <StepBtn
          label="Priorisation Agents"
          done={hasPrio}
          loading={loadingPrio && activeView === 'prio'}
          disabled={loadingArbre}
          active={activeView === 'prio'}
          onClick={handlePrio}
        />
        <StepBtn
          label="AMDEC"
          done={hasAmdec}
          loading={loadingAmdec && activeView === 'amdec'}
          disabled={!hasPrio}
          active={activeView === 'amdec'}
          onClick={handleAmdec}
        />
      </div>

      {/* ── Zone de contenu (une seule vue active) ── */}
      {activeView && (
        isLoading ? (
          /* Spinner d'attente inline */
          <div style={{ marginTop: 16, padding: '36px 0', textAlign: 'center',
            background: '#fafafa', borderRadius: 8, border: `1px solid ${C.border}` }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a3a6b" strokeWidth="2.5"
              style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <p style={{ fontSize: 12, color: C.text3, marginTop: 10 }}>Analyse en cours…</p>
          </div>
        ) : (
          <>
            {activeView === 'arbre' && hasArbre && (
              <SectionPanel title="Arbre des causes">
                <CauseTree data={arbre} equip_id={equip.equip_id} phenomene={equip.phenomene} defaillance={equip.defaillance_probable} />
              </SectionPanel>
            )}
            {activeView === 'prio' && hasPrio && (
              <SectionPanel title="Score normalisé 0→1">
                <PrioritisationPanel data={prio} leafIdMap={leafIdMap || {}} />
              </SectionPanel>
            )}
            {activeView === 'amdec' && hasAmdec && (
              <SectionPanel>
                <AmdecPanel data={amdec} leafIdMap={leafIdMap || {}} />
              </SectionPanel>
            )}
          </>
        )
      )}
    </div>
  )
}

export default function IABasedSolutionPage() {
  const STORAGE_KEY = 'jesa_ia_analyses_cache'
  const [predictions, setPredictions] = useState(null)
  const [loadingPred, setLoadingPred] = useState(false)
  const [notif, setNotif]             = useState(null)
  const [filter, setFilter]           = useState('TOUT')
  const [search, setSearch]           = useState('')
  const [expanded, setExpanded]       = useState(null)
  const [analyses, setAnalyses]       = useState(() => {
    if (typeof window === 'undefined') return {}
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    } catch {
      return {}
    }
  })
  const [preview, setPreview]         = useState(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [importing, setImporting]     = useState(false)
  const [dragging, setDragging]       = useState(false)
  const fileRef = useRef()

  const showNotif = (msg) => {
    setNotif(msg)
    setTimeout(() => setNotif(null), 7000)
  }

  // Formate les erreurs IA (429 rate limit → message clair)
  const fmtIAError = (label, e) => {
    if (e.message?.includes('429') || e.message?.toLowerCase().includes('quota')) {
      return `⏳ ${label} — Quota Groq atteint, nouvelle tentative automatique en cours… Réessayez si l'erreur persiste.`
    }
    return `${label} — ${e.message}`
  }

  const loadPredictions = useCallback(async () => {
    setLoadingPred(true)
    try {
      const data = await api.getPredictions()
      setPredictions(data)
    } catch (e) {
      showNotif(`Erreur prédictions : ${e.message}`)
    } finally {
      setLoadingPred(false)
    }
  }, [])

  useEffect(() => { loadPredictions() }, [loadPredictions])

  // ── Helpers import ────────────────────────────────────────────────────────
  const toIsoDate = (val) => {
    if (!val && val !== 0) return null
    // Objet Date JS (produit par cellDates:true)
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null
      const y = val.getFullYear()
      const m = String(val.getMonth() + 1).padStart(2, '0')
      const d = String(val.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    const s = String(val).trim()
    // Format DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
    // Format YYYY-MM-DD déjà correct
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    return null
  }

  const toTimeStr = (val) => {
    if (!val && val !== 0) return null
    // Objet Date JS
    if (val instanceof Date) {
      return `${String(val.getHours()).padStart(2,'0')}:${String(val.getMinutes()).padStart(2,'0')}:00`
    }
    const s = String(val).trim()
    // HH:MM ou HH:MM:SS
    if (/^\d{1,2}:\d{2}/.test(s)) return s.length === 5 ? `${s}:00` : s
    // Fraction décimale Excel (0.5 = 12:00)
    const n = parseFloat(s)
    if (!isNaN(n) && n >= 0 && n < 1) {
      const totalMin = Math.round(n * 1440)
      const h = Math.floor(totalMin / 60)
      const m = totalMin % 60
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`
    }
    return null
  }

  const calcDuree = (hd, hf) => {
    if (!hd || !hf) return null
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    let dur = toMin(hf) - toMin(hd)
    if (dur < 0) dur += 1440   // arrêt de nuit (ex: 23:00 → 01:30)
    return dur > 0 ? dur : null
  }

  const parseFile = useCallback(async (file) => {
    if (!file) return
    setLoadingFile(true)
    try {
      const buf = await file.arrayBuffer()
      // cellDates:true + cellNF:false pour récupérer les vrais objets Date
      const wb  = XLSX.read(buf, { type: 'array', cellDates: true, cellNF: false })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      // raw: valeurs brutes (pas de conversion String ici)
      const raw = XLSX.utils.sheet_to_json(ws, { defval: null, header: 1, raw: true })
      if (raw.length < 2) { showNotif('Fichier vide'); return }

      const rawHeaders = raw[0].map(h => String(h ?? '').trim())
      const mapping    = {}
      COLS.forEach(col => {
        const found = findKey(rawHeaders, col.keywords)
        if (found) mapping[col.key] = found
      })

      if (!mapping.poste_technique) { showNotif('Colonne "Poste Technique" introuvable'); return }

      const rows = raw.slice(1)
        .map(row => {
          // Construire objet avec valeurs brutes (pas de String() forcé)
          const obj = {}
          rawHeaders.forEach((h, i) => { obj[h] = row[i] ?? null })
          return obj
        })
        .filter(row => Object.values(row).some(v => v !== null && v !== ''))
        .map(row => {
          const out = {}
          COLS.forEach(col => {
            if (!mapping[col.key]) return
            const raw = row[mapping[col.key]]

            if (col.key === 'date_debut' || col.key === 'date_fin') {
              out[col.key] = toIsoDate(raw)
            } else if (col.key === 'heure_debut' || col.key === 'heure_fin') {
              out[col.key] = toTimeStr(raw)
            } else {
              out[col.key] = raw != null && raw !== '' ? String(raw).trim() : null
            }
          })

          // Calcul automatique de la durée si absente
          if (!out.duree_arret_minutes && out.heure_debut && out.heure_fin) {
            out.duree_arret_minutes = calcDuree(out.heure_debut, out.heure_fin)
          }

          return out
        })
        .filter(r => r.poste_technique)

      setPreview({ rows, fileName: file.name })
    } catch (e) {
      showNotif(`Erreur lecture : ${e.message}`)
    } finally {
      setLoadingFile(false)
    }
  }, [])

  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [parseFile])

  const handleImport = async () => {
    if (!preview?.rows?.length) return
    setImporting(true)
    try {
      const res = await api.bulkHistoriqueRef(preview.rows)
      showNotif(null)
      setPreview(null)
      await loadPredictions()
      setNotif(null)
      // succès silencieux — prédictions rechargées
    } catch (e) {
      showNotif(`Erreur import : ${e.message}`)
    } finally {
      setImporting(false)
    }
  }

  // Dispatch actions pour les analyses
  const dispatch = useCallback(async (action) => {
    const id     = action.equip_id
    // Clé unique par (équipement + cause) pour ne pas mélanger les analyses
    const rowKey = action._rowKey || id
    const setField = (fields) => setAnalyses(prev => {
      const next = { ...prev, [rowKey]: { ...prev[rowKey], ...fields } }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore localStorage failure
      }
      return next
    })

    if (action.type === 'LOAD_CAUSES') {
      setField({ loadingCauses: true })
      try {
        const data = await api.getCausesIA(id)
        setField({ causes: data, loadingCauses: false })
        return data
      } catch (e) {
        showNotif(`Causes — ${e.message}`)
        setField({ loadingCauses: false })
        return null
      }
    }
    if (action.type === 'LOAD_ARBRE') {
      setField({ loadingArbre: true })
      try {
        // Auto-charge les causes TUM puis génère l'arbre
        const causesData = await api.getCausesIA(id)
        const causes = causesData?.causes || []
        const data = await api.generateArbre({ equip_id: id, causes })
        setField({ causes: causesData, arbre: data, loadingArbre: false })
        return { arbre: data, causes }
      } catch (e) {
        showNotif(fmtIAError('Arbre causal', e))
        setField({ loadingArbre: false })
        return null
      }
    }
    if (action.type === 'LOAD_PRIO') {
      setField({ loadingPrio: true })
      try {
        const data = await api.generatePriorisation({ equip_id: id, causes: action.causes })
        setField({ prio: data, leafIdMap: action.leafIdMap || {}, loadingPrio: false })
        return data
      } catch (e) {
        showNotif(fmtIAError('Priorisation', e))
        setField({ loadingPrio: false })
        return null
      }
    }
    if (action.type === 'LOAD_AMDEC') {
      setField({ loadingAmdec: true })
      try {
        const data = await api.generateAmdec({ equip_id: id, top_causes: action.top_causes })
        setField({ amdec: data, loadingAmdec: false })
        return data
      } catch (e) {
        showNotif(fmtIAError('AMDEC', e))
        setField({ loadingAmdec: false })
        return null
      }
    }
  }, [])

  const stats = predictions ? {
    total:    predictions.length,
    critique: predictions.filter(p => p.criticite === 'CRITIQUE').length,
    moderee:  predictions.filter(p => p.criticite === 'MODÉRÉE').length,
    faible:   predictions.filter(p => p.criticite === 'FAIBLE').length,
  } : null

  const filtered = (predictions || []).filter(p => {
    const matchFilter = filter === 'TOUT' || p.criticite === filter
    const matchSearch = !search || p.equip_id.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #1a3a6b, #475569)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10" />
              <path d="M12 6v6l4 2" />
              <path d="M22 2L12 12" />
              <circle cx="19" cy="5" r="3" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0 }}>IA Based Solution</h1>
            <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>Analyse prédictive bayésienne — cliquez sur un équipement pour lancer l'analyse</p>
          </div>
        </div>
      </div>

      {/* Notif */}
      {notif && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13, fontWeight: 600,
          background: C.redBg, color: C.red, border: `1px solid ${C.redB}`,
        }}>
          {notif}
        </div>
      )}

      {/* KPI */}
      {stats && stats.total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Équipements analysés', value: stats.total,    color: C.navy,   bg: '#f0f4ff' },
            { label: 'Critique',             value: stats.critique, color: '#dc2626', bg: '#fef2f2' },
            { label: 'Modérée',              value: stats.moderee,  color: '#d97706', bg: '#fffbeb' },
            { label: 'Faible',               value: stats.faible,   color: '#16a34a', bg: '#f0fdf4' },
          ].map(k => (
            <div key={k.label} style={{ background: k.bg, borderRadius: 10, padding: '14px 18px', border: `1.5px solid ${C.border}` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tableau */}
      <div style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadow, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>Prédictions de défaillance</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              placeholder="Rechercher équipement…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 7, border: `1.5px solid ${C.border2}`, fontSize: 12, outline: 'none', width: 180 }}
            />
            {['TOUT', 'CRITIQUE', 'MODÉRÉE', 'FAIBLE'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: filter === f ? C.navy : '#fff', color: filter === f ? '#fff' : C.text3,
                border: `1.5px solid ${filter === f ? C.navy : C.border2}`,
              }}>{f}</button>
            ))}
            <button onClick={loadPredictions} style={{
              padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${C.border2}`,
              background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }} title="Rafraîchir">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2.5" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        </div>

        {loadingPred ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: C.text3 }}>Calcul des prédictions en cours…</div>
        ) : !predictions || predictions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="16" height="12" rx="2" />
                <path d="M7 15h10" />
                <path d="M12 15v5" />
                <path d="M9 18h6" />
                <path d="M7 8h10" />
                <path d="M9 11h6" />
              </svg>
            </div>
            <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6 }}>Aucune donnée TUM disponible</div>
            <p style={{ color: C.text3, fontSize: 13 }}>Saisissez ou importez des arrêts dans TUM pour activer le moteur prédictif.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: C.text3, fontSize: 13 }}>Aucun résultat pour ce filtre.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['Équipement','Cause arrêt prédictif','Date prédictive','Durée prédictive','Probabilité','Criticité'].map(h => (
                  <th key={h} style={{
                    padding: '9px 12px', textAlign: 'left', fontWeight: 700,
                    color: C.text3, fontSize: 10.5, textTransform: 'uppercase',
                    borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const cs     = CRIT_STYLE[p.criticite] || CRIT_STYLE['FAIBLE']
                const rowKey = `${p.equip_id}||${p.cause_arret || p.defaillance_probable || ''}`
                const isOpen = expanded === rowKey
                const ana    = analyses[rowKey] || {}

                return (
                  <>
                    <tr
                      key={rowKey}
                      onClick={() => setExpanded(isOpen ? null : rowKey)}
                      style={{
                        borderBottom: isOpen ? 'none' : `1px solid ${C.bg2}`,
                        cursor: 'pointer',
                        background: isOpen ? '#f0f4ff' : 'transparent',
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#f8faff' }}
                      onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
                    >
                      {/* Équipement */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2.5" strokeLinecap="round"
                            style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                          <span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.navy, fontSize: 12 }}>{p.equip_id}</span>
                            {p.designation && <div style={{ fontSize: 10.5, color: C.text, fontWeight: 500, marginTop: 1 }}>{p.designation}</div>}
                            {(p.zone || p.entite) && <div style={{ fontSize: 10, color: C.text4 }}>{p.zone || p.entite}</div>}
                          </span>
                        </span>
                      </td>
                      {/* Cause arrêt — mode de défaillance spécifique */}
                      <td style={{ padding: '10px 12px' }}>
                        {p.cause_arret && p.cause_arret !== 'Non renseigné' ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.navy, display: 'inline-block' }}>
                            {p.cause_arret}
                          </span>
                        ) : p.defaillance_probable && p.defaillance_probable !== 'À déterminer' ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.navy, display: 'inline-block' }}>
                            {p.defaillance_probable}
                          </span>
                        ) : ''}
                      </td>
                      {/* Date prédictive */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: p.criticite === 'CRITIQUE' ? '#dc2626' : C.navy }}>
                          {p.next_failure_date}
                        </span>
                        {p.days_since_last !== null && (
                          <div style={{ fontSize: 10, color: C.text4 }}>dernier il y a {p.days_since_last}j</div>
                        )}
                      </td>
                      {/* Durée prédictive */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {p.duree_estimee_h > 0 ? (
                          <>
                            <span style={{ fontWeight: 700, color: C.navy }}>{p.duree_estimee_h} h</span>
                            {p.duree_estimee_h !== p.avg_duration_h && (
                              <div style={{ fontSize: 10, color: C.text4 }}>moy. {p.avg_duration_h} h</div>
                            )}
                          </>
                        ) : ''}
                      </td>
                      {/* Probabilité */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: 700, color: p.prob_bayes >= 0.65 ? '#dc2626' : p.prob_bayes >= 0.35 ? '#d97706' : '#16a34a' }}>
                        {p.prob_bayes != null ? `${Math.round(p.prob_bayes * 100)} %` : ''}
                      </td>
                      {/* Criticité */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cs.bg, color: cs.color, border: `1px solid ${cs.border}`, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: cs.dot }} />
                          {p.criticite}
                        </span>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr key={`${rowKey}-panel`}>
                        <td colSpan={7} style={{ padding: 0, borderBottom: `1px solid ${C.border}` }}>
                          <ExpandedPanel equip={p} analyses={ana} dispatch={(a) => dispatch({ ...a, _rowKey: rowKey })} />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Section import historique référence ── */}
      <div style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 24, marginTop: 24, boxShadow: C.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>Importer / Réimporter l'historique de référence</span>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? C.navy : C.border2}`,
            borderRadius: 10, padding: '20px', textAlign: 'center',
            cursor: 'pointer', background: dragging ? C.bluePale : C.bg,
            transition: 'all .2s', marginBottom: 14,
          }}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) parseFile(e.target.files[0]); e.target.value = '' }} />
          {loadingFile ? (
            <p style={{ color: C.text3, margin: 0, fontSize: 13 }}>Lecture en cours…</p>
          ) : (
            <>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="1.5" style={{ marginBottom: 6 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p style={{ color: C.text3, margin: 0, fontSize: 13 }}>Glissez votre fichier Excel ici ou cliquez</p>
              <p style={{ color: C.text4, margin: '3px 0 0', fontSize: 11 }}>.xlsx / .xls / .csv</p>
            </>
          )}
        </div>

        <div style={{ background: C.bg, borderRadius: 8, padding: '10px 14px' }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 7px' }}>Colonnes attendues</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {COLS.map(col => (
              <span key={col.key} style={{ fontSize: 10.5, padding: '2px 9px', borderRadius: 20, background: C.bluePale, color: C.navy, fontWeight: 600, border: `1px solid ${C.blueMid}` }}>
                {col.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div style={{ background: '#fff', border: `1.5px solid ${C.border}`, borderRadius: 12, padding: 24, marginTop: 16, boxShadow: C.shadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{preview.rows.length} ligne(s) détectée(s)</span>
              <span style={{ fontSize: 12, color: C.text3, marginLeft: 8 }}>{preview.fileName}</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPreview(null)} style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.border2}`, background: '#fff', color: C.text2, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                Annuler
              </button>
              <button onClick={handleImport} disabled={importing} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#1a3a6b,#7c3aed)', color: '#fff', fontSize: 12, cursor: importing ? 'wait' : 'pointer', fontWeight: 700 }}>
                {importing ? 'Import en cours…' : `Importer ${preview.rows.length} ligne(s)`}
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {COLS.map(col => (
                    <th key={col.key} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: C.text3, fontSize: 10, textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 8).map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                    {COLS.map(col => (
                      <td key={col.key} style={{ padding: '6px 10px', color: row[col.key] ? C.text : C.text4, whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row[col.key] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 8 && (
              <p style={{ textAlign: 'center', color: C.text3, fontSize: 11, marginTop: 6 }}>… et {preview.rows.length - 8} ligne(s) supplémentaire(s)</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
