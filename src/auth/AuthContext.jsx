// src/auth/AuthContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const USERS = {
  mehdi:   { password: '123', site: 'Rabat',      siteKey: 'rabat' },
  chaimae: { password: '123', site: 'Jorf Lasfar', siteKey: 'jorf'  },
}

const DATA_KEYS = [
  'jesa_arrets',
  'jesa_seuils',
  'jesa_equipment_list',
  'jesa_rca_sessions',
  'jesa_participants_list',
]

function saveUserData(siteKey) {
  DATA_KEYS.forEach(key => {
    const val = localStorage.getItem(key)
    if (val !== null) {
      localStorage.setItem(`${key}_${siteKey}`, val)
    }
  })
}

function loadUserData(siteKey) {
  DATA_KEYS.forEach(key => {
    const val = localStorage.getItem(`${key}_${siteKey}`)
    if (val !== null) {
      localStorage.setItem(key, val)
    } else {
      localStorage.removeItem(key)
    }
  })
}

// Sync live standard key → site-specific key so reads are always fresh.
function syncCurrentUserSessions(currentSiteKey) {
  if (!currentSiteKey) return
  const live = localStorage.getItem('jesa_rca_sessions')
  if (live !== null) {
    localStorage.setItem(`jesa_rca_sessions_${currentSiteKey}`, live)
  }
}

// Same but for ALL data keys (used before switching users).
function syncAllCurrentUserData(currentSiteKey) {
  if (!currentSiteKey) return
  DATA_KEYS.forEach(key => {
    const val = localStorage.getItem(key)
    if (val !== null) {
      localStorage.setItem(`${key}_${currentSiteKey}`, val)
    }
  })
}

export function getAllClosedRCAs(currentSiteKey) {
  syncCurrentUserSessions(currentSiteKey)
  const result = []
  Object.values(USERS).forEach(({ siteKey, site }) => {
    try {
      const raw = localStorage.getItem(`jesa_rca_sessions_${siteKey}`)
      if (!raw) return
      const sessions = JSON.parse(raw)
      sessions
        .filter(s => s.statut === 'cloturee')
        .forEach(s => result.push({ ...s, _site: site, _siteKey: siteKey }))
    } catch {}
  })
  return result
}

function getOtherSiteKey(siteKey) {
  return Object.values(USERS).find(u => u.siteKey !== siteKey)?.siteKey || null
}

export function getNewClosedRCAsCount(currentSiteKey) {
  syncCurrentUserSessions(currentSiteKey)
  const otherKey = getOtherSiteKey(currentSiteKey)
  if (!otherKey) return 0
  try {
    const raw = localStorage.getItem(`jesa_rca_sessions_${otherKey}`)
    if (!raw) return 0
    const sessions = JSON.parse(raw)
    const closed = sessions.filter(s => s.statut === 'cloturee')
    const seenTs = parseInt(localStorage.getItem(`jesa_notif_seen_${currentSiteKey}`) || '0', 10)
    return closed.filter(s => {
      const ts = s.dateHeureFin ? new Date(s.dateHeureFin).getTime() : 0
      return ts > seenTs
    }).length
  } catch {
    return 0
  }
}

export function markNotifSeen(currentSiteKey) {
  localStorage.setItem(`jesa_notif_seen_${currentSiteKey}`, Date.now().toString())
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('jesa_auth_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  // Save data when the tab/page closes so no work is lost.
  useEffect(() => {
    if (!user) return
    const handler = () => saveUserData(user.siteKey)
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [user])

  const login = useCallback((username, password) => {
    const cfg = USERS[username.toLowerCase()]
    if (!cfg || cfg.password !== password) return false

    // Retrieve current user from sessionStorage (may differ from React state
    // if another tab updated it) and save their live data first.
    try {
      const stored = sessionStorage.getItem('jesa_auth_user')
      if (stored) {
        const current = JSON.parse(stored)
        if (current.siteKey && current.siteKey !== cfg.siteKey) {
          syncAllCurrentUserData(current.siteKey)
        }
      }
    } catch {}

    const userData = { username: username.toLowerCase(), site: cfg.site, siteKey: cfg.siteKey }
    loadUserData(cfg.siteKey)
    sessionStorage.setItem('jesa_auth_user', JSON.stringify(userData))
    setUser(userData)
    return true
  }, [])

  const logout = useCallback(() => {
    if (user) {
      saveUserData(user.siteKey)
      sessionStorage.removeItem('jesa_auth_user')
      setUser(null)
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
