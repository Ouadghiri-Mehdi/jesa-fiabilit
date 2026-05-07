// src/components/shared/KPICard.jsx
import C from '../../tokens/colors'

export default function KPICard({ label, value, unit = '', delta, deltaType, accentColor }) {
  const deltaColor =
    deltaType === 'up'   ? C.green :
    deltaType === 'down' ? C.red   : C.text3

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 20,
      borderTop: `3px solid ${accentColor || C.blue2}`,
      boxShadow: C.shadow,
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.text3, letterSpacing: '.7px', textTransform: 'uppercase', marginBottom: 7 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 32, lineHeight: 1, color: C.text }}>
        {value}
        {unit && <span style={{ fontSize: 16, fontWeight: 500, color: C.text3, marginLeft: 2 }}>{unit}</span>}
      </div>
      {delta && (
        <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 5, color: deltaColor }}>
          {delta}
        </div>
      )}
    </div>
  )
}
