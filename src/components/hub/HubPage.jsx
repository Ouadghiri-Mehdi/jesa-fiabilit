// src/components/hub/HubPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, getNewClosedRCAsCount, initializeClosedRcaSeen, markNotifSeen } from '../../auth/AuthContext'

function WorkspaceCard({ title, subtitle, icon, onClick, badge, filled, bg }) {
  const [hovered, setHovered] = useState(false)
  const isFilledStyle = filled
  const boxShadow = hovered
    ? (isFilledStyle ? '0 16px 48px rgba(11,46,99,0.32)' : '0 12px 36px rgba(0,0,0,0.10)')
    : (isFilledStyle ? '0 8px 32px rgba(11,46,99,0.22)' : '0 4px 20px rgba(0,0,0,0.06)')

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        width: 280, padding: '32px 28px 28px',
        borderRadius: 16,
        background: isFilledStyle ? '#0b2e63' : (bg || '#fff'),
        color: isFilledStyle ? '#fff' : '#1e293b',
        border: 'none',
        boxSizing: 'border-box',
        cursor: 'pointer',
        boxShadow,
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform .18s, box-shadow .18s',
        userSelect: 'none',
        textAlign: 'center',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {badge > 0 && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: '#ef4444', color: '#fff',
          borderRadius: 99, minWidth: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, padding: '0 6px',
        }}>
          {badge}
        </div>
      )}
      <div style={{ marginBottom: 20, opacity: isFilledStyle ? 0.9 : 0.7, display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, opacity: isFilledStyle ? 0.8 : 0.65, lineHeight: 1.5 }}>{subtitle}</div>
      <div style={{
        marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        fontSize: 13, fontWeight: 600, opacity: isFilledStyle ? 0.9 : 0.7,
        color: isFilledStyle ? '#fff' : '#0b2e63',
      }}>
        Accéder
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </div>
    </div>
  )
}

export default function HubPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifCount, setNotifCount] = useState(user ? getNewClosedRCAsCount(user.siteKey, user.id) : 0)

  useEffect(() => {
    if (!user) {
      setNotifCount(0)
      return
    }

    initializeClosedRcaSeen(user.id)

    const refresh = () => {
      setNotifCount(getNewClosedRCAsCount(user.siteKey, user.id))
    }

    refresh()
    window.addEventListener('jesaClosedRcaNotification', refresh)
    window.addEventListener('storage', refresh)
    const interval = window.setInterval(refresh, 10000)
    return () => {
      window.removeEventListener('jesaClosedRcaNotification', refresh)
      window.removeEventListener('storage', refresh)
      window.clearInterval(interval)
    }
  }, [user?.siteKey, user?.id])

  function goToSite() {
    navigate('/tum', { replace: true })
  }

  function goToGlobal() {
    if (user) markNotifSeen(user.siteKey, user.id)
    navigate('/global', { replace: true })
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = user?.username?.slice(0, 2).toUpperCase() || '??'

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px',
        borderBottom: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#0b2e63',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, color: '#0b2e63' }}>
            JESA Reliability Hub
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: '#0b2e63',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff',
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{user?.username}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{user?.site}</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              background: '#fff', color: '#0b2e63',
              border: '1.5px solid #0b2e63',
              borderRadius: 8, padding: '7px 16px',
              fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
              transition: 'background .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f0f5ff' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
          >
            Déconnexion
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: '0 40px 60px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
            Bonjour, {user?.username} —
          </div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 28, color: '#0b2e63', letterSpacing: '-0.5px' }}>
            Choisissez votre espace de travail
          </div>
        </div>

        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
          <WorkspaceCard
            title="Mon Site"
            subtitle={`Accéder à votre espace ${user?.site}  TUM, RCA, Actions, Historique`}
            filled
            onClick={goToSite}
            icon={
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            }
          />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 280 }}>
            <WorkspaceCard
              title={notifCount > 0 ? 'Nouvelle RCA' : 'Tracking Global'}
              subtitle="Consulter les RCA clôturées de tous les sites en lecture seule"
              bg="#e2e8f0"
              onClick={goToGlobal}
              badge={notifCount}
              icon={
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
