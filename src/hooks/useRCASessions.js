// src/hooks/useRCASessions.js
import { useState, useCallback, useEffect } from 'react'
import { api } from '../lib/api'

export default function useRCASessions() {
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let cancelled = false
    api.getSessions()
      .then(data => { if (!cancelled) setSessions(data) })
      .catch(err  => console.error('useRCASessions:', err))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const createSession = useCallback(async (s) => {
    const created = await api.createSession(s)
    // Upsert : si session existante retournée par le backend, remplacer sans dupliquer
    setSessions(prev => {
      const exists = prev.some(x => x.id === created.id)
      return exists ? prev.map(x => x.id === created.id ? created : x) : [created, ...prev]
    })
    return created
  }, [])

  const updateSession = useCallback(async (s) => {
    const updated = await api.updateSession(s.id, s)
    setSessions(prev => prev.map(x => x.id === updated.id ? updated : x))
    return updated
  }, [])

  const deleteSession = useCallback(async (id) => {
    await api.deleteSession(id)
    setSessions(prev => prev.filter(x => x.id !== id))
  }, [])

  return { sessions, setSessions, loading, createSession, updateSession, deleteSession }
}
