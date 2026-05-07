// src/auth/AuthContext.jsx
import { createContext, useContext, useState, useCallback } from 'react'

const SITE_KEYS = ['rabat', 'jorf', 'casa', 'khb']

const LOCAL_USERS = [
  { email: 'mehdi@jesa.ma',     password: 'Jesa2025!', site: 'Rabat',        siteKey: 'rabat', role: 'admin', nom: 'Ouadghiri', prenom: 'Mehdi' },
  { email: 'chaimae@jesa.ma',   password: 'Jesa2025!', site: 'Jorf Lasfar',  siteKey: 'jorf',  role: 'user',  nom: 'User',      prenom: 'Chaimae' },
  { email: 'casa@jesa.ma',      password: 'Jesa2025!', site: 'Casablanca',   siteKey: 'casa',  role: 'user',  nom: 'User',      prenom: 'Casa' },
  { email: 'kherbiga@jesa.ma',  password: 'Jesa2025!', site: 'Khouribga',    siteKey: 'khb',   role: 'user',  nom: 'User',      prenom: 'Kherbiga' },
]

const SESSION_KEY = 'jesa_session'

function syncCurrentUserSessions(currentSiteKey) {
  if (!currentSiteKey) return
  const live = localStorage.getItem('jesa_rca_sessions')
  if (live !== null) localStorage.setItem(`jesa_rca_sessions_${currentSiteKey}`, live)
}

export function getAllClosedRCAs(currentSiteKey) {
  syncCurrentUserSessions(currentSiteKey)
  const result = []
  SITE_KEYS.forEach(siteKey => {
    try {
      const raw = localStorage.getItem(`jesa_rca_sessions_${siteKey}`)
      if (!raw) return
      JSON.parse(raw)
        .filter(s => s.statut === 'cloturee')
        .forEach(s => result.push({ ...s, _siteKey: siteKey }))
    } catch {}
  })
  return result
}

export function getNewClosedRCAsCount(currentSiteKey) {
  syncCurrentUserSessions(currentSiteKey)
  const result = []
  SITE_KEYS.filter(k => k !== currentSiteKey).forEach(siteKey => {
    try {
      const raw = localStorage.getItem(`jesa_rca_sessions_${siteKey}`)
      if (!raw) return
      const seenTs = parseInt(localStorage.getItem(`jesa_notif_seen_${currentSiteKey}`) || '0', 10)
      JSON.parse(raw)
        .filter(s => s.statut === 'cloturee')
        .filter(s => {
          const ts = s.dateHeureFin ? new Date(s.dateHeureFin).getTime() : 0
          return ts > seenTs
        })
        .forEach(s => result.push(s))
    } catch {}
  })
  return result.length
}

export function markNotifSeen(currentSiteKey) {
  localStorage.setItem(`jesa_notif_seen_${currentSiteKey}`, Date.now().toString())
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY)
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  const login = useCallback((email, password) => {
    const found = LOCAL_USERS.find(
      u => u.email === email.trim().toLowerCase() && u.password === password
    )
    if (!found) return false
    const u = {
      id:       found.siteKey,
      email:    found.email,
      site:     found.site,
      siteKey:  found.siteKey,
      role:     found.role,
      nom:      found.nom,
      prenom:   found.prenom,
      username: `${found.prenom} ${found.nom}`,
    }
    setUser(u)
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
    return true
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(SESSION_KEY)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, loading: false }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
