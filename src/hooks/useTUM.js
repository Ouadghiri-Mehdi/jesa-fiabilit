// src/hooks/useTUM.js
import { useState, useCallback, useEffect, useMemo } from 'react'
import { api } from '../lib/api'
import { DEFAULT_SEUILS } from '../data/seuils'

// ─── Fonctions pures ───────────────────────────────────────────────────────────

export function calcCumul(arrets, equipId, horizonJours) {
  const cutoff = new Date(Date.now() - horizonJours * 86_400_000)
  return arrets
    .filter(a => a.equipId === equipId && new Date(a.startTime) >= cutoff)
    .reduce((acc, a) => acc + (a.duration || 0), 0)
}

export function calcFrequence(arrets, equipId, horizonJours) {
  const cutoff = new Date(Date.now() - horizonJours * 86_400_000)
  return arrets.filter(a => a.equipId === equipId && new Date(a.startTime) >= cutoff).length
}

export function getStatut(cumul, frequence, seuils) {
  if (cumul >= seuils.n2.cumul)         return 'alert'
  if (frequence >= seuils.n2.frequence) return 'alert'
  if (cumul >= seuils.n1.cumul)         return 'watch'
  if (frequence >= seuils.n1.frequence) return 'watch'
  return 'normal'
}

export function getMethode(statut) {
  if (statut === 'alert') return '5why'
  if (statut === 'watch') return 'kaizen'
  return null
}

export function getPourcentage(cumul, seuilCumul) {
  return Math.min(100, (cumul / seuilCumul) * 100)
}

// ─── Helper : date de clôture d'un équipement ─────────────────────────────────
// Si dateHeureFin absent → on prend updatedAt → sinon NOW()
// "NOW()" signifie : on ne sait pas quand c'était clôturé, mais TOUS les arrêts
// existants (dans le passé) font partie de l'ancien cycle → cumul = 0
export function getLastClosure(sessions, equipId) {
  const closed = sessions.filter(s => s.equipId === equipId && s.statut === 'cloturee')
  if (closed.length === 0) return null
  return closed.reduce((latest, s) => {
    const d = s.dateHeureFin
      ? new Date(s.dateHeureFin)
      : s.updatedAt
        ? new Date(s.updatedAt)
        : new Date() // fallback → tous les arrêts existants = ancien cycle
    return (!latest || d > latest) ? d : latest
  }, null)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export default function useTUM() {
  const [arrets,        setArrets]        = useState([])
  const [seuils,        setSeuils]        = useState(DEFAULT_SEUILS)
  const [equipmentList, setEquipmentList] = useState([])
  const [causesList,    setCausesList]    = useState([])
  const [sessions,      setSessions]      = useState([])
  const [loading,       setLoading]       = useState(true)

  // Chargement initial
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [a, s, e, c, sess] = await Promise.all([
          api.getArrets(),
          api.getSeuils(),
          api.getEquipements(),
          api.getCauses(),
          api.getSessions(),
        ])
        if (cancelled) return
        setArrets(a)
        setSeuils(s)
        setEquipmentList(e)
        setCausesList(c)
        setSessions(sess)
      } catch (err) {
        console.error('useTUM: erreur chargement', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Dérivés
  const knownEquipIds = equipmentList.map(e => e.id)
  const equipIds      = [...new Set(arrets.map(a => a.equipId))]

  // Arrêts du cycle actuel : uniquement les sessions OPEN (en cours)
  const arretsCycle = useMemo(() => {
    return arrets.filter(a => !a.sessionStatus || a.sessionStatus === 'OPEN')
  }, [arrets])

  // Équipements en alerte/surveillance (sessions OPEN uniquement dans l'horizon)
  const alertEquips = useMemo(() => {
    return equipIds.filter(id => {
      const freshArrets = arretsCycle.filter(a => a.equipId === id)
      const cutN2 = new Date(Date.now() - seuils.n2.horizon * 86_400_000)
      const cutN1 = new Date(Date.now() - seuils.n1.horizon * 86_400_000)
      const arrN2   = freshArrets.filter(a => new Date(a.startTime) >= cutN2)
      const cumulN2 = arrN2.reduce((s, a) => s + (a.duration || 0), 0)
      const freqN2  = arrN2.reduce((s, a) => s + (a.frequence || 1), 0)
      if (getStatut(cumulN2, freqN2, seuils) === 'alert') return true
      const arrN1   = freshArrets.filter(a => new Date(a.startTime) >= cutN1)
      const cumulN1 = arrN1.reduce((s, a) => s + (a.duration || 0), 0)
      const freqN1  = arrN1.reduce((s, a) => s + (a.frequence || 1), 0)
      return getStatut(cumulN1, freqN1, seuils) === 'watch'
    })
  }, [equipIds, arretsCycle, seuils])

  // Actions
  const ajouterArrets = useCallback(async (nouveaux) => {
    try {
      for (const arret of nouveaux) {
        let isNewSession = false
        let sessionId
        try {
          // Nouvelle session → durée incluse directement dans startIncident
          const result = await api.startIncident(arret)
          sessionId    = result.session_id
          isNewSession = true
        } catch (err) {
          // 409 = session OPEN déjà en cours → ajouter à l'existante
          const active = await api.getActiveIncident(arret.equipId)
          if (active?.has_active_incident && active?.session_id) {
            sessionId = active.session_id
          } else {
            throw err
          }
        }
        // addDuration uniquement pour les sessions existantes (incrémente durée + fréquence)
        if (!isNewSession && (arret.duration || 0) > 0) {
          await api.addDuration(sessionId, arret.duration)
        }
        // La session reste OPEN — elle se ferme uniquement lors de la clôture RCA
      }
      const [fresh, freshSessions] = await Promise.all([api.getArrets(), api.getSessions()])
      setArrets(fresh)
      setSessions(freshSessions)
      return fresh
    } catch (err) {
      console.error('ajouterArrets:', err)
      throw err
    }
  }, [])

  const supprimerArret = useCallback(async (id) => {
    try {
      await api.deleteArret(id)
      setArrets(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      console.error('supprimerArret:', err)
      throw err
    }
  }, [])

  const sauvegarderSeuils = useCallback(async (nouveauxSeuils) => {
    try {
      const saved = await api.updateSeuils(nouveauxSeuils)
      setSeuils(saved)
    } catch (err) {
      console.error('sauvegarderSeuils:', err)
      throw err
    }
  }, [])

  const refreshSessions = useCallback(async () => {
    try {
      const fresh = await api.getSessions()
      setSessions(fresh)
    } catch (err) {
      console.error('refreshSessions:', err)
    }
  }, [])

  const updateEquipmentList = useCallback(async () => {
    try { setEquipmentList(await api.getEquipements()) } catch (err) { console.error(err) }
  }, [])

  const updateCausesList = useCallback(async () => {
    try { setCausesList(await api.getCauses()) } catch (err) { console.error(err) }
  }, [])

  return {
    arrets,
    arretsCycle,
    seuils,
    sessions,
    equipIds,
    equipmentList,
    knownEquipIds,
    causesList,
    alertEquips,
    loading,
    ajouterArrets,
    supprimerArret,
    sauvegarderSeuils,
    refreshSessions,
    updateEquipmentList,
    updateCausesList,
  }
}
