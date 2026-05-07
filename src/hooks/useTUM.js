// src/hooks/useTUM.js
import { useState, useCallback } from 'react'
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

// ─── Clés localStorage ──────────────────────────────────────────────────────

const LS_ARRETS = 'jesa_arrets'
const LS_SEUILS = 'jesa_seuils'
const LS_EQUIP  = 'jesa_equipment_list'

function readArrets() {
  try { return JSON.parse(localStorage.getItem(LS_ARRETS) || '[]') } catch { return [] }
}

function readSeuils() {
  try {
    const raw = localStorage.getItem(LS_SEUILS)
    return raw ? JSON.parse(raw) : DEFAULT_SEUILS
  } catch { return DEFAULT_SEUILS }
}

function readEquipList() {
  try {
    const stored = localStorage.getItem(LS_EQUIP)
    return stored ? JSON.parse(stored) : INITIAL_EQUIPMENT_LIST
  } catch { return INITIAL_EQUIPMENT_LIST }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export default function useTUM() {
  const [arrets,        setArrets]        = useState(readArrets)
  const [seuils,        setSeuils]        = useState(readSeuils)
  const [equipmentList, setEquipmentList] = useState(readEquipList)

  const equipIds      = [...new Set(arrets.map(a => a.equipId))]
  const knownEquipIds = equipmentList.map(e => e.id)

  const alertEquips = equipIds.filter(id => {
    const cumulN2 = calcCumul(arrets, id, seuils.n2.horizon)
    const freqN2  = calcFrequence(arrets, id, seuils.n2.horizon)
    if (getStatut(cumulN2, freqN2, seuils) === 'alert') return true
    const cumulN1 = calcCumul(arrets, id, seuils.n1.horizon)
    const freqN1  = calcFrequence(arrets, id, seuils.n1.horizon)
    return getStatut(cumulN1, freqN1, seuils) === 'watch'
  })

  const ajouterArrets = useCallback((nouveaux) => {
    const withIds = nouveaux.map(a => ({
      ...a,
      id: a.id || `arr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }))
    setArrets(prev => {
      const next = [...withIds, ...prev]
      localStorage.setItem(LS_ARRETS, JSON.stringify(next))
      return next
    })
    return withIds
  }, [])

  const supprimerArret = useCallback((id) => {
    setArrets(prev => {
      const next = prev.filter(a => a.id !== id)
      localStorage.setItem(LS_ARRETS, JSON.stringify(next))
      return next
    })
  }, [])

  const sauvegarderSeuils = useCallback((nouveauxSeuils) => {
    setSeuils(nouveauxSeuils)
    localStorage.setItem(LS_SEUILS, JSON.stringify(nouveauxSeuils))
  }, [])

  const updateEquipmentList = useCallback((list) => {
    setEquipmentList(list)
    localStorage.setItem(LS_EQUIP, JSON.stringify(list))
  }, [])

  return {
    arrets,
    seuils,
    equipIds,
    equipmentList,
    knownEquipIds,
    alertEquips,
    loading: false,
    ajouterArrets,
    supprimerArret,
    sauvegarderSeuils,
    updateEquipmentList,
  }
}
