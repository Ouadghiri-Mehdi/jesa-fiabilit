// src/components/tum/TUMPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import C from '../../tokens/colors'
import useTUM, { calcCumul, calcFrequence, getStatut } from '../../hooks/useTUM'
import useNotifs from '../../hooks/useNotifs'
import AlertBanner from '../shared/AlertBanner'
import Notif from '../shared/Notif'
import ImportExcel from './ImportExcel'
import SaisieManuelle from './SaisieManuelle'
import BadActors from './BadActors'
import SeuilsModal from './SeuilsModal'
import { INITIAL_SESSIONS } from '../../data/rcaSessions'

// ─── Synchronise les équipements en alerte vers les sessions RCA ─────────────
function syncAlertsToRCA(updatedArrets, nouveauxArrets, seuils) {
  let sessions = []
  try {
    const stored = localStorage.getItem('jesa_rca_sessions')
    sessions = stored ? JSON.parse(stored) : [...INITIAL_SESSIONS]
  } catch {
    sessions = [...INITIAL_SESSIONS]
  }

  const affectedIds = [...new Set(nouveauxArrets.map(a => a.equipId))]
  let changed = false

  affectedIds.forEach(equipId => {
    const trigger = nouveauxArrets.find(a => a.equipId === equipId)
      || updatedArrets.filter(a => a.equipId === equipId).slice(-1)[0]

    // Session active déjà existante → mettre à jour causeArret si manquant
    const existingIdx = sessions.findIndex(s => s.equipId === equipId && s.statut !== 'cloturee')
    if (existingIdx !== -1) {
      if (!sessions[existingIdx].causeArret && trigger?.cause) {
        sessions[existingIdx] = { ...sessions[existingIdx], causeArret: trigger.cause }
        changed = true
      }
      return
    }

    // Vérifier si les seuils sont dépassés pour créer une nouvelle session
    const cumulN2 = calcCumul(updatedArrets, equipId, seuils.n2.horizon)
    const freqN2  = calcFrequence(updatedArrets, equipId, seuils.n2.horizon)
    const isAlert = getStatut(cumulN2, freqN2, seuils) === 'alert'

    const cumulN1 = calcCumul(updatedArrets, equipId, seuils.n1.horizon)
    const freqN1  = calcFrequence(updatedArrets, equipId, seuils.n1.horizon)
    const isWatch = getStatut(cumulN1, freqN1, seuils) === 'watch'

    if (!isAlert && !isWatch) return

    const niveau = isAlert ? 2 : 1
    const today = new Date().toISOString().slice(0, 10)
    const id = `RCA-${today.replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`

    sessions.push({
      id,
      equipId,
      zone: trigger?.zone || '',
      dateOuverture: today,
      niveau,
      source: 'TUM',
      type: 'equipement',
      responsable: '',
      cumulArret: isAlert ? cumulN2 : cumulN1,
      frequence: isAlert ? freqN2 : freqN1,
      tauxPanne: 0,
      disponibilite: 100,
      participants: [],
      statut: 'non-commencee',
      methode: niveau === 2 ? '5why' : 'kaizen',
      phenomene: trigger?.description || trigger?.cause || '',
      causeArret: trigger?.cause || '',
      noeuds: [],
      actionsGenerees: [],
    })
    changed = true
  })

  if (changed) {
    localStorage.setItem('jesa_rca_sessions', JSON.stringify(sessions))
  }
}

export default function TUMPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { notifs, showNotif, dismissNotif } = useNotifs()
  const {
    arrets, seuils, alertEquips,
    equipmentList, knownEquipIds, updateEquipmentList,
    ajouterArrets, sauvegarderSeuils,
  } = useTUM()

  const [activeView, setActiveView] = useState('data')
  const [showSaisieInline, setShowSaisieInline] = useState(false)
  const [showSeuils, setShowSeuils] = useState(false)

  // État pour la vue dans Bad Actors
  const [badActorsViewMode, setBadActorsViewMode] = useState('pareto')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('modal') === 'saisie') {
      setActiveView('data')
      setShowSaisieInline(true)
    } else if (params.get('modal') === 'seuils') {
      setShowSeuils(true)
    } else if (params.get('view') === 'analysis') {
      setActiveView('analysis')
    }
  }, [location.search])

  const handleCloseSeuils = () => {
    setShowSeuils(false)
    navigate('/tum', { replace: true })
  }

  const handleImport = (nouveaux) => {
    const updatedArrets = [...arrets, ...nouveaux]
    ajouterArrets(nouveaux)
    syncAlertsToRCA(updatedArrets, nouveaux, seuils)
    showNotif('✅ Import réussi', `${nouveaux.length} arrêt(s) importé(s) dans le TUM`, 'green')
  }

  const handleSaisie = (arret) => {
    const updatedArrets = [...arrets, arret]
    ajouterArrets([arret])
    syncAlertsToRCA(updatedArrets, [arret], seuils)
    showNotif('✅ Arrêt enregistré', `${arret.equipId} · ${arret.duration}h archivé`, 'blue')
    setShowSaisieInline(false)
  }

  const handleSeuils = (nouveauxSeuils) => {
    sauvegarderSeuils(nouveauxSeuils)
    showNotif('✅ Seuils sauvegardés', 'Actifs pour le prochain calcul TUM', 'blue')
    handleCloseSeuils()
  }

  const handleLancerRCA = (equipId, niveau = 2) => {
    navigate(`/rca/${equipId}?niveau=${niveau}`)
  }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <Notif notifs={notifs} dismiss={dismissNotif} />

      {showSeuils && (
        <SeuilsModal
          seuils={seuils}
          onClose={handleCloseSeuils}
          onSave={handleSeuils}
          showNotif={showNotif}
          onUpdateEquipmentList={updateEquipmentList}
        />
      )}

      {/* ── Navigation ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, background: '#fff', padding: 4, borderRadius: 8, border: `1px solid ${C.border2}` }}>
          <button
            onClick={() => setActiveView('data')}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              background: activeView === 'data' ? C.bluePale : 'transparent',
              color: activeView === 'data' ? C.navy : C.text3,
              transition: 'all .2s'
            }}
          >
            Data TUM
          </button>
          <button
            onClick={() => setActiveView('analysis')}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              background: activeView === 'analysis' ? C.bluePale : 'transparent',
              color: activeView === 'analysis' ? C.navy : C.text3,
              transition: 'all .2s'
            }}
          >
            Bad Actors
          </button>
        </div>
      </div>

      {/* ── Vue 1 : Data TUM ── */}
      {activeView === 'data' && (
        <div style={{ animation: 'fadeUp .2s ease' }}>
          {alertEquips.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <AlertBanner
                type="red"
                title={`${alertEquips.length} équipement(s) dépassent les seuils — Analyses RCA obligatoires`}
                sub={`Cliquez sur "Voir RCA" pour démarrer les analyses`}
                actionLabel="Voir RCA →"
                onAction={() => navigate('/rca')}
              />
            </div>
          )}

          <ImportExcel
            onImport={handleImport}
            showNotif={showNotif}
          />

          {!showSaisieInline && (
            <div style={{ marginTop: 4, marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={() => setShowSaisieInline(true)}
                style={{
                  background: '#f1f5f9',
                  border: `1.5px solid ${C.border2}`,
                  borderRadius: 999,
                  padding: '12px 36px',
                  color: C.text2,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all .2s',
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = C.navy
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.borderColor = C.navy
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#f1f5f9'
                  e.currentTarget.style.color = C.text2
                  e.currentTarget.style.borderColor = C.border2
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: C.navy, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 400, lineHeight: 1, flexShrink: 0,
                }}>+</span>
                Saisie manuelle
              </button>
            </div>
          )}

          {showSaisieInline && (
            <SaisieManuelle
              inline={true}
              onClose={() => setShowSaisieInline(false)}
              onSave={handleSaisie}
              seuils={seuils}
              arretsExistants={arrets}
            />
          )}
        </div>
      )}

      {/* ── Vue 2 : Bad Actors ── */}
      {activeView === 'analysis' && (
        <div style={{ animation: 'fadeUp .2s ease' }}>
          <BadActors
            arrets={arrets}
            seuils={seuils}
            onLancerRCA={handleLancerRCA}
            viewMode={badActorsViewMode}
            onViewModeChange={setBadActorsViewMode}
          />
        </div>
      )}
    </div>
  )
}
