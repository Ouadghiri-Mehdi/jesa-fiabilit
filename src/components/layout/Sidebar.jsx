// src/components/layout/Sidebar.jsx
import { useNavigate, useLocation } from 'react-router-dom'
import C from '../../tokens/colors'

const NAV = [
  {
    section: 'Principal',
    items: [
      {
        path: '/tum',
        label: 'TUM — Time Usage Model',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
        ),
      },
      {
        path: '/rca',
        label: 'Analyses RCA',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Données',
    items: [
      {
        path: '/historique',
        label: 'Historique',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/>
          </svg>
        ),
      },
      {
        path: '/actions',
        label: 'Suivi Actions',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Intelligence Artificielle',
    items: [
      {
        path: '/ia-solution',
        label: 'IA Based Solution',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/>
            <path d="M22 2 12 12"/><circle cx="19" cy="5" r="3"/>
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Administration',
    items: [
      {
        path: '/dashboard',
        label: 'Dashboard',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/>
            <rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>
          </svg>
        ),
      },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle }) {
  const navigate  = useNavigate()
  const { pathname } = useLocation()

  const isActive = (path) => pathname.startsWith(path)

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
      width: collapsed ? 60 : 236,
      background: '#0b2e63',
      display: 'flex', flexDirection: 'column',
      transition: 'width .25s cubic-bezier(.4,0,.2,1)',
      overflow: 'hidden',
      boxShadow: '2px 0 12px rgba(0,0,0,.18)',
    }}>

      {/* Toggle */}
      <div onClick={onToggle} style={{
        position: 'absolute', top: 18, right: -11, zIndex: 10,
        width: 22, height: 22, background: '#0b2e63', borderRadius: '50%',
        border: '1.5px solid rgba(255,255,255,.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'rgba(255,255,255,.6)',
        transition: 'transform .25s',
        transform: collapsed ? 'rotate(180deg)' : 'rotate(0)',
      }}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </div>

      {/* Logo */}
      <div style={{
        padding: collapsed ? '20px 0' : '20px 20px',
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: '1px solid rgba(255,255,255,.08)',
        height: 64, flexShrink: 0,
      }}>
        <svg viewBox="0 0 120 40" width="52" height="18" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="32" fontFamily="Sora,Arial,sans-serif" fontWeight="900" fontSize="38" fill="white" letterSpacing="-1">JESA</text>
        </svg>
        {!collapsed && (
          <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.8)', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            JESA Reliability Hub
          </span>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 0' }}>
        {NAV.map(group => (
          <div key={group.section}>
            {!collapsed && (
              <div style={{
                padding: '14px 20px 6px',
                fontSize: 9.5, fontWeight: 700, letterSpacing: '1.2px',
                color: 'rgba(255,255,255,.35)', textTransform: 'uppercase',
              }}>
                {group.section}
              </div>
            )}
            {group.items.map(item => {
              const active = isActive(item.path)
              return (
                <div key={item.path} onClick={() => navigate(item.path)}
                  title={collapsed ? item.label : ''}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: 10,
                    padding: collapsed ? '11px 0' : '10px 18px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    cursor: 'pointer',
                    color: active ? '#fff' : 'rgba(255,255,255,.60)',
                    background: active ? 'rgba(255,255,255,.10)' : 'transparent',
                    borderLeft: `3px solid ${active ? '#60a5fa' : 'transparent'}`,
                    transition: 'all .15s',
                    position: 'relative',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    borderRadius: collapsed ? 0 : '0 8px 8px 0',
                    marginRight: collapsed ? 0 : 8,
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.06)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ flexShrink: 0 }}>{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </div>
              )
            })}
          </div>
        ))}
      </nav>

    </aside>
  )
}
