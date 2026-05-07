// src/components/layout/Topbar.jsx
import { useLocation, useNavigate } from 'react-router-dom'
import C from '../../tokens/colors'
import Button from '../shared/Button'
import { useAuth, getNewClosedRCAsCount, markNotifSeen } from '../../auth/AuthContext'

const PAGE_META = {
  '/tum':        { title: 'TUM — Time Usage Model',  sub: 'Suivi des arrêts & calcul des cumuls' },
  '/rca':        { title: 'Analyses RCA',            sub: 'Root Cause Analysis' },
  '/actions':    { title: 'Suivi Actions',           sub: "Plan d'actions correctives & préventives" },
  '/historique': { title: 'Historique',              sub: 'Dossiers équipements & historique pannes' },
  '/dashboard':  { title: 'Dashboard',               sub: 'Vue globale fiabilité — OCP Jorf Lasfar' },
  '/config':     { title: 'Seuils & Configuration',  sub: 'Paramétrage des seuils TUM et équipements' },
  '/sap':        { title: 'Workflow SAP',            sub: 'Notifications · Ordres de travail · Clôture' },
}

export default function Topbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const key  = Object.keys(PAGE_META).find(k => pathname.startsWith(k)) || '/tum'
  const meta = PAGE_META[key]

  const isTUMPage    = key === '/tum'
  const isMainRCAPage = pathname === '/rca'

  const notifCount = user ? getNewClosedRCAsCount(user.siteKey) : 0
  const initials   = user?.username?.slice(0, 2).toUpperCase() || '??'

  function handleNotifClick() {
    if (user) markNotifSeen(user.siteKey)
    navigate('/global')
  }

  return (
    <header style={{
      height: 64,
      background: '#fff',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      flexShrink: 0,
    }}>
      <div>
        <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, color: C.text }}>
          {meta.title}
        </div>
        <div style={{ fontSize: 11.5, color: C.text3, marginTop: 1 }}>
          {meta.sub}
          {user?.site && (
            <span style={{ marginLeft: 10, color: '#1a3a6b', fontWeight: 600 }}>
              · {user.site}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Actions contextuelles */}
        {isTUMPage && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => navigate('/tum?modal=seuils')}
              title="Seuils & paramétrage"
              style={{
                width: 38, height: 38, borderRadius: '50%',
                border: `1.5px solid ${C.border2}`,
                background: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.text3, transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.color = C.navy }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text3 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>

            <Button variant="white">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </Button>
          </div>
        )}

        {isMainRCAPage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button variant="navy" onClick={() => navigate('/rca?modal=new')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nouvelle RCA
            </Button>
          </div>
        )}

        {/* Notification bell */}
        <button
          onClick={handleNotifClick}
          title="Notifications — RCA clôturées (autres sites)"
          style={{
            position: 'relative',
            width: 38, height: 38, borderRadius: '50%',
            border: `1.5px solid ${notifCount > 0 ? '#059669' : C.border2}`,
            background: notifCount > 0 ? '#f0fdf4' : '#fff',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: notifCount > 0 ? '#059669' : C.text3,
            transition: 'all .15s',
            marginLeft: (isTUMPage || isMainRCAPage) ? 4 : 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.color = '#059669' }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = notifCount > 0 ? '#059669' : C.border2
            e.currentTarget.style.color = notifCount > 0 ? '#059669' : C.text3
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {notifCount > 0 && (
            <span style={{
              position: 'absolute', top: -3, right: -3,
              background: '#ef4444', color: '#fff',
              borderRadius: 99, minWidth: 16, height: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, padding: '0 3px',
              border: '1.5px solid #fff',
            }}>
              {notifCount}
            </span>
          )}
        </button>

        {/* User avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: C.navy, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, cursor: 'default',
          marginLeft: 4,
          title: user?.username,
        }}>
          {initials}
        </div>
      </div>
    </header>
  )
}
