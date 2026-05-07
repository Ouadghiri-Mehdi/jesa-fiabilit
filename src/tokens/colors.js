// Design tokens — identiques aux variables CSS du fichier HTML original
// Usage: import C from '../tokens/colors'  →  C.navy, C.red, etc.

const C = {
  // Navy / Blue
  navy:       '#1a3a6b',
  navy2:      '#1e4280',
  navy3:      '#224a92',
  blue2:      '#1a3a6b',
  bluePale:   '#eff6ff',
  blueMid:    '#bfdbfe',

  // Neutrals
  white:      '#ffffff',
  bg:         '#f8fafc',
  bg2:        '#f1f5f9',
  border:     '#e2e8f0',
  border2:    '#cbd5e1',

  // Text
  text:       '#0f172a',
  text2:      '#334155',
  text3:      '#64748b',
  text4:      '#94a3b8',

  // Semantic
  green:      '#059669',
  greenBg:    '#ecfdf5',
  greenB:     '#a7f3d0',

  orange:     '#d97706',
  orangeBg:   '#FEFFD6',
  orangeB:    '#fde68a',

  red:        '#dc2626',
  redBg:      '#fef2f2',
  redB:       '#fecaca',

  purple:     '#7c3aed',
  purpleBg:   '#f5f3ff',
  purpleB:    '#ddd6fe',

  // Shadows
  shadow:     '0 1px 3px rgba(15,30,53,.07), 0 1px 2px rgba(15,30,53,.05)',
  shadowMd:   '0 4px 12px rgba(15,30,53,.10)',
  shadowLg:   '0 10px 30px rgba(15,30,53,.12)',

  // Radii
  r:          '8px',
  r2:         '12px',
}

export default C

// Status color helper
export const statusColors = {
  normal: { text: C.green,  bg: C.greenBg,  border: C.greenB,  label: '🟢 Normal' },
  watch:  { text: C.orange, bg: C.orangeBg, border: C.orangeB, label: '🟡 Surveillance' },
  alert:  { text: C.red,    bg: C.redBg,    border: C.redB,    label: '🔴 Dépassement seuil' },
}
