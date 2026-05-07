// src/hooks/useTUM.js
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { api } from '../lib/api'
import { DEFAULT_SEUILS } from '../data/seuils'
import { EQUIPMENT_LIST as INITIAL_EQUIPMENT_LIST } from '../data/equipements'

// ─── Fonctions pures ────────────────────────────────────────────────────────

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

// Convertit une ligne API → format app
function rowToArret(row) {
  return {
    id:          row.id,
    equipId:     row.equip_id,
    designation: row.designation || '',
    zone:        row.zone || '',
    startTime:   row.start_time,
    duration:    row.duration,
    cause:       row.cause || '',
  }
}

// Convertit seuils API → format app
function rowToSeuils(row) {
  if (!row) return DEFAULT_SEUILS
  return {
    n1: { cumul: row.n1_cumul, frequence: row.n1_frequence, horizon: row.n1_horizon },
    n2: { cumul: row.n2_cumul, frequence: row.n2_frequence, horizon: row.n2_horizon },
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export default function useTUM() {
  const { user } = useAuth()
  const [arrets,        setArrets]        = useState([])
  const [seuils,        setSeuils]        = useState(DEFAULT_SEUILS)
  const [equipmentList, setEquipmentList] = useState(INITIAL_EQUIPMENT_LIST)
  const [loading,       setLoading]       = useState(true)

  // Charger arrêts + seuils depuis l'API
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [arretsData, seuilsData] = await Promise.all([
          api.get('/api/tum/arrets'),
          api.get('/api/tum/seuils'),
        ])
        if (cancelled) return
        if (Array.isArray(arretsData)) setArrets(arretsData.map(rowToArret))
        if (seuilsData) setSeuils(rowToSeuils(seuilsData))
      } catch (e) {
        console.error('useTUM load error:', e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.id])

  const knownEquipIds = equipmentList.map(e => e.id)
  const equipIds      = [...new Set(arrets.map(a => a.equipId))]

  const alertEquips = equipIds.filter(id => {
    const cumulN2 = calcCumul(arrets, id, seuils.n2.horizon)
    const freqN2  = calcFrequence(arrets, id, seuils.n2.horizon)
    if (getStatut(cumulN2, freqN2, seuils) === 'alert') return true
    const cumulN1 = calcCumul(arrets, id, seuils.n1.horizon)
    const freqN1  = calcFrequence(arrets, id, seuils.n1.horizon)
    return getStatut(cumulN1, freqN1, seuils) === 'watch'
  })

  // Ajouter arrêts (import Excel ou saisie manuelle)
  const ajouterArrets = useCallback(async (nouveaux) => {
    if (!user?.id) return
    const rows = nouveaux.map(a => ({
      equip_id:   a.equipId,
      start_time: a.startTime,
      duration:   a.duration || 0,
      cause:      a.cause    || null,
      zone:       a.zone     || null,
      designation: a.designation || null,
    }))
    try {
      const data = await api.post('/api/tum/arrets', rows)
      if (Array.isArray(data)) setArrets(prev => [...data.map(rowToArret), ...prev])
    } catch (e) {
      console.error('ajouterArrets error:', e.message)
    }
  }, [user])

  const supprimerArret = useCallback(async (id) => {
    try {
      await api.delete(`/api/tum/arrets/${id}`)
      setArrets(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      console.error('supprimerArret error:', e.message)
    }
  }, [])

  const sauvegarderSeuils = useCallback(async (nouveauxSeuils) => {
    setSeuils(nouveauxSeuils)
    try {
      await api.put('/api/tum/seuils', {
        n1_cumul:     nouveauxSeuils.n1.cumul,
        n1_frequence: nouveauxSeuils.n1.frequence,
        n1_horizon:   nouveauxSeuils.n1.horizon,
        n2_cumul:     nouveauxSeuils.n2.cumul,
        n2_frequence: nouveauxSeuils.n2.frequence,
        n2_horizon:   nouveauxSeuils.n2.horizon,
      })
    } catch (e) {
      console.error('sauvegarderSeuils error:', e.message)
    }
  }, [])

  const updateEquipmentList = useCallback((list) => {
    setEquipmentList(list)
  }, [])

  return {
    arrets,
    seuils,
    equipIds,
    equipmentList,
    knownEquipIds,
    alertEquips,
    loading,
    ajouterArrets,
    supprimerArret,
    sauvegarderSeuils,
    updateEquipmentList,
  }
}
