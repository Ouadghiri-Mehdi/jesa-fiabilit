// Seuils TUM par défaut
// Modifiables via le panel ⚙️ dans TUMPage

export const DEFAULT_SEUILS = {
  n1: {
    cumul:     2,   // heures cumulées → seuil surveillance (Quick Kaizen)
    frequence: 2,   // nombre d'arrêts → seuil surveillance
    horizon:   30,  // jours d'observation
  },
  n2: {
    cumul:     4,   // heures cumulées → seuil alerte (5 Why)
    frequence: 3,   // nombre d'arrêts → seuil alerte
    horizon:   90,  // jours d'observation
  }
}