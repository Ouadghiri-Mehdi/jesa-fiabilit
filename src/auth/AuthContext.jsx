// src/auth/AuthContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Site keys connus pour les vues cross-site (localStorage — sera migré vers Supabase)
const SITE_KEYS = ['rabat', 'jorf', 'casa', 'khb']

const DATA_KEYS = [
  'jesa_arrets',
  'jesa_seuils',
  'jesa_equipment_list',
  'jesa_rca_sessions',
  'jesa_participants_list',
]

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

async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('nom, prenom, role, site_id, sites(nom, code)')
    .eq('id', userId)
    .single()
  return {
    site:    data?.sites?.nom  || '',
    siteKey: (data?.sites?.code || '').toLowerCase(),
    role:    data?.role         || 'user',
    nom:     data?.nom          || '',
    prenom:  data?.prenom       || '',
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restaurer la session existante
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const profile = await fetchProfile(session.user.id)
        setUser({ id: session.user.id, email: session.user.email, ...profile })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const profile = await fetchProfile(session.user.id)
        setUser({ id: session.user.id, email: session.user.email, ...profile })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) console.error('Login error:', error.message)
      return !error
    } catch (e) {
      console.error('Login exception:', e)
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
