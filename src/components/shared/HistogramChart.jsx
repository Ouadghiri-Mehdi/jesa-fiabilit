// src/components/shared/HistogramChart.jsx
// Histogramme à barres groupées : cumul (h) + fréquence (nb arrêts)

import { useState, useMemo } from 'react'
import C from '../../tokens/colors'

export default function HistogramChart({ arrets, dateDebut, dateFin, seuils }) {
  const [hovered, setHovered] = useState(null)

  // Calcul des données par équipement
  const data = useMemo(() => {
    const equipIds = [...new Set(arrets.map(a => a.equipId))]

    const stats = equipIds.map(id => {
      const filtered = arrets.filter(a => {
        const dt = new Date(a.startTime)
        return a.equipId === id && dt >= dateDebut && dt <= dateFin
      })
      const cumul = filtered.reduce((s, a) => s + (a.duration || 0), 0)
      const freq = filtered.length
      return { id, cumul, freq }
    })
    .filter(d => d.cumul > 0 || d.freq > 0)
    .sort((a, b) => b.cumul - a.cumul)
    .slice(0, 12)  // Limiter à 12 équipements pour lisibilité

    return stats
  }, [arrets, dateDebut, dateFin])

  if (data.length === 0) {
    return (
      <div style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 12,
      }}>
        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19h16" />
            <path d="M6 15h4" />
            <path d="M14 11h4" />
            <path d="M4 7h16" />
            <path d="M8 5v14" />
            <path d="M16 5v14" />
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text3 }}>Aucune donnée sur cette période</div>
      </div>
    )
  }

  // Dimensions
  const width = 900
  const height = 400
  const padding = { top: 40, right: 30, bottom: 70, left: 55 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const maxValue = Math.max(
    ...data.map(d => Math.max(d.cumul, d.freq)),
    1
  )

  // Deux barres par équipement
  const groupWidth = chartWidth / data.length
  const barWidth = groupWidth * 0.35
  const barSpacing = groupWidth * 0.1

  const getBarHeight = (value) => (value / maxValue) * chartHeight

  // Couleur pour la barre cumul selon seuil
  const getCumulColor = (cumul) => {
    if (cumul >= (seuils?.n2?.cumul || 4)) return C.red
    if (cumul >= (seuils?.n1?.cumul || 2)) return '#d97706'
    return C.green
  }

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: '20px',
      marginBottom: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, color: C.text }}>
            📊 Analyse cumul & fréquence
          </div>
          <div style={{ fontSize: 11.5, color: C.text3, marginTop: 3 }}>
            Barres groupées par équipement
          </div>
        </div>
        {/* Légende */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 12, background: C.navy, borderRadius: 2 }} />
            <span style={{ fontSize: 11, color: C.text3 }}>Cumul (heures)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 12, background: '#d97706', borderRadius: 2 }} />
            <span style={{ fontSize: 11, color: C.text3 }}>Fréquence (nb arrêts)</span>
          </div>
        </div>
      </div>

      {/* Graphique SVG */}
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          
          {/* Grille horizontale */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
            const y = padding.top + chartHeight * (1 - p)
            const value = (maxValue * p).toFixed(0)
            return (
              <g key={i}>
                <line x1={padding.left} y1={y} x2={padding.left + chartWidth} y2={y}
                  stroke={C.bg2} strokeWidth="1" strokeDasharray="3,3" />
                <text x={padding.left - 8} y={y + 3} fontSize="8.5" fill={C.text4} textAnchor="end">
                  {value}
                </text>
              </g>
            )
          })}

          {/* Axes */}
          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight}
            stroke={C.border} strokeWidth="1.5" />
          <line x1={padding.left} y1={padding.top + chartHeight} x2={padding.left + chartWidth} y2={padding.top + chartHeight}
            stroke={C.border} strokeWidth="1.5" />

          {/* Barres groupées */}
          {data.map((item, index) => {
            const groupX = padding.left + index * groupWidth
            const cumulX = groupX + barSpacing
            const freqX = groupX + barSpacing + barWidth + barSpacing
            
            const cumulHeight = getBarHeight(item.cumul)
            const freqHeight = getBarHeight(item.freq)
            const cumulColor = getCumulColor(item.cumul)
            
            const isHovered = hovered === item.id

            return (
              <g key={item.id}
                onMouseEnter={() => setHovered(item.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Barre Cumul */}
                <rect
                  x={cumulX}
                  y={padding.top + chartHeight - cumulHeight}
                  width={barWidth}
                  height={cumulHeight}
                  fill={cumulColor}
                  rx="3"
                  opacity={isHovered ? 1 : 0.85}
                >
                  <title>{item.id}: cumul {item.cumul.toFixed(1)}h</title>
                </rect>

                {/* Valeur cumul */}
                <text
                  x={cumulX + barWidth / 2}
                  y={padding.top + chartHeight - cumulHeight - 5}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill={cumulColor}
                >
                  {item.cumul.toFixed(1)}h
                </text>

                {/* Barre Fréquence */}
                <rect
                  x={freqX}
                  y={padding.top + chartHeight - freqHeight}
                  width={barWidth}
                  height={freqHeight}
                  fill="#d97706"
                  rx="3"
                  opacity={isHovered ? 1 : 0.85}
                >
                  <title>{item.id}: {item.freq} arrêts</title>
                </rect>

                {/* Valeur fréquence */}
                <text
                  x={freqX + barWidth / 2}
                  y={padding.top + chartHeight - freqHeight - 5}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="#d97706"
                >
                  {item.freq}
                </text>

                {/* Label équipement */}
                <text
                  x={groupX + groupWidth / 2}
                  y={padding.top + chartHeight + 18}
                  textAnchor="start"
                  fontSize="8.5"
                  fontWeight={isHovered ? '700' : '400'}
                  fill={isHovered ? C.navy : C.text3}
                  transform={`rotate(35, ${groupX + groupWidth / 2}, ${padding.top + chartHeight + 18})`}
                >
                  {item.id}
                </text>

                {/* Tooltip */}
                {isHovered && (
                  <g>
                    <rect
                      x={groupX + groupWidth / 2 - 55}
                      y={padding.top + chartHeight - Math.max(cumulHeight, freqHeight) - 35}
                      width="110"
                      height="28"
                      rx="6"
                      fill="#1e293b"
                      opacity="0.92"
                    />
                    <text
                      x={groupX + groupWidth / 2}
                      y={padding.top + chartHeight - Math.max(cumulHeight, freqHeight) - 18}
                      textAnchor="middle"
                      fontSize="9.5"
                      fill="#fff"
                    >
                      {item.cumul.toFixed(1)}h · {item.freq} arrêt(s)
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {/* Label axe Y */}
          <text
            x={12}
            y={padding.top + chartHeight / 2}
            textAnchor="middle"
            fontSize="9"
            fill={C.text3}
            fontWeight="600"
            transform={`rotate(-90, 12, ${padding.top + chartHeight / 2})`}
          >
            Valeurs
          </text>
        </svg>
      </div>

      {/* Footer stats */}
      <div style={{
        marginTop: 16,
        padding: '10px 16px',
        background: C.bg2,
        borderRadius: 8,
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <span style={{ fontSize: 11.5, color: C.text3 }}>
            📊 Cumul total : <strong>{data.reduce((s, d) => s + d.cumul, 0).toFixed(1)}h</strong>
          </span>
        </div>
        <div>
          <span style={{ fontSize: 11.5, color: C.text3 }}>
            🔄 Arrêts total : <strong>{data.reduce((s, d) => s + d.freq, 0)}</strong>
          </span>
        </div>
        <div>
          <span style={{ fontSize: 11.5, color: C.text3 }}>
            🏭 Équipements : <strong>{data.length}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}