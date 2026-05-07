// src/hooks/useRCASessions.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

// Convertit une ligne Supabase → format app
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
    dateHeureFin:     row.date_heure_fin  || null,
    cumulArret:       row.cumul_arret     ?? 0,
    frequence:        row.frequence       ?? 0,
    tauxPanne:        row.taux_panne      ?? 0,
    disponibilite:    row.disponibilite   ?? 100,
    participants:     row.participants    || [],
    noeuds:           row.noeuds         || [],
    actionsGenerees:  row.actions_generees || [],
    _siteId:          row.site_id,
  }
}

// Convertit format app → ligne Supabase
function sessionToRow(s, siteId, userId) {
  return {
    id:               s.id,
    titre:            s.titre           || s.equipId || 'Sans titre',
    methode:          s.methode         || null,
    statut:           s.statut          || 'non-commencee',
    equip_id:         s.equipId         || null,
    niveau:           s.niveau          ?? 2,
    source:           s.source          || 'Manuel',
    responsable:      s.responsable     || null,
    zone:             s.zone            || null,
    phenomene:        s.phenomene       || null,
    cause_arret:      s.causeArret      || null,
    date_ouverture:   s.dateOuverture   || new Date().toISOString().slice(0, 10),
    date_heure_fin:   s.dateHeureFin    || null,
    cumul_arret:      s.cumulArret      ?? 0,
    frequence:        s.frequence       ?? 0,
    taux_panne:       s.tauxPanne       ?? 0,
    disponibilite:    s.disponibilite   ?? 100,
    participants:     s.participants    || [],
    noeuds:           s.noeuds         || [],
    actions_generees: s.actionsGenerees || [],
    site_id:          siteId,
    created_by:       userId,
    updated_at:       new Date().toISOString(),
  }
}

export default function useRCASessions() {
  const { user } = useAuth()
  const [sessions,  setSessions]  = useState([])
  const [siteId,    setSiteId]    = useState(null)
  const [loading,   setLoading]   = useState(true)

  // Charger le site_id du profil
  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('site_id').eq('id', user.id).single()
      .then(({ data }) => { if (data) setSiteId(data.site_id) })
  }, [user?.id])

  // Charger les sessions depuis Supabase
  useEffect(() => {
    if (!siteId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('rca_sessions')
        .select('*')
        .order('created_at', { ascending: false })

      if (!cancelled) {
        if (data) setSessions(data.map(rowToSession))
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [siteId])

  // Créer une session
  const createSession = useCallback(async (s) => {
    if (!siteId || !user?.id) return null
    const row = sessionToRow(s, siteId, user.id)
    const { data, error } = await supabase
      .from('rca_sessions').insert(row).select().single()
    if (error || !data) return null
    const session = rowToSession(data)
    setSessions(prev => [session, ...prev])
    return session
  }, [siteId, user?.id])

  // Mettre à jour une session
  const updateSession = useCallback(async (u) => {
    if (!siteId || !user?.id) return
    const row = sessionToRow(u, siteId, user.id)
    const { data } = await supabase
      .from('rca_sessions').update(row).eq('id', u.id).select().single()
    const updated = data ? rowToSession(data) : u
    setSessions(prev => prev.map(s => s.id === u.id ? updated : s))
    return updated
  }, [siteId, user?.id])

  // Supprimer une session
  const deleteSession = useCallback(async (id) => {
    await supabase.from('rca_sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }, [])

  return { sessions, setSessions, loading, createSession, updateSession, deleteSession }
}
