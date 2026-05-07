// src/hooks/useTUM.js
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
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
  const [seuilsId,      setSeuilsId]      = useState(null)
  const [equipmentList, setEquipmentList] = useState(INITIAL_EQUIPMENT_LIST)
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const [arretsRes, seuilsRes] = await Promise.all([
        supabase.from('arrets').select('*').order('start_time', { ascending: false }),
        supabase.from('seuils').select('*').single(),
      ])
      if (cancelled) return
      if (arretsRes.data)  setArrets(arretsRes.data.map(rowToArret))
      if (seuilsRes.data) {
        setSeuils(rowToSeuils(seuilsRes.data))
        setSeuilsId(seuilsRes.data.id)
      }
      setLoading(false)
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

  const ajouterArrets = useCallback(async (nouveaux) => {
    if (!user?.siteId) return []
    const rows = nouveaux.map(a => ({
      equip_id:    a.equipId,
      site_id:     user.siteId,
      start_time:  a.startTime,
      duration:    a.duration || 0,
      cause:       a.cause    || null,
      zone:        a.zone     || null,
      designation: a.designation || null,
      created_by:  user.id,
    }))
    const { data, error } = await supabase.from('arrets').insert(rows).select()
    if (!error && data) {
      const inserted = data.map(rowToArret)
      setArrets(prev => [...inserted, ...prev])
      return inserted
    }
    return []
  }, [user])

  const supprimerArret = useCallback(async (id) => {
    await supabase.from('arrets').delete().eq('id', id)
    setArrets(prev => prev.filter(a => a.id !== id))
  }, [])

  const sauvegarderSeuils = useCallback(async (nouveauxSeuils) => {
    setSeuils(nouveauxSeuils)
    if (!seuilsId) return
    await supabase.from('seuils').update({
      n1_cumul:     nouveauxSeuils.n1.cumul,
      n1_frequence: nouveauxSeuils.n1.frequence,
      n1_horizon:   nouveauxSeuils.n1.horizon,
      n2_cumul:     nouveauxSeuils.n2.cumul,
      n2_frequence: nouveauxSeuils.n2.frequence,
      n2_horizon:   nouveauxSeuils.n2.horizon,
    }).eq('id', seuilsId)
  }, [seuilsId])

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
