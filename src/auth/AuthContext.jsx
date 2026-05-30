// src/auth/AuthContext.jsx
import { createContext, useContext, useState, useCallback } from 'react'
import { api, token } from '../lib/api'

const AuthContext = createContext(null)

// ─── Stubs cross-site (sera remplacé par un endpoint admin plus tard) ─────────

export function getAllClosedRCAs() { return [] }
export function getNewClosedRCAsCount() { return 0 }
export function markNotifSeen() {}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      // Si le token JWT a été effacé, on invalide la session
      if (!localStorage.getItem('jesa_token')) {
        sessionStorage.removeItem('jesa_auth_user')
        return null
      }
      const stored = sessionStorage.getItem('jesa_auth_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const login = useCallback(async (username, password) => {
    try {
      const data = await api.login(username.trim(), password)
      token.set(data.access_token)

      const userData = {
        id:       data.user.id,
        username: data.user.username,
        nom:      data.user.nom,
        prenom:   data.user.prenom,
        role:     data.user.role,
        site_id:  data.user.site_id,
        site:     data.user.site,
        siteKey:  data.user.site_key,
      }

      sessionStorage.setItem('jesa_auth_user', JSON.stringify(userData))
      setUser(userData)
      return true
    } catch {
      return false
    }
  }, [])

  const logout = useCallback(() => {
    token.clear()
    sessionStorage.removeItem('jesa_auth_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
