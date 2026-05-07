// src/hooks/useRCASessions.js
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'

// Convertit une ligne API → format app
function rowToSession(row) {
  return {
    id:               row.id,
    equipId:          row.equip_id        || '',
    titre:            row.titre           || '',
    methode:          row.methode         || null,
    statut:           row.statut          || 'non-commencee',
    niveau:           row.niveau          ?? 2,
    source:           row.source          || 'Manuel',
    responsable:      row.responsable     || '',
    zone:             row.zone            || '',
    phenomene:        row.phenomene       || '',
    causeArret:       row.cause_arret     || '',
    dateOuverture:    row.date_ouverture  || row.created_at?.slice(0, 10) || '',
    dateHeureDebut:   row.date_heure_debut || null,
    dateHeureFin:     row.date_heure_fin  || null,
    cumulArret:       row.cumul_arret     ?? 0,
    frequence:        row.frequence       ?? 0,
    tauxPanne:        row.taux_panne      ?? 0,
    disponibilite:    row.disponibilite   ?? 100,
    participants:     row.participants    || [],
    noeuds:           row.noeuds         || [],
    actionsGenerees:  row.actions_generees || [],
  }
}

// Convertit format app → body API
function sessionToBody(s) {
  return {
    id:                s.id,
    titre:             s.titre           || s.equipId || 'Sans titre',
    methode:           s.methode         || null,
    statut:            s.statut          || 'non-commencee',
    equip_id:          s.equipId         || null,
    niveau:            s.niveau          ?? 2,
    source:            s.source          || 'Manuel',
    responsable:       s.responsable     || null,
    zone:              s.zone            || null,
    phenomene:         s.phenomene       || null,
    cause_arret:       s.causeArret      || null,
    date_ouverture:    s.dateOuverture   || new Date().toISOString().slice(0, 10),
    date_heure_debut:  s.dateHeureDebut  || null,
    date_heure_fin:    s.dateHeureFin    || null,
    cumul_arret:       s.cumulArret      ?? 0,
    frequence:         s.frequence       ?? 0,
    taux_panne:        s.tauxPanne       ?? 0,
    disponibilite:     s.disponibilite   ?? 100,
    participants:      s.participants    || [],
    noeuds:            s.noeuds         || [],
    actions_generees:  s.actionsGenerees || [],
  }
}

export default function useRCASessions() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)

  // Charger les sessions depuis l'API
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const data = await api.get('/api/rca/sessions')
        if (!cancelled && Array.isArray(data)) setSessions(data.map(rowToSession))
      } catch (e) {
        console.error('useRCASessions load error:', e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.id])

  // Créer une session
  const createSession = useCallback(async (s) => {
    if (!user?.id) return null
    try {
      const data = await api.post('/api/rca/sessions', sessionToBody(s))
      if (!data?.id) return null
      const session = rowToSession(data)
      setSessions(prev => [session, ...prev])
      return session
    } catch (e) {
      console.error('createSession error:', e.message)
      return null
    }
  }, [user])

  // Mettre à jour une session
  const updateSession = useCallback(async (u) => {
    if (!user?.id) return u
    try {
      const data = await api.put(`/api/rca/sessions/${u.id}`, sessionToBody(u))
      const updated = data?.id ? rowToSession(data) : u
      setSessions(prev => prev.map(s => s.id === u.id ? updated : s))
      return updated
    } catch (e) {
      console.error('updateSession error:', e.message)
      return u
    }
  }, [user])

  // Supprimer une session
  const deleteSession = useCallback(async (id) => {
    try {
      await api.delete(`/api/rca/sessions/${id}`)
      setSessions(prev => prev.filter(s => s.id !== id))
    } catch (e) {
      console.error('deleteSession error:', e.message)
    }
  }, [])

  return { sessions, setSessions, loading, createSession, updateSession, deleteSession }
}
