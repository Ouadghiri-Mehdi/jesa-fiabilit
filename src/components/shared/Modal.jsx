// src/components/shared/Modal.jsx
import C from '../../tokens/colors'

export default function Modal({ title, onClose, children, width = 520 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,.45)',
      zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 12,
        width,
        maxWidth: '95vw',
        maxHeight: '92vh',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeUp .2s ease',
      }}>
        {/* Header */}
        <div style={{
          background: C.navy,
          padding: '14px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#fff', fontFamily: "'Sora', sans-serif" }}>
            {title}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,.6)', fontSize: 22,
            cursor: 'pointer', lineHeight: 1, padding: '0 2px',
          }}>×</button>
        </div>

        {/* Body (scrollable) */}
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
