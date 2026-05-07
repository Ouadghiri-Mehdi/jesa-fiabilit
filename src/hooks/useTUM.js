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

// Convertit une ligne Supabase → format app
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

// Convertit seuils Supabase → format app
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

  // Charger arrêts + seuils + équipements depuis Supabase
  useEffect(() => {
    if (!user?.site) return
    let cancelled = false

    async function load() {
      setLoading(true)

      const [arretsRes, seuilsRes, equipsRes] = await Promise.all([
        supabase.from('arrets').select('*').order('start_time', { ascending: false }),
        supabase.from('seuils').select('*').single(),
        supabase.from('equipements').select('*'),
      ])

      if (cancelled) return

      if (arretsRes.data)  setArrets(arretsRes.data.map(rowToArret))
      if (seuilsRes.data) {
        setSeuils(rowToSeuils(seuilsRes.data))
        setSeuilsId(seuilsRes.data.id)
      }
      if (equipsRes.data?.length) setEquipmentList(equipsRes.data)

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user?.site])

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
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('site_id').eq('id', user.id).single()

    const rows = nouveaux.map(a => ({
      equip_id:   a.equipId,
      site_id:    profile?.site_id,
      start_time: a.startTime,
      duration:   a.duration || 0,
      cause:      a.cause || null,
      zone:       a.zone  || null,
      created_by: user.id,
    }))

    const { data, error } = await supabase.from('arrets').insert(rows).select()
    if (!error && data) setArrets(prev => [...data.map(rowToArret), ...prev])
  }, [user])

  const supprimerArret = useCallback(async (id) => {
    await supabase.from('arrets').delete().eq('id', id)
    setArrets(prev => prev.filter(a => a.id !== id))
  }, [])

  const sauvegarderSeuils = useCallback(async (nouveauxSeuils) => {
    setSeuils(nouveauxSeuils)
    if (!seuilsId) return
    await supabase.from('seuils').update({
      n1_cumul:      nouveauxSeuils.n1.cumul,
      n1_frequence:  nouveauxSeuils.n1.frequence,
      n1_horizon:    nouveauxSeuils.n1.horizon,
      n2_cumul:      nouveauxSeuils.n2.cumul,
      n2_frequence:  nouveauxSeuils.n2.frequence,
      n2_horizon:    nouveauxSeuils.n2.horizon,
    }).eq('id', seuilsId)
  }, [seuilsId])

  const updateEquipmentList = useCallback(async (list) => {
    setEquipmentList(list)
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('site_id').eq('id', user.id).single()

    for (const e of list) {
      await supabase.from('equipements').upsert({
        id:      e.id,
        nom:     e.nom || e.id,
        site_id: profile?.site_id,
        zone:    e.zone || null,
        poste:   e.poste || null,
      })
    }
  }, [user])

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
