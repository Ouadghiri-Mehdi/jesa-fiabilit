// src/hooks/useTUM.js
// Logique métier TUM : cumul, fréquence, statut
// Utilisé par : TUMPage, SeuilStatus, BadActors, CumulCalculator

import { useState, useCallback, useEffect } from 'react'
import { INITIAL_ARRETS } from '../data/arrets'
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
  // N2 (Alerte / Arbre De Causes) :
  // - cumul ≥ seuils.n2.cumul  OU  fréquence ≥ seuils.n2.frequence
  if (cumul >= seuils.n2.cumul)      return 'alert'
  if (frequence >= seuils.n2.frequence) return 'alert'   // ← AJOUT : fréquence N2 déclenche alerte

  // N1 (Surveillance / Quick Kaizen) :
  // - cumul ≥ seuils.n1.cumul  OU  fréquence ≥ seuils.n1.frequence
  if (cumul >= seuils.n1.cumul)         return 'watch'
  if (frequence >= seuils.n1.frequence) return 'watch'   // ← CORRECTION : >= au lieu de >

  return 'normal'
}

// ─── Méthode imposée selon le statut ────────────────────────────────────────
// Retourne la méthode RCA à imposer en fonction du statut TUM
// 'alert' → Arbre De Causes (5why) obligatoire
// 'watch' → Quick Kaizen imposé
// 'normal' → null (pas d'analyse imposée)

export function getMethode(statut) {
  if (statut === 'alert') return '5why'
  if (statut === 'watch') return 'kaizen'
  return null
}

export function getPourcentage(cumul, seuilCumul) {
  return Math.min(100, (cumul / seuilCumul) * 100)
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export default function useTUM() {
  // Arrêts — persistés en localStorage
  const [arrets, setArrets] = useState(() => {
    if (typeof window === 'undefined') return INITIAL_ARRETS
    try {
      const stored = window.localStorage.getItem('jesa_arrets')
      return stored ? JSON.parse(stored) : INITIAL_ARRETS
    } catch {
      return INITIAL_ARRETS
    }
  })

  // Seuils — persistés en localStorage
  const [seuils, setSeuils] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_SEUILS
    try {
      const stored = window.localStorage.getItem('jesa_seuils')
      return stored ? JSON.parse(stored) : DEFAULT_SEUILS
    } catch {
      return DEFAULT_SEUILS
    }
  })

  // Liste des équipements — persistée en localStorage
  const [equipmentList, setEquipmentList] = useState(() => {
    if (typeof window === 'undefined') return INITIAL_EQUIPMENT_LIST
    try {
      const stored = window.localStorage.getItem('jesa_equipment_list')
      return stored ? JSON.parse(stored) : INITIAL_EQUIPMENT_LIST
    } catch {
      return INITIAL_EQUIPMENT_LIST
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('jesa_arrets', JSON.stringify(arrets))
  }, [arrets])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('jesa_seuils', JSON.stringify(seuils))
  }, [seuils])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('jesa_equipment_list', JSON.stringify(equipmentList))
  }, [equipmentList])

  // Référentiel équipements / validation import
  const knownEquipIds = equipmentList.map(e => e.id)

  // Équipements uniques détectés dans les arrêts
  const equipIds = [...new Set(arrets.map(a => a.equipId))]

  // Équipements en alerte N2 OU sous surveillance N1
  const alertEquips = equipIds.filter(id => {
    const cumulN2 = calcCumul(arrets, id, seuils.n2.horizon)
    const freqN2  = calcFrequence(arrets, id, seuils.n2.horizon)
    if (getStatut(cumulN2, freqN2, seuils) === 'alert') return true
    const cumulN1 = calcCumul(arrets, id, seuils.n1.horizon)
    const freqN1  = calcFrequence(arrets, id, seuils.n1.horizon)
    return getStatut(cumulN1, freqN1, seuils) === 'watch'
  })

  // Ajouter des arrêts (import Excel ou saisie manuelle)
  const ajouterArrets = useCallback((nouveaux) => {
    setArrets(prev => [...prev, ...nouveaux])
  }, [])

  const supprimerArret = useCallback((id) => {
    setArrets(prev => prev.filter(a => a.id !== id))
  }, [])

  const sauvegarderSeuils = useCallback((nouveauxSeuils) => {
    setSeuils(nouveauxSeuils)
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
    ajouterArrets,
    supprimerArret,
    sauvegarderSeuils,
    updateEquipmentList,
  }
}
