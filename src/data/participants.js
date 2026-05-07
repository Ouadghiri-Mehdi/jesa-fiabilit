// src/data/participants.js
// Catalogue des participants (importable et modifiable via l'engrenage dans RCAPage)

export const DEFAULT_PARTICIPANTS = [
  { id: 'p1', nom: 'Personne 1', fonction: 'Ingénieure Fiabilité' },
  { id: 'p2', nom: 'Personne 2', fonction: 'Chef de Production' },
  { id: 'p3', nom: 'Personne 3', fonction: 'Technicienne Maintenance' },
  { id: 'p4', nom: 'Personne 4', fonction: 'Planificateur Maintenance' },
  { id: 'p5', nom: 'Personne 5', fonction: 'Analyste Process' },
]

// Fonction pour charger les participants depuis localStorage
export function getParticipants() {
  if (typeof window === 'undefined') return DEFAULT_PARTICIPANTS
  try {
    const stored = localStorage.getItem('jesa_participants_list')
    return stored ? JSON.parse(stored) : DEFAULT_PARTICIPANTS
  } catch {
    return DEFAULT_PARTICIPANTS
  }
}

// Fonction pour sauvegarder les participants dans localStorage
export function saveParticipants(participants) {
  if (typeof window === 'undefined') return
  localStorage.setItem('jesa_participants_list', JSON.stringify(participants))
}

// Fonction pour trouver un participant par son nom
export function findParticipantByName(nom) {
  const participants = getParticipants()
  return participants.find(p => p.nom.toLowerCase() === nom.toLowerCase()) || null
}