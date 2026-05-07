// src/components/rca/GestionParticipantsModal.jsx
// Modal de gestion des participants (import Excel, liste, suppression)

import { useState, useRef, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import C from '../../tokens/colors'
import Modal from '../shared/Modal'
import Button from '../shared/Button'
import { getParticipants, saveParticipants, DEFAULT_PARTICIPANTS } from '../../data/participants'

// ── Charger SheetJS dynamiquement depuis CDN
function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) { resolve(window.XLSX); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    script.onload = () => resolve(window.XLSX)
    script.onerror = () => reject(new Error('Impossible de charger SheetJS'))
    document.head.appendChild(script)
  })
}

export default function GestionParticipantsModal({ onClose, showNotif }) {
  const [participants, setParticipants] = useState(() => getParticipants())
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    loadSheetJS().catch(() => {})
  }, [])

  // ── Réinitialiser à la liste par défaut
  const handleReset = () => {
    setParticipants(DEFAULT_PARTICIPANTS)
    saveParticipants(DEFAULT_PARTICIPANTS)
    showNotif('✅ Liste réinitialisée', `Liste par défaut (${DEFAULT_PARTICIPANTS.length} participants)`, 'green')
  }

  // ── Supprimer un participant
  const handleDelete = (id) => {
    const updated = participants.filter(p => p.id !== id)
    setParticipants(updated)
    saveParticipants(updated)
    showNotif('✅ Participant supprimé', '', 'green')
  }

  // ── Traiter le fichier Excel importé
  const handleFile = useCallback(async (file) => {
    if (!file) return
    setLoading(true)

    const ext = file.name.split('.').pop().toLowerCase()

    try {
      if (ext === 'xlsx' || ext === 'xls') {
        let XLSXLib
        try {
          XLSXLib = await loadSheetJS()
        } catch {
          showNotif('❌ SheetJS indisponible', 'Vérifiez votre connexion internet', 'red')
          setLoading(false)
          return
        }

        const buf = await file.arrayBuffer()
        const wb = XLSXLib.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSXLib.utils.sheet_to_json(ws, { defval: '', header: 1 })

        if (!data || data.length < 2) {
          showNotif('❌ Fichier vide', 'Le fichier Excel ne contient pas de données', 'red')
          setLoading(false)
          return
        }

        const headers = data[0].map(cell => String(cell || '').trim())
        
        // Détecter les colonnes (Nom du participant / Fonction)
        const nomKey = headers.find(h => 
          h.toLowerCase().includes('nom') || 
          h.toLowerCase().includes('participant') ||
          h.toLowerCase() === 'nom du participant'
        )
        const fonctionKey = headers.find(h => 
          h.toLowerCase().includes('fonction') || 
          h.toLowerCase().includes('role') ||
          h.toLowerCase() === 'fonction'
        )

        if (!nomKey) {
          showNotif('❌ Colonne "Nom" introuvable', 'Vérifiez que votre fichier contient une colonne "Nom du participant"', 'red')
          setLoading(false)
          return
        }

        const rows = data.slice(1)
          .filter(row => row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''))
          .map((row, idx) => ({
            id: `p-${Date.now()}-${idx}`,
            nom: nomKey ? String(row[headers.indexOf(nomKey)] || '').trim() : '',
            fonction: fonctionKey ? String(row[headers.indexOf(fonctionKey)] || '').trim() : '',
          }))
          .filter(p => p.nom)

        if (rows.length === 0) {
          showNotif('❌ Aucun participant détecté', 'Le fichier ne contient aucun nom valide', 'red')
          setLoading(false)
          return
        }

        setPreview({ rows, fileName: file.name })
        showNotif('✅ Fichier chargé', `${rows.length} participant(s) détecté(s)`, 'green')
      } else {
        showNotif('❌ Format non supporté', 'Utilisez un fichier .xlsx ou .xls', 'red')
      }
    } catch (err) {
      console.error('Erreur lecture fichier:', err)
      showNotif('❌ Erreur', 'Impossible de lire le fichier', 'red')
    } finally {
      setLoading(false)
    }
  }, [showNotif])

  // ── Importer les participants (remplacement)
  const handleImport = () => {
    if (!preview) return

    const newParticipants = preview.rows.map((p, idx) => ({
      id: `p-${Date.now()}-${idx}`,
      nom: p.nom,
      fonction: p.fonction || '',
    }))

    setParticipants(newParticipants)
    saveParticipants(newParticipants)
    showNotif('✅ Liste mise à jour', `${newParticipants.length} participant(s) importé(s)`, 'green')
    setPreview(null)
  }

  // ── Télécharger le modèle Excel
  const downloadTemplate = () => {
    const template = [
      ['Nom du participant', 'Fonction'],
      ['Personne 1', 'Ingénieure Fiabilité'],
      ['Personne 2', 'Chef de Production'],
      ['Personne 3', 'Technicienne Maintenance'],
      ['Personne 4', 'Planificateur Maintenance'],
      ['Personne 5', 'Analyste Process'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Participants')
    XLSX.writeFile(wb, 'modele_participants.xlsx')
  }

  return (
    <Modal title="⚙️ Gestion des participants" onClose={onClose} width={600}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Description */}
        <div style={{
          background: C.bluePale,
          border: `1px solid ${C.blueMid}`,
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 12.5,
          color: C.text2,
        }}>
          ℹ️ Importez un fichier Excel pour mettre à jour la liste des participants.
          Ces participants seront disponibles dans le dropdown de la section "Réunions fiabilistes".
        </div>

        {/* Zone d'import */}
        <div
          onClick={() => !loading && fileRef.current.click()}
          style={{
            border: `2px dashed ${C.border2}`,
            borderRadius: 8,
            padding: '22px 16px',
            textAlign: 'center',
            cursor: loading ? 'wait' : 'pointer',
            background: C.bg,
            transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.background = C.bluePale }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.background = C.bg }}
        >
          <div style={{ fontSize: 24, marginBottom: 6 }}>📊</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>
            {loading ? 'Lecture en cours...' : 'Cliquer pour importer la liste des participants'}
          </div>
          <div style={{ fontSize: 11.5, color: C.text4, marginTop: 3 }}>
            Fichier Excel .xlsx, .xls avec colonnes "Nom du participant" et "Fonction"
          </div>
          <input
            ref={fileRef}
            type="file"
            style={{ display: 'none' }}
            accept=".xlsx,.xls"
            onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
          />
        </div>

        {/* Aperçu des participants importés */}
        {preview && (
          <div style={{ animation: 'fadeUp .2s ease' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 8 }}>
              ✅ {preview.rows.length} participant(s) détecté(s) — {preview.fileName}
            </div>
            <div style={{ overflow: 'auto', maxHeight: 150, border: `1px solid ${C.border}`, borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.navy }}>
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#fff', width: 40 }}>#</th>
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#fff' }}>Nom du participant</th>
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#fff' }}>Fonction</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 10).map((p, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                      <td style={{ padding: '7px 12px', color: C.text2 }}>{i+1}</td>
                      <td style={{ padding: '7px 12px', color: C.text2 }}>{p.nom}</td>
                      <td style={{ padding: '7px 12px', color: C.text2 }}>{p.fonction || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Liste actuelle des participants */}
        {!preview && participants.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 8 }}>
              📋 Liste actuelle ({participants.length} participants)
            </div>
            <div style={{ overflow: 'auto', maxHeight: 200, border: `1px solid ${C.border}`, borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.navy }}>
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#fff', width: 40 }}>#</th>
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#fff' }}>Nom du participant</th>
                    <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#fff' }}>Fonction</th>
                    <th style={{ padding: '6px 12px', textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: '#fff', width: 50 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                      <td style={{ padding: '7px 12px', color: C.text2 }}>{i+1}</td>
                      <td style={{ padding: '7px 12px', color: C.text2 }}>{p.nom}</td>
                      <td style={{ padding: '7px 12px', color: C.text2 }}>{p.fonction || '—'}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDelete(p.id)}
                          style={{
                            background: 'none',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            padding: '3px 8px',
                            cursor: 'pointer',
                            fontSize: 12,
                            color: '#94a3b8',
                            transition: 'all .15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#94a3b8' }}
                        >
                          🗑
                        </button>
                       </td>
                     </tr>
                  ))}
                </tbody>
               </table>
            </div>
          </div>
        )}

        {/* Boutons d'action */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
          <Button variant="ghost" onClick={downloadTemplate}>📥 Télécharger modèle</Button>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="ghost" onClick={handleReset}>↺ Réinitialiser</Button>
            <Button variant="ghost" onClick={onClose}>Fermer</Button>
            {preview && (
              <Button variant="navy" onClick={handleImport}>
                ✅ Importer la liste
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}