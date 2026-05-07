// src/hooks/useRCA.js
// À compléter lors du développement du module RCA (Session 2)

import { useState } from 'react'
import { RCA_LIST } from '../data/rcaDB'

export default function useRCA() {
  const [rcaList, setRcaList] = useState(RCA_LIST)
  const [selectedEquip, setSelectedEquip] = useState(null)

  return {
    rcaList,
    setRcaList,
    selectedEquip,
    setSelectedEquip,
  }
}
