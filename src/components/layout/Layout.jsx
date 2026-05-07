// src/components/layout/Layout.jsx
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Notif from '../shared/Notif'
import ChatbotFAB from '../shared/ChatbotFAB'
import useNotifs from '../../hooks/useNotifs'
import useTUM from '../../hooks/useTUM'
import useRCASessions from '../../hooks/useRCASessions'

import { createContext, useContext } from 'react'
export const NotifContext = createContext(null)
export const useNotifContext = () => useContext(NotifContext)

// TUMContext — données TUM persistantes pendant toute la session
export const TUMContext = createContext(null)
export const useTUMContext = () => useContext(TUMContext)

// RCAContext — sessions RCA persistantes pendant toute la session
export const RCAContext = createContext(null)
export const useRCAContext = () => useContext(RCAContext)

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const { notifs, showNotif, dismissNotif } = useNotifs()
  const { pathname } = useLocation()
  const tumData = useTUM()
  const rcaData = useRCASessions()

  const showChatbot = !pathname.startsWith('/rca')
  const SB_W = collapsed ? 60 : 236

  return (
    <TUMContext.Provider value={tumData}>
    <RCAContext.Provider value={rcaData}>
    <NotifContext.Provider value={showNotif}>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>

        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

        <div style={{
          marginLeft: SB_W,
          flex: 1,
          transition: 'margin-left .25s cubic-bezier(.4,0,.2,1)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}>
          <Topbar />
          <main style={{ flex: 1, padding: '24px 32px', minHeight: 0 }}>
            <Outlet />
          </main>
        </div>

        <Notif notifs={notifs} dismiss={dismissNotif} />
        {showChatbot && <ChatbotFAB pathname={pathname} />}

      </div>
    </NotifContext.Provider>
    </RCAContext.Provider>
    </TUMContext.Provider>
  )
}
