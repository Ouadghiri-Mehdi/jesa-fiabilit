// src/components/shared/AlertBanner.jsx
import C from '../../tokens/colors'

// type: 'red' | 'orange' | 'blue'
export default function AlertBanner({ type = 'red', title, sub, actionLabel, onAction }) {
  const colors = {
    red:    { bg: C.redBg,    border: C.redB,    icon: C.red,    btn: { bg: C.redBg, color: C.red, border: C.redB } },
    orange: { bg: C.orangeBg, border: C.orangeB, icon: C.orange, btn: { bg: C.orangeBg, color: C.orange, border: C.orangeB } },
    blue:   { bg: C.bluePale, border: C.blueMid, icon: C.blue2,  btn: { bg: C.bluePale, color: C.blue2, border: C.blueMid } },
  }
  const cl = colors[type] || colors.red

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 20px',
      borderRadius: 12,
      marginBottom: 20,
      background: cl.bg,
      border: `1.5px solid ${cl.border}`,
      cursor: onAction ? 'pointer' : 'default',
    }}
      onClick={onAction}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={cl.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: cl.icon }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{sub}</div>}
      </div>

      {actionLabel && (
        <button style={{
          padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          cursor: 'pointer', flexShrink: 0, fontFamily: "'DM Sans', sans-serif",
          background: cl.btn.bg, color: cl.btn.color, border: `1.5px solid ${cl.btn.border}`,
        }}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
