// Seuils TUM par défaut
// Modifiables via le panel ⚙️ dans TUMPage

export const DEFAULT_SEUILS = {
  n1: {
    cumul:     8,   // heures cumulées → seuil surveillance (Quick Kaizen)
    frequence: 3,   // nombre d'arrêts → seuil surveillance
    horizon:   30,  // jours d'observation
  },
  n2: {
    cumul:     24,  // heures cumulées → seuil alerte (5 Why)
    frequence: 5,   // nombre d'arrêts → seuil alerte
    horizon:   90,  // jours d'observation
  }
}