import { useMemo } from 'react'

const MARGIN = { top: 28, right: 30, bottom: 44, left: 56 }
const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0
  const normalized = String(value).trim().replace(',', '.').replace(/[^0-9.\-]+/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const getPointColor = (item) => {
  const severity = item.criticite ?? (item.isTopFreq && item.isTopCumul ? 'Critique' : (item.isTopFreq || item.isTopCumul ? 'Élevé' : 'Faible'))
  if (severity === 'Critique') return '#dc2626'
  if (severity === 'Élevé') return '#f59e0b'
  return '#22c55e'
}

function ProfessionalScatter({
  items = [],
  allItems = null,
  width = 520,
  height = 360,
  freqThreshold = 0,
  cumulThreshold = 0,
  selectedId,
  onPointClick = () => {},
  showLabels = true,
}) {
  const chart = useMemo(() => {
    const plotWidth = Math.max(220, width - MARGIN.left - MARGIN.right)
    const plotHeight = Math.max(180, height - MARGIN.top - MARGIN.bottom)
    const baselineItems = (allItems || items || []).filter(Boolean).map((item) => ({
      ...item,
      freq: parseNumber(item.freq ?? item.frequency ?? item.frequence ?? 0),
      cumul: parseNumber(item.cumul ?? item.duration ?? item.duree ?? 0),
    }))
    const visibleItems = (items || []).filter(Boolean).map((item) => ({
      ...item,
      freq: parseNumber(item.freq ?? item.frequency ?? item.frequence ?? 0),
      cumul: parseNumber(item.cumul ?? item.duration ?? item.duree ?? 0),
    }))
    const maxX = Math.max(1, ...baselineItems.map((d) => d.freq))
    const maxY = Math.max(1, ...baselineItems.map((d) => d.cumul))
    const thresholdX = Math.min(maxX, parseNumber(freqThreshold))
    const thresholdY = Math.min(maxY, parseNumber(cumulThreshold))

    const points = baselineItems.map((item) => {
      const xVal = item.freq
      const yVal = item.cumul
      const x = MARGIN.left + (xVal / maxX) * plotWidth
      const y = MARGIN.top + plotHeight - (yVal / maxY) * plotHeight
      return { item, x, y, xVal, yVal }
    })

    const groups = points.reduce((acc, point) => {
      const key = `${point.xVal}:${point.yVal}`
      if (!acc[key]) acc[key] = []
      acc[key].push(point)
      return acc
    }, {})

    Object.values(groups).forEach((group) => {
      if (group.length <= 1) return
      const center = { x: group[0].x, y: group[0].y }
      const spread = Math.min(18, Math.max(8, group.length * 4))
      group.forEach((point, index) => {
        const angle = (2 * Math.PI * index) / group.length
        const offsetX = Math.cos(angle) * spread
        const offsetY = Math.sin(angle) * spread
        point.x = Math.min(Math.max(MARGIN.left, center.x + offsetX), MARGIN.left + plotWidth)
        point.y = Math.min(Math.max(MARGIN.top, center.y + offsetY), MARGIN.top + plotHeight)
      })
    })

    const itemMap = new Map(points.map((p) => [p.item.id, p]))
    const visiblePoints = visibleItems.map((item) => itemMap.get(item.id)).filter(Boolean)

    return { plotWidth, plotHeight, points: visiblePoints, maxX, maxY, thresholdX, thresholdY }
  }, [items, allItems, width, height, freqThreshold, cumulThreshold])

  const tickCountX = 5
  const tickCountY = 5
  const xTicks = Array.from({ length: tickCountX }, (_, idx) => Math.round((chart.maxX / (tickCountX - 1)) * idx * 100) / 100)
  const yTicks = Array.from({ length: tickCountY }, (_, idx) => Math.round((chart.maxY / (tickCountY - 1)) * idx * 100) / 100)

  const thresholdXPos = MARGIN.left + (chart.thresholdX / chart.maxX) * chart.plotWidth
  const thresholdYPos = MARGIN.top + chart.plotHeight - (chart.thresholdY / chart.maxY) * chart.plotHeight

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <rect x="0" y="0" width={width} height={height} rx="20" fill="#ffffff" />
      <rect x={MARGIN.left} y={MARGIN.top} width={chart.plotWidth} height={chart.plotHeight} rx="20" fill="#f8fafc" />

      <g>
        <rect x={MARGIN.left} y={MARGIN.top} width={chart.plotWidth / 2} height={chart.plotHeight / 2} fill="#ecfdf5" />
        <rect x={MARGIN.left + chart.plotWidth / 2} y={MARGIN.top} width={chart.plotWidth / 2} height={chart.plotHeight / 2} fill="#fef2f2" />
        <rect x={MARGIN.left} y={MARGIN.top + chart.plotHeight / 2} width={chart.plotWidth / 2} height={chart.plotHeight / 2} fill="#f8fafc" />
        <rect x={MARGIN.left + chart.plotWidth / 2} y={MARGIN.top + chart.plotHeight / 2} width={chart.plotWidth / 2} height={chart.plotHeight / 2} fill="#fff7ed" />
      </g>

      <g>
        <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + chart.plotHeight} stroke="#0f172a" strokeWidth="1.4" />
        <line x1={MARGIN.left} y1={MARGIN.top + chart.plotHeight} x2={MARGIN.left + chart.plotWidth} y2={MARGIN.top + chart.plotHeight} stroke="#0f172a" strokeWidth="1.4" />
        <path d={`M${MARGIN.left} ${MARGIN.top} L${MARGIN.left - 6} ${MARGIN.top + 12} L${MARGIN.left + 6} ${MARGIN.top + 12} Z`} fill="#0f172a" />
        <path d={`M${MARGIN.left + chart.plotWidth} ${MARGIN.top + chart.plotHeight} L${MARGIN.left + chart.plotWidth - 12} ${MARGIN.top + chart.plotHeight + 6} L${MARGIN.left + chart.plotWidth - 12} ${MARGIN.top + chart.plotHeight - 6} Z`} fill="#0f172a" />
      </g>

      <g>
        {yTicks.map((value, index) => {
          const y = MARGIN.top + chart.plotHeight - (value / chart.maxY) * chart.plotHeight
          return (
            <g key={`ytick-${index}`}>
              <line x1={MARGIN.left - 4} y1={y} x2={MARGIN.left} y2={y} stroke="#94a3b8" strokeWidth="1.2" />
              <line x1={MARGIN.left} y1={y} x2={MARGIN.left + chart.plotWidth} y2={y} stroke="#cbd5e1" strokeWidth="1" opacity="0.7" />
              <text x={MARGIN.left - 12} y={y + 4} textAnchor="end" fontSize="10" fill="#475569">{value}</text>
            </g>
          )
        })}
        {xTicks.map((value, index) => {
          const x = MARGIN.left + (value / chart.maxX) * chart.plotWidth
          return (
            <g key={`xtick-${index}`}>
              <line x1={x} y1={MARGIN.top + chart.plotHeight} x2={x} y2={MARGIN.top + chart.plotHeight + 4} stroke="#94a3b8" strokeWidth="1.2" />
              <line x1={x} y1={MARGIN.top} x2={x} y2={MARGIN.top + chart.plotHeight} stroke="#cbd5e1" strokeWidth="1" opacity="0.6" />
              <text x={x} y={MARGIN.top + chart.plotHeight + 18} textAnchor="middle" fontSize="10" fill="#475569">{value}</text>
            </g>
          )
        })}
      </g>

      <g opacity="0.9">
        <line x1={thresholdXPos} y1={MARGIN.top} x2={thresholdXPos} y2={MARGIN.top + chart.plotHeight} stroke="#f97316" strokeWidth="1.5" strokeDasharray="6 5" />
        <line x1={MARGIN.left} y1={thresholdYPos} x2={MARGIN.left + chart.plotWidth} y2={thresholdYPos} stroke="#f97316" strokeWidth="1.5" strokeDasharray="6 5" />
      </g>

      <g>
        {chart.points.map(({ item, x, y, xVal, yVal }) => {
          const active = selectedId !== undefined && selectedId !== null && selectedId === item.id
          const color = getPointColor(item)
          return (
            <g key={`${item.id}-${x}-${y}`} style={{ cursor: 'pointer' }} onClick={() => onPointClick(item.id)}>
              <circle cx={x} cy={y} r={active ? 10 : 8} fill={color} stroke="#ffffff" strokeWidth="2" />
              {active && <circle cx={x} cy={y} r={14} fill="none" stroke="#0f172a" strokeWidth="1.4" opacity="0.25" />}
              {showLabels && (
                <text x={x + 10} y={y - 10} fill="#0f172a" fontSize="11" fontWeight="700">{String(item.id).slice(0, 16)}</text>
              )}
              <title>{`${item.id} — Fréquence: ${xVal} / Durée: ${yVal}`}</title>
            </g>
          )
        })}
      </g>

      <g>
        <text x={width / 2} y={height - 6} fill="#475569" fontSize="12" fontWeight="600" textAnchor="middle">Fréquence des pannes</text>
        <text x={18} y={MARGIN.top + chart.plotHeight / 2} fill="#475569" fontSize="12" fontWeight="600" textAnchor="middle" transform={`rotate(-90 18 ${MARGIN.top + chart.plotHeight / 2})`}>
          Durée des arrêts (h)
        </text>
      </g>

      <g>
        <text x={MARGIN.left + 12} y={MARGIN.top + 20} fill="#16a34a" fontSize="12" fontWeight="700">Pannes rares mais longues</text>
        <text x={MARGIN.left + chart.plotWidth - 12} y={MARGIN.top + 20} fill="#dc2626" fontSize="12" fontWeight="700" textAnchor="end">Postes techniques critiques</text>
        <text x={MARGIN.left + 12} y={MARGIN.top + chart.plotHeight - 12} fill="#16a34a" fontSize="12" fontWeight="700">Peu critiques</text>
        <text x={MARGIN.left + chart.plotWidth - 12} y={MARGIN.top + chart.plotHeight - 12} fill="#475569" fontSize="12" fontWeight="700" textAnchor="end">Pannes fréquentes mais courtes</text>
      </g>
    </svg>
  )
}

export default ProfessionalScatter
