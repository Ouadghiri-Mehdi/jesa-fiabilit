// src/components/tum/SeuilStatus.jsx
// Carte équipement : statut, barre cumul, fréquence, bouton RCA si alerte

import C, { statusColors } from '../../tokens/colors'
import { calcCumul, calcFrequence, getStatut, getPourcentage } from '../../hooks/useTUM'

export default function SeuilStatus({ equipId, arrets, seuils, onLancerRCA }) {
  const cumul  = calcCumul(arrets, equipId, seuils.horizon)
  const freq   = calcFrequence(arrets, equipId, seuils.horizon)
  const statut = getStatut(cumul, freq, seuils)
  const pct    = getPourcentage(cumul, seuils.cumul)
  const sc     = statusColors[statut]

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 18,
      borderLeft: `3px solid ${sc.text}`,
      boxShadow: C.shadow,
      animation: 'fadeUp .2s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 15, color: C.text }}>
            {equipId}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 10px', borderRadius: 20,
            fontSize: 11, fontWeight: 700,
            background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
            marginTop: 5,
          }}>
            {sc.label}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 10.5, color: C.text4, lineHeight: 1.6 }}>
          <div>Horizon {seuils.horizon}j</div>
          <div>{freq} arrêt(s)</div>
        </div>
      </div>

      {/* Barre cumul */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: C.text3, fontWeight: 600 }}>Cumul arrêts</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: sc.text }}>
            {cumul.toFixed(1)}h / {seuils.cumul}h
          </span>
        </div>
        <div style={{ height: 6, background: C.bg2, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: sc.text,
            borderRadius: 3,
            transition: 'width 1.2s cubic-bezier(.4,0,.2,1)',
          }} />
        </div>
      </div>

      {/* Fréquence */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.text3, marginBottom: statut === 'alert' ? 14 : 0 }}>
        <span>Fréquence</span>
        <span style={{ fontWeight: 700, color: freq >= seuils.frequence ? C.red : C.text2 }}>
          {freq} fois / {seuils.frequence} seuil
        </span>
      </div>

      {/* Bouton RCA — visible uniquement si alerte */}
      {statut === 'alert' && (
        <button
          onClick={() => onLancerRCA(equipId)}
          style={{
            width: '100%', marginTop: 6, padding: '9px 0',
            background: C.redBg, border: `1.5px solid ${C.redB}`,
            borderRadius: 25, fontSize: 12.5, fontWeight: 700,
            color: C.red, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            fontFamily: "'DM Sans', sans-serif",
            transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = C.redBg; e.currentTarget.style.color = C.red }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
           Lancer RCA
        </button>
      )}
    </div>
  )
}
