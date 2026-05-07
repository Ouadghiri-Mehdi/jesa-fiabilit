// src/hooks/useRCASessions.js
import { useState, useCallback } from 'react'
import { INITIAL_SESSIONS } from '../data/rcaSessions'

const LS_KEY = 'jesa_rca_sessions'

function readLS() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : INITIAL_SESSIONS
  } catch { return INITIAL_SESSIONS }
}

function saveLS(sessions) {
  localStorage.setItem(LS_KEY, JSON.stringify(sessions))
}

export default function useRCASessions() {
  const [sessions, setSessions] = useState(readLS)

  const createSession = useCallback((s) => {
    const session = {
      ...s,
      id: s.id || `RCA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${(Date.now() % 900) + 100}`,
    }
    setSessions(prev => {
      const next = [session, ...prev]
      saveLS(next)
      return next
    })
    return session
  }, [])

  const updateSession = useCallback((u) => {
    setSessions(prev => {
      const next = prev.map(s => s.id === u.id ? u : s)
      saveLS(next)
      return next
    })
    return u
  }, [])

  const deleteSession = useCallback((id) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      saveLS(next)
      return next
    })
  }, [])

  return { sessions, setSessions, loading: false, createSession, updateSession, deleteSession }
}
