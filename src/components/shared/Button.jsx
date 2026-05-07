// src/components/shared/Button.jsx
// variant: 'navy' | 'white' | 'ghost' | 'danger' | 'green' | 'excel'
import C from '../../tokens/colors'

const VARIANTS = {
  navy:   { background: C.navy,   color: '#fff',   border: 'none' },
  white:  { background: '#fff',   color: C.text2,  border: `1.5px solid ${C.border2}` },
  ghost:  { background: 'transparent', color: C.text3, border: `1.5px solid ${C.border}` },
  danger: { background: C.redBg, color: C.red,    border: `1.5px solid ${C.redB}` },
  green:  { background: '#217346', color: '#fff',  border: 'none' },
  excel:  { background: 'linear-gradient(135deg,#1d6f42,#217346)', color: '#fff', border: 'none' },
}

export default function Button({
  children,
  variant = 'navy',
  size = 'md',
  onClick,
  disabled = false,
  style: extraStyle = {},
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.navy
  const pad = size === 'sm' ? '5px 13px' : size === 'lg' ? '11px 24px' : '8px 18px'
  const fs  = size === 'sm' ? 12 : size === 'lg' ? 14 : 13

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: pad,
        borderRadius: 25,
        fontSize: fs,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: v.border,
        background: v.background,
        color: v.color,
        fontFamily: "'DM Sans', sans-serif",
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        whiteSpace: 'nowrap',
        transition: 'all .15s',
        opacity: disabled ? 0.5 : 1,
        ...extraStyle,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
