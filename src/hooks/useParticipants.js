// src/hooks/useParticipants.js
import { useState, useEffect } from 'react'
import { api } from '../lib/api'

function normalize(list) {
  return list.map(p => ({ id: String(p.id), nom: p.nom, fonction: p.fonction || '' }))
}

export default function useParticipants() {
  const [participants, setParticipants] = useState([])

  useEffect(() => {
    api.getParticipants()
      .then(list => setParticipants(normalize(list)))
      .catch(() => {})
  }, [])

  return participants
}

export { normalize }
