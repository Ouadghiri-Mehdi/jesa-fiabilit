// src/components/shared/Notif.jsx
import C from '../../tokens/colors'

export default function Notif({ notifs, dismiss }) {
  if (!notifs.length) return null
  return (
    <div style={{
      position: 'fixed', top: 18, right: 18, width: 320,
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {notifs.map(n => (
        <div key={n.id} style={{
          background: '#fff', borderRadius: 12,
          boxShadow: C.shadowLg,
          padding: '13px 16px',
          borderLeft: `4px solid ${n.type === 'blue' ? C.blue2 : n.type === 'orange' ? C.orange : n.type === 'green' ? C.green : C.red}`,
          pointerEvents: 'all',
          animation: 'slideIn .3s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 12.5, color: C.text }}>{n.title}</span>
            <span onClick={() => dismiss(n.id)} style={{ cursor: 'pointer', color: C.text4, fontSize: 18, lineHeight: 1 }}>×</span>
          </div>
          <div style={{ fontSize: 11.5, color: C.text3 }}>{n.body}</div>
        </div>
      ))}
    </div>
  )
}
