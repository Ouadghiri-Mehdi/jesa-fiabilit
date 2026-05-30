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

function StepBtn({ label, icon, onClick, loading, done, disabled, active }) {
  const bg     = active ? '#1a3a6b' : done ? '#f0fdf4' : disabled ? '#f9fafb' : '#fff'
  const border = active ? '#1a3a6b' : done ? '#86efac' : C.border2
  const color  = active ? '#fff'    : done ? '#16a34a' : disabled ? C.text4 : C.navy
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: `1.5px solid ${border}`, background: bg, color,
      transition: 'all .15s', opacity: disabled ? 0.5 : 1,
    }}>
      {loading ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke={active ? '#fff' : 'currentColor'} strokeWidth="2.5"
          style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      ) : done && !active ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : icon}
      {loading ? 'Chargement…' : label}
    </button>
  )
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
            <span style={{ fontSize: 11, color: C.text3, minWidth: 60, textAlign: 'right' }}>{c.freq}× — {c.cumul_h}h</span>
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
  const color    = IA_LEVEL_COLORS[depth] || '#64748b'
  const hasKids  = noeud.enfants?.length > 0
  const HALF_GAP = 6

  return (
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>

      {/* ── Carte ── */}
      <div style={{
        width: IA_CARD_W, flexShrink: 0,
        background: isRoot ? '#1a3a6b' : '#fff',
        border:     isRoot ? 'none' : `1.5px solid #e2e8f0`,
        borderLeft: !isRoot ? `3px solid ${color}` : 'none',
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: isRoot
          ? '0 4px 20px rgba(26,58,107,.22)'
          : '0 2px 8px rgba(15,30,53,.06)',
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
          fontSize: isRoot ? 11.5 : 12,
          fontWeight: isRoot ? 700 : 600,
          color: isRoot ? '#fff' : '#1a3a6b',
          lineHeight: 1.45,
        }}>
          {noeud.texte}
        </div>
        {isRoot && (
          <div style={{ fontSize: 9.5, color: '#93c5fd', marginTop: 5, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
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
        <div style={{ overflowX: 'auto', overflowY: 'auto' }}>
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

      {/* ── Débat multi-agents ── */}
      {(data.debat || []).length > 0 && (
        <div style={{ background: '#f8faff', border: '1px solid #d0d9ed', borderRadius: 8,
          padding: 12, marginTop: 12 }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: NAVY, textTransform: 'uppercase',
            letterSpacing: 1, margin: '0 0 8px' }}>
            Débat multi-agents — sélection des causes racines
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.debat.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: '#7c3aed', minWidth: 130, flexShrink: 0 }}>{d.agent}</span>
                <span style={{ color: '#475569', flex: 1 }}>{d.argument}</span>
                <span style={{ fontWeight: 600, color: NAVY, fontSize: 11, flexShrink: 0 }}>→ {d.vote}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PrioritisationPanel({ data, leafIdMap = {} }) {
  const [expanded, setExpanded] = useState(null)

  if (!data?.scores?.length) return null

  const sorted = [...data.scores].sort((a, b) => (a.rang || 99) - (b.rang || 99))

  // Styles niveau MCP
  const NIVEAU_STYLE = {
    'CRITIQUE': { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5', dot: '#ef4444' },
    'ÉLEVÉ':    { bg: '#fffbeb', color: '#d97706', border: '#fcd34d', dot: '#f59e0b' },
    'MOYEN':    { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd', dot: '#0ea5e9' },
    'FAIBLE':   { bg: '#f0fdf4', color: '#16a34a', border: '#86efac', dot: '#22c55e' },
  }

  // Labels agents pour le tableau détail
  const AGENTS = [
    { key: 'rca',         label: 'RCA (cause racine)',      color: '#1a3a6b' },
    { key: 'historique',  label: 'Récurrence (historique)', color: '#7c3aed' },
    { key: 'frequence',   label: 'Fréquence',               color: '#0369a1' },
    { key: 'duree',       label: 'Durée',                   color: '#d97706' },
    { key: 'propagation', label: 'Propagation',             color: '#dc2626' },
  ]

  // Barre de score MCP (0→1)
  function ScoreBar({ score, color }) {
    const pct = Math.round((score || 0) * 100)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 7, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .4s' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 34 }}>{(score || 0).toFixed(2)}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Légende agents MCP ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', marginRight: 4 }}>Agents MCP :</span>
        {AGENTS.map(a => (
          <span key={a.key} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 600,
            background: '#f4f6fb', color: a.color, border: `1px solid ${a.color}33`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, display: 'inline-block' }} />
            {a.label}
          </span>
        ))}
      </div>

      {/* ── Table principale : Rang | Cause | Score MCP | Niveau ── */}
      <div style={{ borderRadius: 10, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#1a3a6b' }}>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.6px', width: 60 }}>Nœud</th>
              <th style={{ padding: '10px 14px', textAlign: 'left',   fontWeight: 700, color: '#fff',    fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.6px' }}>Cause</th>
              <th style={{ padding: '10px 14px', textAlign: 'left',   fontWeight: 700, color: '#cbd5e1', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', width: 180 }}>Score MCP</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#cbd5e1', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', width: 100 }}>Niveau</th>
              <th style={{ padding: '10px 10px', width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const isOpen  = expanded === i
              const isTop   = i === 0
              const ns      = NIVEAU_STYLE[s.niveau] || NIVEAU_STYLE['FAIBLE']
              const mcpColor = s.score_mcp >= 0.80 ? '#dc2626' : s.score_mcp >= 0.60 ? '#d97706' : s.score_mcp >= 0.40 ? '#0369a1' : '#16a34a'
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
                    {/* Rang / Node ID */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {leafIdMap[s.cause] ? (
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: isTop ? '#1a3a6b' : '#eef2f9',
                          color: isTop ? '#fff' : '#1a3a6b',
                          fontFamily: "'JetBrains Mono', monospace", letterSpacing: '.3px',
                        }}>{leafIdMap[s.cause]}</span>
                      ) : (
                        <span style={{
                          width: 28, height: 28, borderRadius: '50%', fontSize: 11, fontWeight: 800,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: isTop ? '#1a3a6b' : '#f1f5f9',
                          color: isTop ? '#fff' : '#64748b',
                        }}>{s.rang || i + 1}</span>
                      )}
                    </td>

                    {/* Cause */}
                    <td style={{ padding: '12px 14px', fontWeight: isTop ? 700 : 600, color: C.navy }}>
                      {isTop && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: 10, marginRight: 6, textTransform: 'uppercase' }}>
                          Prioritaire
                        </span>
                      )}
                      {s.cause}
                    </td>

                    {/* Score MCP — barre */}
                    <td style={{ padding: '12px 14px' }}>
                      <ScoreBar score={s.score_mcp} color={mcpColor} />
                    </td>

                    {/* Niveau badge */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 700,
                        background: ns.bg, color: ns.color, border: `1.5px solid ${ns.border}`,
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: ns.dot }} />
                        {s.niveau || '—'}
                      </span>
                    </td>

                    {/* Chevron */}
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </td>
                  </tr>

                  {/* ── Panel détail (agents + explication) ── */}
                  {isOpen && (
                    <tr key={`detail-${i}`}>
                      <td colSpan={5} style={{ padding: 0, borderBottom: isLast ? 'none' : `1px solid ${C.bg2}` }}>
                        <div style={{ padding: '16px 20px 18px', background: '#f8faff', borderTop: '1.5px solid #e0e9ff' }}>
                          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

                            {/* Tableau agents / valeur */}
                            <div style={{ minWidth: 260 }}>
                              <p style={{ fontSize: 10.5, fontWeight: 800, color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: '.7px', margin: '0 0 10px' }}>
                                Débat des agents
                              </p>
                              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                <thead>
                                  <tr style={{ background: '#1a3a6b' }}>
                                    <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px' }}>Agent</th>
                                    <th style={{ padding: '7px 12px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.5px', width: 70 }}>Valeur</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {AGENTS.map((a, ai) => {
                                    const val = s.agents?.[a.key] ?? null
                                    const pct = val !== null ? Math.round(val * 100) : null
                                    return (
                                      <tr key={a.key} style={{ borderBottom: '1px solid #e2e8f0', background: ai % 2 === 0 ? '#fff' : '#f8faff' }}>
                                        <td style={{ padding: '8px 12px', fontSize: 11.5, fontWeight: 600, color: a.color }}>
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                                            {a.label}
                                          </span>
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                          {val !== null ? (
                                            <span style={{ fontWeight: 800, fontSize: 12, color: val >= 0.8 ? '#dc2626' : val >= 0.6 ? '#d97706' : '#1a3a6b' }}>
                                              {val.toFixed(2)}
                                            </span>
                                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                  {/* Ligne Score MCP final */}
                                  <tr style={{ background: '#1a3a6b' }}>
                                    <td style={{ padding: '9px 12px', fontSize: 11.5, fontWeight: 800, color: '#fff' }}>Score MCP final</td>
                                    <td style={{ padding: '9px 12px', textAlign: 'center', fontSize: 13, fontWeight: 900, color: '#fff' }}>
                                      {s.score_mcp?.toFixed(2) ?? '—'}
                                    </td>
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
          <span style={{ fontSize: 16, flexShrink: 0 }}>🤖</span>
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 800, color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: '.7px', margin: '0 0 6px' }}>Synthèse orchestrateur MCP</p>
            <p style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.65, margin: 0 }}>{data.synthese_globale}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function AmdecPanel({ data }) {
  if (!data?.amdec?.length) return null

  const STATUT_STYLE = {
    'Critique': { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5', dot: '#ef4444' },
    'Élevé':    { bg: '#fffbeb', color: '#d97706', border: '#fcd34d', dot: '#f59e0b' },
    'Moyen':    { bg: '#fefce8', color: '#ca8a04', border: '#fde68a', dot: '#eab308' },
  }
  const TYPE_RECO = {
    'maintenance':  { color: '#7c3aed', bg: '#f5f3ff' },
    'inspection':   { color: '#0369a1', bg: '#f0f9ff' },
    'surveillance': { color: '#059669', bg: '#f0fdf4' },
  }
  const PRIO_RECO = { haute: '#dc2626', moyenne: '#d97706', faible: '#16a34a' }

  const sorted = [...data.amdec].sort((a, b) => (b.RPN || 0) - (a.RPN || 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Légende RPN ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { label: 'RPN > 300 → Critique',   color: '#dc2626', bg: '#fef2f2' },
          { label: 'RPN 200-300 → Élevé',    color: '#d97706', bg: '#fffbeb' },
          { label: 'RPN < 200 → Moyen',      color: '#ca8a04', bg: '#fefce8' },
        ].map(l => (
          <span key={l.label} style={{ fontSize: 10.5, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: l.bg, color: l.color }}>
            {l.label}
          </span>
        ))}
        <span style={{ fontSize: 10.5, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: '#f1f5f9', color: '#64748b' }}>
          RPN = F × G × D
        </span>
      </div>

      {/* ── Tableau AMDEC ── */}
      <div style={{ borderRadius: 10, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#1a3a6b' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#fff', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.6px' }}>Cause</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', width: 44 }} title="Gravité (1-10)">G</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', width: 44 }} title="Fréquence (1-10)">F</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', width: 44 }} title="Détectabilité (1-10)">D</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#60a5fa', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', width: 70 }}>RPN</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#cbd5e1', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', width: 110 }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const ss = STATUT_STYLE[row.statut] || STATUT_STYLE['Moyen']
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.bg2}`, background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: C.navy }}>{row.cause}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>{row.G}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>{row.F}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>{row.D}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900, color: ss.color, fontSize: 14 }}>{row.RPN}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 20, fontSize: 10.5, fontWeight: 700,
                      background: ss.bg, color: ss.color, border: `1.5px solid ${ss.border}`,
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot }} />
                      {row.statut}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Recommandations ── */}
      {data.recommandations?.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: C.navy, textTransform: 'uppercase', letterSpacing: '.7px', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Recommandations
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.recommandations.map((r, i) => {
              const ts = TYPE_RECO[r.type] || TYPE_RECO['maintenance']
              return (
                <div key={i} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.text3 }}>{r.cause}</span>
                    <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: ts.bg, color: ts.color }}>{r.type}</span>
                    <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: '#fff', color: PRIO_RECO[r.priorite] || '#6b7280', border: `1px solid ${PRIO_RECO[r.priorite] || '#e5e7eb'}` }}>
                      {r.priorite}
                    </span>
                    <span style={{ fontSize: 10.5, color: C.text4, marginLeft: 'auto' }}>⏱ {r.delai}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: C.text, lineHeight: 1.5 }}>{r.action}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Décision Finale ── */}
      {data.decision_finale && (
        <div style={{ background: 'linear-gradient(135deg,#f0f4ff,#fafbff)', border: '1.5px solid #c7d4eb', borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🎯</span>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: '.7px', margin: '0 0 6px' }}>
              Décision Finale — Plan d'action maintenance
            </p>
            <p style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.65, margin: 0 }}>{data.decision_finale}</p>
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
    setActiveView('prio')
    if (!hasPrio && !loadingPrio) {
      const leaves = []
      const leafIdMap = {}
      function extractLeaves(nodes) {
        ;(nodes || []).forEach(n => {
          const kids = Array.isArray(n.enfants) && n.enfants.length > 0 ? n.enfants
            : Array.isArray(n.sous_causes) && n.sous_causes.length > 0
              ? n.sous_causes.map(sc => ({ cause: typeof sc === 'string' ? sc : (sc.label || sc.cause || ''), enfants: [] }))
              : []
          if (kids.length === 0) {
            const txt = n.cause || n.label || ''
            if (txt) {
              leaves.push(txt)
              if (n.id) leafIdMap[txt] = n.id
            }
          } else {
            extractLeaves(kids)
          }
        })
      }
      extractLeaves(arbre?.arbre || [])
      dispatch({ type: 'LOAD_PRIO', equip_id: equip.equip_id, causes: leaves.length > 0 ? leaves : (arbre?.causes_racines || []), leafIdMap })
    }
  }

  const handleAmdec = () => {
    setActiveView('amdec')
    if (!hasAmdec && !loadingAmdec) {
      const topCauses = (prio?.scores || [])
        .sort((a, b) => (a.rang || 99) - (b.rang || 99))
        .slice(0, 5)
        .map(s => s.cause)
        .filter(Boolean)
      dispatch({ type: 'LOAD_AMDEC', equip_id: equip.equip_id, top_causes: topCauses.length > 0 ? topCauses : (arbre?.causes_racines || []) })
    }
  }

  // ── Loading inline ───────────────────────────────────────────────────────────
  const isLoading = (activeView === 'arbre' && loadingArbre)
                 || (activeView === 'prio'  && loadingPrio)
                 || (activeView === 'amdec' && loadingAmdec)

  return (
    <div style={{ padding: '16px 20px', background: '#f8faff', borderTop: `1px solid ${C.border}` }}>

      {/* ── Barre d'onglets ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 0 }}>
        <StepBtn
          label="Arbre causal"
          done={hasArbre}
          loading={loadingArbre && activeView === 'arbre'}
          active={activeView === 'arbre'}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>}
          onClick={handleArbre}
        />
        <StepBtn
          label="Priorisation MCP"
          done={hasPrio}
          loading={loadingPrio && activeView === 'prio'}
          disabled={!arbreOk}
          active={activeView === 'prio'}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
          onClick={handlePrio}
        />
        <StepBtn
          label="AMDEC & Plan d'action"
          done={hasAmdec}
          loading={loadingAmdec && activeView === 'amdec'}
          disabled={!hasPrio}
          active={activeView === 'amdec'}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>}
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
              <SectionPanel title="Priorisation MCP — 5 agents · Score normalisé 0→1">
                <PrioritisationPanel data={prio} leafIdMap={leafIdMap || {}} />
              </SectionPanel>
            )}
            {activeView === 'amdec' && hasAmdec && (
              <SectionPanel title="AMDEC — Causes retenues · Niveau de risque · Recommandations · Décision Finale">
                <AmdecPanel data={amdec} />
              </SectionPanel>
            )}
          </>
        )
      )}
    </div>
  )
}

export default function IABasedSolutionPage() {
  const [predictions, setPredictions] = useState(null)
  const [loadingPred, setLoadingPred] = useState(false)
  const [notif, setNotif]             = useState(null)
  const [filter, setFilter]           = useState('TOUT')
  const [search, setSearch]           = useState('')
  const [expanded, setExpanded]       = useState(null)
  const [analyses, setAnalyses]       = useState({})
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
    const setField = (fields) => setAnalyses(prev => ({ ...prev, [rowKey]: { ...prev[rowKey], ...fields } }))

    if (action.type === 'LOAD_CAUSES') {
      setField({ loadingCauses: true })
      try {
        const data = await api.getCausesIA(id)
        setField({ causes: data, loadingCauses: false })
      } catch (e) {
        showNotif(`Causes — ${e.message}`)
        setField({ loadingCauses: false })
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
      } catch (e) {
        showNotif(fmtIAError('Arbre causal', e))
        setField({ loadingArbre: false })
      }
    }
    if (action.type === 'LOAD_PRIO') {
      setField({ loadingPrio: true })
      try {
        const data = await api.generatePriorisation({ equip_id: id, causes: action.causes })
        setField({ prio: data, leafIdMap: action.leafIdMap || {}, loadingPrio: false })
      } catch (e) {
        showNotif(fmtIAError('Priorisation', e))
        setField({ loadingPrio: false })
      }
    }
    if (action.type === 'LOAD_AMDEC') {
      setField({ loadingAmdec: true })
      try {
        const data = await api.generateAmdec({ equip_id: id, top_causes: action.top_causes })
        setField({ amdec: data, loadingAmdec: false })
      } catch (e) {
        showNotif(fmtIAError('AMDEC', e))
        setField({ loadingAmdec: false })
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
            background: 'linear-gradient(135deg, #1a3a6b, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/>
              <path d="M22 2 12 12"/><circle cx="19" cy="5" r="3"/>
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
            <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
            <div style={{ fontWeight: 700, color: C.navy, marginBottom: 6 }}>Aucune donnée TUM disponible</div>
            <p style={{ color: C.text3, fontSize: 13 }}>Saisissez ou importez des arrêts dans TUM pour activer le moteur prédictif.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: C.text3, fontSize: 13 }}>Aucun résultat pour ce filtre.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['Équipement','Cause arrêt prédectif','Date prédictive','Durée prédictive','Probabilité','Criticité'].map(h => (
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
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#fef3c7', color: '#92400e', fontWeight: 600, border: '1px solid #fcd34d', display: 'inline-block' }}>
                            {p.cause_arret}
                          </span>
                        ) : p.defaillance_probable && p.defaillance_probable !== 'À déterminer' ? (
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontWeight: 600, border: '1px solid #e2e8f0', display: 'inline-block' }}>
                            {p.defaillance_probable}
                          </span>
                        ) : <span style={{ color: C.text4 }}>—</span>}
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
                        ) : <span style={{ color: C.text4 }}>—</span>}
                      </td>
                      {/* Probabilité */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: 700, color: p.prob_bayes >= 0.65 ? '#dc2626' : p.prob_bayes >= 0.35 ? '#d97706' : '#16a34a' }}>
                        {p.prob_bayes != null ? `${Math.round(p.prob_bayes * 100)} %` : <span style={{ color: C.text4 }}>—</span>}
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
              <span style={{ fontSize: 12, color: C.text3, marginLeft: 8 }}>— {preview.fileName}</span>
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
                        {row[col.key] || '—'}
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
