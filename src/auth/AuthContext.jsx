// src/auth/AuthContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { api, token } from '../lib/api'

const AuthContext = createContext(null)

const STORAGE_KEY = 'jesa_closed_rca_notifs'

function normalizeClosedRcaStorage(raw) {
  if (!raw || typeof raw !== 'object') {
    return { events: [], seen: {} }
  }

  if (Array.isArray(raw.events)) {
    return {
      events: raw.events,
      seen: typeof raw.seen === 'object' && raw.seen !== null ? raw.seen : {},
    }
  }

  // Backwards compatibility: old site-key partitioned storage
  const events = []
  const seen = {}
  for (const key of Object.keys(raw)) {
    if (key === 'seen') {
      if (typeof raw.seen === 'object' && raw.seen !== null) {
        Object.assign(seen, raw.seen)
      }
      continue
    }
    const bucket = raw[key]
    if (bucket && Array.isArray(bucket.events)) {
      for (const event of bucket.events) {
        events.push({
          ...event,
          originSiteKey: key,
          details: {
            siteKey: key,
            ...(event.details || {}),
          },
        })
      }
    }
  }

  return { events, seen }
}

function readClosedRcaStorage() {
  if (typeof window === 'undefined') return { events: [], seen: {} }
  try {
    return normalizeClosedRcaStorage(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'))
  } catch {
    return { events: [], seen: {} }
  }
}

function writeClosedRcaStorage(data) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      events: Array.isArray(data.events) ? data.events : [],
      seen: typeof data.seen === 'object' && data.seen !== null ? data.seen : {},
    }))
    window.dispatchEvent(new Event('jesaClosedRcaNotification'))
  } catch {
    // ignore
  }
}

function readClosedRcaCount(siteKey, userKey) {
  if (!siteKey || !userKey) return 0
  const storage = readClosedRcaStorage()
  const seenAt = storage.seen?.[userKey] || 0
  return storage.events.filter(event =>
    event.type === 'push' &&
    event.timestamp > seenAt &&
    event.originSiteKey !== siteKey
  ).length
}

function readClosedRcaEvent(siteKey, userKey) {
  if (!siteKey || !userKey) return null
  const storage = readClosedRcaStorage()
  const seenAt = storage.seen?.[userKey] || 0
  for (let i = storage.events.length - 1; i >= 0; i -= 1) {
    const event = storage.events[i]
    if (
      event.type === 'push' &&
      event.timestamp > seenAt &&
      event.originSiteKey !== siteKey
    ) {
      return event
    }
  }
  return null
}

function writeClosedRcaStorageData(siteKey, data) {
  if (typeof window === 'undefined') return
  writeClosedRcaStorage(data)
}

export function getAllClosedRCAs() { return [] }
export function getNewClosedRCAsCount(siteKey, userKey) { return readClosedRcaCount(siteKey, userKey) }
export function getClosedRcaEvent(siteKey, userKey) { return readClosedRcaEvent(siteKey, userKey) }
export function initializeClosedRcaSeen(userKey) {
  if (!userKey) return
  const storage = readClosedRcaStorage()
  storage.seen = typeof storage.seen === 'object' && storage.seen !== null ? storage.seen : {}
  if (!storage.seen[userKey]) {
    storage.seen[userKey] = Date.now()
    writeClosedRcaStorage(storage)
  }
}
export function markNotifSeen(siteKey, userKey) {
  if (!userKey) return
  const storage = readClosedRcaStorage()
  storage.seen[userKey] = Date.now()
  writeClosedRcaStorage(storage)
}
export function pushClosedRcaNotification(siteKey, senderKey, details = {}) {
  if (!siteKey) return
  const storage = readClosedRcaStorage()
  storage.events = storage.events || []
  storage.events.push({
    id: `closed-rca-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'push',
    sender: senderKey || null,
    originSiteKey: siteKey,
    timestamp: Date.now(),
    details: {
      site: details.site || null,
      siteKey: siteKey || null,
      posteTechnique: details.posteTechnique || details.equipId || null,
      designation: details.designation || null,
      zone: details.zone || null,
      rcaId: details.rcaId || null,
    },
  })
  if (storage.events.length > 100) {
    storage.events = storage.events.slice(-100)
  }
  writeClosedRcaStorage(storage)
}

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

  // No realtime WebSocket: rely on localStorage + "jesaClosedRcaNotification" event

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
