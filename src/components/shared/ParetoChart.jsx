// src/components/shared/ParetoChart.jsx
// Diagramme de Pareto pour l'analyse des équipements critiques
// Principe : 80% des arrêts sont causés par 20% des équipements

import { useMemo } from 'react'
import C from '../../tokens/colors'

// Seuil Pareto (80%)
const SEUIL_PARETO = 80

export default function ParetoChart({ arrets, seuils }) {
  // Calculer les cumuls par équipement
  const data = useMemo(() => {
    // Grouper par équipement
    const equipMap = new Map()
    
    arrets.forEach(arret => {
      const equipId = arret.equipId
      const duration = arret.duration || 0
      if (equipMap.has(equipId)) {
        equipMap.set(equipId, equipMap.get(equipId) + duration)
      } else {
        equipMap.set(equipId, duration)
      }
    })
    
    // Convertir en tableau et trier par cumul décroissant
    const stats = Array.from(equipMap.entries())
      .map(([id, cumul]) => ({ id, cumul }))
      .sort((a, b) => b.cumul - a.cumul)
    
    // Calculer le total
    const total = stats.reduce((sum, item) => sum + item.cumul, 0)
    
    // Calculer les pourcentages et pourcentages cumulés
    let cumulPercent = 0
    const statsWithPercent = stats.map((item, index) => {
      const percent = total > 0 ? (item.cumul / total) * 100 : 0
      cumulPercent += percent
      return {
        ...item,
        percent: Math.round(percent * 10) / 10,
        cumulPercent: Math.round(cumulPercent * 10) / 10,
        isInPareto: cumulPercent <= SEUIL_PARETO
      }
    })
    
    // Identifier les équipements dans les 80%
    const paretoEquips = statsWithPercent.filter(item => item.isInPareto)
    const pourcentagePareto = paretoEquips.reduce((sum, item) => sum + item.percent, 0)
    
    return {
      items: statsWithPercent,
      total: Math.round(total * 10) / 10,
      paretoEquips: paretoEquips.map(e => e.id),
      pourcentagePareto: Math.round(pourcentagePareto * 10) / 10,
      seuil: SEUIL_PARETO
    }
  }, [arrets])
  
  if (data.items.length === 0) {
    return (
      <div style={{
        background: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '32px',
        textAlign: 'center',
        marginBottom: 20
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text3 }}>
          Aucune donnée disponible pour le diagramme de Pareto
        </div>
        <div style={{ fontSize: 12, color: C.text4, marginTop: 4 }}>
          Ajoutez des arrêts pour visualiser l'analyse Pareto
        </div>
      </div>
    )
  }
  
  // Dimensions du graphique
  const width = 700
  const height = 400
  const margin = { top: 40, right: 80, bottom: 60, left: 60 }
  const graphWidth = width - margin.left - margin.right
  const graphHeight = height - margin.top - margin.bottom
  
  const maxCumul = Math.max(...data.items.map(d => d.cumul))
  const barWidth = graphWidth / data.items.length * 0.7
  const barSpacing = graphWidth / data.items.length * 0.3
  
  // Fonction pour obtenir la hauteur d'une barre
  const getBarHeight = (cumul) => (cumul / maxCumul) * graphHeight
  
  // Fonction pour obtenir la position Y de la courbe cumulative
  const getCurveY = (cumulPercent) => graphHeight - (cumulPercent / 100) * graphHeight
  
  // Générer le path pour la courbe cumulative
  const curvePath = data.items.map((item, index) => {
    const x = margin.left + (index * (barWidth + barSpacing)) + barWidth / 2
    const y = margin.top + getCurveY(item.cumulPercent)
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
  
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: '20px',
      marginBottom: 20,
      boxShadow: '0 2px 8px rgba(0,0,0,.05)'
    }}>
      {/* En-tête */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <div style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: 15,
            color: C.text,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span style={{ fontSize: 18 }}>📊</span>
            Diagramme de Pareto — Analyse des équipements critiques
          </div>
          <div style={{
            fontSize: 11.5,
            color: C.text3,
            marginTop: 3
          }}>
            Principe : 80% des arrêts sont causés par 20% des équipements
          </div>
        </div>
        
        {/* Résumé Pareto */}
        <div style={{
          padding: '8px 16px',
          background: C.redBg,
          borderRadius: 8,
          border: `1px solid ${C.redB}`
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.red }}>
            🔴 {data.paretoEquips.length} équipement(s) représentent {data.pourcentagePareto}% des arrêts
          </span>
        </div>
      </div>
      
      {/* Graphique SVG */}
      <div style={{ overflowX: 'auto' }}>
        <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
          {/* Axe Y (vertical) */}
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={margin.top + graphHeight}
            stroke={C.border}
            strokeWidth="1.5"
          />
          
          {/* Axe X (horizontal) */}
          <line
            x1={margin.left}
            y1={margin.top + graphHeight}
            x2={margin.left + graphWidth}
            y2={margin.top + graphHeight}
            stroke={C.border}
            strokeWidth="1.5"
          />
          
          {/* Grille horizontale */}
          {[0, 20, 40, 60, 80, 100].map(percent => {
            const y = margin.top + graphHeight - (percent / 100) * graphHeight
            const value = (maxCumul * percent / 100).toFixed(0)
            return (
              <g key={percent}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={margin.left + graphWidth}
                  y2={y}
                  stroke={C.bg2}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <text
                  x={margin.left - 8}
                  y={y + 3}
                  fontSize="9"
                  fill={C.text4}
                  textAnchor="end"
                >
                  {value}h
                </text>
              </g>
            )
          })}
          
          {/* Barres (couleur selon dépassement seuil) */}
          {data.items.map((item, index) => {
            const x = margin.left + index * (barWidth + barSpacing)
            const barHeight = getBarHeight(item.cumul)
            const y = margin.top + graphHeight - barHeight
            
            // Déterminer la couleur de la barre
            let barColor
            if (item.cumul >= (seuils?.cumul || 6)) barColor = C.red
            else if (item.cumul >= (seuils?.cumul * 0.67 || 4)) barColor = '#d97706'
            else barColor = C.green
            
            return (
              <g key={item.id}>
                {/* Barre */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={barColor}
                  rx="4"
                  ry="4"
                  opacity={item.isInPareto ? 1 : 0.5}
                  style={{ transition: 'all 0.3s ease' }}
                >
                  <title>{item.id}: {item.cumul}h ({item.percent}%)</title>
                </rect>
                
                {/* Valeur au-dessus de la barre */}
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  fontSize="9"
                  fill={barColor}
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {item.cumul.toFixed(0)}h
                </text>
                
                {/* Pourcentage sur la barre (si assez haut) */}
                {barHeight > 25 && (
                  <text
                    x={x + barWidth / 2}
                    y={y + barHeight / 2 + 3}
                    fontSize="9"
                    fill="#fff"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {item.percent}%
                  </text>
                )}
                
                {/* Nom équipement (incliné) */}
                <text
                  x={x + barWidth / 2}
                  y={margin.top + graphHeight + 20}
                  fontSize="9"
                  fill={C.text2}
                  textAnchor="middle"
                  transform={`rotate(45, ${x + barWidth / 2}, ${margin.top + graphHeight + 20})`}
                >
                  {item.id}
                </text>
              </g>
            )
          })}
          
          {/* Courbe cumulative */}
          <path
            d={curvePath}
            fill="none"
            stroke={C.navy}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Points sur la courbe cumulative */}
          {data.items.map((item, index) => {
            const x = margin.left + index * (barWidth + barSpacing) + barWidth / 2
            const y = margin.top + getCurveY(item.cumulPercent)
            return (
              <circle
                key={`point-${item.id}`}
                cx={x}
                cy={y}
                r="4"
                fill={C.navy}
                stroke="#fff"
                strokeWidth="2"
              >
                <title>{item.id}: {item.cumulPercent}% cumulé</title>
              </circle>
            )
          })}
          
          {/* Ligne horizontale 80% */}
          <line
            x1={margin.left}
            y1={margin.top + getCurveY(SEUIL_PARETO)}
            x2={margin.left + graphWidth}
            y2={margin.top + getCurveY(SEUIL_PARETO)}
            stroke={C.red}
            strokeWidth="2"
            strokeDasharray="6,4"
          />
          <text
            x={margin.left + graphWidth + 5}
            y={margin.top + getCurveY(SEUIL_PARETO) + 3}
            fontSize="9"
            fill={C.red}
            fontWeight="bold"
          >
            80%
          </text>
          
          {/* Labels des axes */}
          <text
            x={margin.left - 35}
            y={margin.top + graphHeight / 2}
            fontSize="10"
            fill={C.text3}
            textAnchor="middle"
            transform={`rotate(-90, ${margin.left - 35}, ${margin.top + graphHeight / 2})`}
          >
            Cumul arrêts (heures)
          </text>
          
          <text
            x={margin.left + graphWidth / 2}
            y={margin.top + graphHeight + 45}
            fontSize="10"
            fill={C.text3}
            textAnchor="middle"
          >
            Équipements
          </text>
          
          <text
            x={margin.left + graphWidth + 15}
            y={margin.top + 20}
            fontSize="10"
            fill={C.navy}
            textAnchor="middle"
            fontWeight="bold"
          >
            %
          </text>
        </svg>
      </div>
      
      {/* Légende */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 24,
        marginTop: 20,
        flexWrap: 'wrap',
        paddingTop: 12,
        borderTop: `1px solid ${C.bg2}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 12, background: C.red, borderRadius: 3 }} />
          <span style={{ fontSize: 11, color: C.text3 }}>🔴 Alerte (≥{seuils?.cumul || 6}h)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 12, background: '#d97706', borderRadius: 3 }} />
          <span style={{ fontSize: 11, color: C.text3 }}>🟡 Surveillance (≥{Math.round((seuils?.cumul || 6) * 0.67)}h)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 12, background: C.green, borderRadius: 3 }} />
          <span style={{ fontSize: 11, color: C.text3 }}>🟢 Normal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 2, background: C.navy }} />
          <span style={{ fontSize: 11, color: C.text3 }}>Courbe cumulative (%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 2, background: C.red, borderStyle: 'dashed' }} />
          <span style={{ fontSize: 11, color: C.text3 }}>Seuil 80% Pareto</span>
        </div>
      </div>
      
      {/* Analyse Pareto */}
      {data.paretoEquips.length > 0 && (
        <div style={{
          marginTop: 16,
          padding: '14px 18px',
          background: C.bluePale,
          borderRadius: 10,
          border: `1px solid ${C.blueMid}`
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 20 }}>🎯</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.navy, marginBottom: 4 }}>
                Analyse Pareto — Actions prioritaires
              </div>
              <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                Les équipements <strong>{data.paretoEquips.join(', ')}</strong> représentent 
                {' '}<strong style={{ color: C.red }}>{data.pourcentagePareto}%</strong> du cumul total d'arrêts ({data.total}h).
                <br />
                🔍 Concentrez vos actions sur ces {data.paretoEquips.length} équipements prioritaires
                pour réduire significativement les arrêts de production.
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Pied de page avec stats */}
      <div style={{
        marginTop: 16,
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        fontSize: 11.5,
        color: C.text4
      }}>
        <span>📊 Total arrêts: {data.total}h</span>
        <span>🏭 Équipements analysés: {data.items.length}</span>
        <span>📈 Seuil Pareto: {SEUIL_PARETO}%</span>
      </div>
    </div>
  )
}