// src/hooks/useRCASessions.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

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
    tempsAnalyse:     row.temps_analyse   || 0,
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

function sessionToRow(s, siteId, userId) {
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
    temps_analyse:     s.tempsAnalyse    || 0,
    cumul_arret:       s.cumulArret      ?? 0,
    frequence:         s.frequence       ?? 0,
    taux_panne:        s.tauxPanne       ?? 0,
    disponibilite:     s.disponibilite   ?? 100,
    participants:      s.participants    || [],
    noeuds:            s.noeuds         || [],
    actions_generees:  s.actionsGenerees || [],
    site_id:           siteId,
    created_by:        userId,
    updated_at:        new Date().toISOString(),
  }
}

export default function useRCASessions() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data } = await supabase
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
  }, [user?.id])

  const createSession = useCallback(async (s) => {
    if (!user?.id || !user?.siteId) {
      console.error('createSession: user ou siteId manquant', user)
      return null
    }
    const row = sessionToRow(s, user.siteId, user.id)
    const { data, error } = await supabase
      .from('rca_sessions').insert(row).select().single()
    if (error) { console.error('createSession error:', error.message); return null }
    const session = rowToSession(data)
    setSessions(prev => [session, ...prev])
    return session
  }, [user])

  const updateSession = useCallback(async (u) => {
    if (!user?.id) return u
    const row = sessionToRow(u, user.siteId, user.id)
    const { data, error } = await supabase
      .from('rca_sessions').update(row).eq('id', u.id).select().single()
    if (error) console.error('updateSession error:', error.message)
    const updated = data ? rowToSession(data) : u
    setSessions(prev => prev.map(s => s.id === u.id ? updated : s))
    return updated
  }, [user])

  const deleteSession = useCallback(async (id) => {
    await supabase.from('rca_sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }, [])

  return { sessions, setSessions, loading, createSession, updateSession, deleteSession }
}
