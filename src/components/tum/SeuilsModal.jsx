// src/components/tum/SeuilsModal.jsx
// Onglet 1 : Modifier les seuils (N1 Surveillance / N2 Arbre De Causes)
// Onglet 2 : Mise à jour équipements — supporte CSV (;,) Latin-1/UTF-8, XLSX (SheetJS CDN)
// Onglet 3 : Gestion des causes d'arrêt

import { useState, useRef, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import C from '../../tokens/colors'
import Modal from '../shared/Modal'
import Button from '../shared/Button'
import { api } from '../../lib/api'

const inputStyle = {
  width: '100%',
  padding: '9px 13px',
  background: '#fff',
  border: `1.5px solid ${C.border2}`,
  borderRadius: 8,
  color: C.text,
  fontSize: 13,
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 600,
  color: C.text3,
  marginBottom: 6,
}

// ── Valeurs par défaut des seuils (N1 et N2)
const DEFAULT_SEUILS_VALUES = {
  n1: { cumul: 2, frequence: 2, horizon: 30 },
  n2: { cumul: 4, frequence: 3, horizon: 90 },
}

// ── Liste par défaut des causes d'arrêt
const CAUSES_ARRET_DEFAUT = [
  'fixation supportage pompe à bouillie AP02',
  'Débouchage de la rampe',
  'Arrêt de la tour - changement compensateur ref BP02',
  'Prise d\'air - isolement par joints pleins',
  'Arrêt de la tour - changement compensateur ref BP03',
  'Arrêt de la tour - changement compensateur ref BP04',
  'Soudage buses détachées de la rampe',
  'Lavage toiles et changement capillaire',
  'Défaut eau de bourrage pompe de la tour',
  'Défaut eau de bourrage pompe ACP 28%',
  'Arrêt de la tour - déclenchement 425EBP01',
  'Arrêt de la tour - défaut débistat BP01',
  'Travaux d\'entretien - tamponnage et séchage',
  'Travaux d\'entretien - fuite vanne à bouillie HV169',
  'Titres bas d\'acide 28% - qualité nouveau floculant',
  'Arrêt échelon K - saturation de stock',
  'Changement pompe de production 404KAP05',
  'Coupure électrique',
]

// Modèle équipements embarqué (à remplir par toi-même)
const XLSX_EQUIP_TEMPLATE_B64 = ''

// ── Charger SheetJS dynamiquement depuis CDN
function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) {
      resolve(window.XLSX)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    script.onload = () => resolve(window.XLSX)
    script.onerror = () => reject(new Error('Impossible de charger SheetJS'))
    document.head.appendChild(script)
  })
}

// ── Décodeur robuste : essaie UTF-8 puis Latin-1 (cp1252)
async function readFileAsText(file) {
  try {
    const text = await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = (e) => resolve(e.target.result)
      r.onerror = reject
      r.readAsText(file, 'UTF-8')
    })
    if (!text.includes('\uFFFD')) return text
  } catch {
    // Fallback Latin-1
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = (e) => resolve(e.target.result)
    r.onerror = reject
    r.readAsText(file, 'ISO-8859-1')
  })
}

// ── Parse CSV avec détection automatique séparateur ; ou ,
function parseCSVRobust(text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return { headers: [], data: [] }
  const firstLine = lines[0]
  const sep = firstLine.split(';').length >= firstLine.split(',').length ? ';' : ','
  const headers = firstLine.split(sep).map((s) => s.trim().replace(/^"|"$/g, ''))
  const data = lines.slice(1).map((line) => {
    const cols = line.split(sep).map((s) => s.trim().replace(/^"|"$/g, ''))
    const obj = {}
    headers.forEach((h, i) => {
      obj[h] = cols[i] ?? ''
    })
    return obj
  }).filter((row) => Object.values(row).some(Boolean))
  return { headers, data }
}

// ── Column validation config per tab ──
// Validation STRICTE : TOUTES les colonnes sont obligatoires
const COLUMN_RULES = {
  equip: {
    tabLabel: 'Équipements',
    required: [
      { label: 'Poste technique',                 keywords: ['poste technique'] },
      { label: 'Désignation du poste technique',  keywords: ['désignation du poste technique', 'designation du poste technique'] },
      { label: 'Niveau',                          keywords: ['niveau', 'niveay'] },
      { label: 'EQ/SEQ',                          keywords: ['eq/seq', 'eqseq'] },
    ],
    optional: [],
  },
  causes: {
    tabLabel: "Causes d'arrêt",
    required: [
      { label: "Cause d'arrêt", keywords: ["cause d'arrêt", "cause d'arret", "cause d arret", "cause arret"] },
    ],
    optional: [],
  },
  participants: {
    tabLabel: 'Participants',
    required: [
      { label: 'Nom du participant', keywords: ['nom du participant', 'nom'] },
      { label: 'Fonction',           keywords: ['fonction', 'role'] },
    ],
    optional: [],
  },
}

// Validation stricte : le header doit être EXACTEMENT l'un des keywords (après lowercase+trim)
function validateColumns(headers, rules) {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim())
  const missing = []
  const found = []

  for (const col of rules.required) {
    const match = col.keywords.some(k => lowerHeaders.includes(k.toLowerCase()))
    if (match) found.push(col.label)
    else missing.push(col.label)
  }

  return { missing, found, isValid: missing.length === 0 }
}

export default function SeuilsModal({ seuils, onClose, onSave, showNotif, onUpdateEquipmentList, onUpdateCausesList }) {
  const [activeTab, setActiveTab] = useState('seuils')
  const [confirmModal, setConfirmModal] = useState(null) // { action, label, count }
  const [columnErrorModal, setColumnErrorModal] = useState(null) // { tab, missing, found, headers }

  const [localSeuils, setLocalSeuils] = useState({
    n1: { ...(seuils?.n1 || DEFAULT_SEUILS_VALUES.n1) },
    n2: { ...(seuils?.n2 || DEFAULT_SEUILS_VALUES.n2) },
  })

  const [isEditing, setIsEditing] = useState(false)
  const [equipPreview, setEquipPreview] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const [causesList, setCausesList] = useState(CAUSES_ARRET_DEFAUT)
  const [causesPreview, setCausesPreview] = useState([])
  const [causesFileName, setCausesFileName] = useState('')
  const [isLoadingCauses, setIsLoadingCauses] = useState(false)
  const fileCausesRef = useRef()

  // ── Participants state ──
  const [participants, setParticipants] = useState([])
  const [participantsPreview, setParticipantsPreview] = useState(null)
  const [participantsFileName, setParticipantsFileName] = useState('')
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false)
  const fileParticipantsRef = useRef()

  // ── Chargement depuis l'API au montage ──
  useEffect(() => {
    loadSheetJS().catch(() => {})
    api.getCausesConfig()
      .then(rows => { if (rows.length) setCausesList(rows.map(r => r.libelle)) })
      .catch(() => {})
    api.getParticipants()
      .then(rows => setParticipants(rows.map(p => ({ id: String(p.id), nom: p.nom, fonction: p.fonction || '' }))))
      .catch(() => {})
  }, [])


  const findKey = (headers, keywords) =>
    headers.find((h) => keywords.some((k) => h.toLowerCase().includes(k.toLowerCase())))

  const handleSaveSeuils = () => {
    onSave(localSeuils)
  }

  const handleResetSeuils = () => {
    setLocalSeuils({
      n1: { ...DEFAULT_SEUILS_VALUES.n1 },
      n2: { ...DEFAULT_SEUILS_VALUES.n2 },
    })
  }

  const handleEquipFile = useCallback(
    async (file) => {
      if (!file) return
      const ext = file.name.split('.').pop().toLowerCase()
      setLoading(true)

      try {
        if (ext === 'csv' || ext === 'tsv') {
          const text = await readFileAsText(file)
          const { headers, data } = parseCSVRobust(text)
          if (!headers.length || !data.length) {
            showNotif('❌ Fichier vide', 'Le fichier CSV ne contient pas de données', 'red')
            return
          }
          const validation = validateColumns(headers, COLUMN_RULES.equip)
          if (!validation.isValid) {
            setColumnErrorModal({ tab: 'equip', missing: validation.missing, found: validation.found, headers })
            return
          }
          setEquipPreview({ headers, rows: data, fileName: file.name })
          showNotif('✅ Fichier lu', `${data.length} ligne(s) détectée(s)`, 'green')
        } else if (ext === 'xlsx') {
          let XLSXLib
          try {
            XLSXLib = await loadSheetJS()
          } catch {
            showNotif('❌ SheetJS indisponible', 'Vérifiez votre connexion internet', 'red')
            return
          }
          const buf = await file.arrayBuffer()
          const wb = XLSXLib.read(buf, { type: 'array', cellDates: true })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const raw = XLSXLib.utils.sheet_to_json(ws, { defval: '', header: 1 })
          if (raw.length < 2) {
            showNotif('❌ Fichier vide', 'Aucune donnée', 'red')
            return
          }
          const headers = raw[0].map((h) => String(h).trim()).filter(Boolean)
          const validation = validateColumns(headers, COLUMN_RULES.equip)
          if (!validation.isValid) {
            setColumnErrorModal({ tab: 'equip', missing: validation.missing, found: validation.found, headers })
            return
          }
          const data = raw
            .slice(1)
            .map((row) => {
              const obj = {}
              headers.forEach((h, i) => {
                const val = row[i]
                obj[h] = val instanceof Date ? val.toISOString() : val !== undefined && val !== null ? String(val) : ''
              })
              return obj
            })
            .filter((row) => Object.values(row).some((v) => v !== ''))
          setEquipPreview({ headers, rows: data, fileName: file.name })
          showNotif('✅ Fichier lu', `${data.length} équipement(s) détecté(s)`, 'green')
        } else {
          showNotif('❌ Format non supporté', `Le format .${ext} n'est pas pris en charge`, 'red')
        }
      } catch (err) {
        showNotif('❌ Erreur de lecture', `Impossible de lire le fichier : ${err.message}`, 'red')
      } finally {
        setLoading(false)
      }
    },
    [showNotif]
  )

  const handleImportEquip = () => {
    if (!equipPreview) return
    const { headers, rows } = equipPreview
    const posteKey       = findKey(headers, ['poste technique', 'poste', 'equipement', 'code'])
    const designationKey = findKey(headers, ['désignation du poste technique', 'désignation', 'designation', 'libelle', 'libellé'])
    const niveauKey      = findKey(headers, ['niveay', 'niveau', 'level'])
    const eqSeqKey       = findKey(headers, ['eq/seq', 'eqseq', 'eq seq', 'seq'])

    const newList = rows
      .map((row) => ({
        id:          posteKey       ? String(row[posteKey]       || '').trim() : '',
        designation: designationKey ? String(row[designationKey] || '').trim() : '',
        niveau:      niveauKey      ? parseInt(row[niveauKey])  || 0           : 0,
        eqSeq:       eqSeqKey       ? String(row[eqSeqKey]       || '').trim() : '',
      }))
      .filter((e) => e.id)

    if (!newList.length) {
      showNotif('❌ Aucun poste', 'Vérifiez la colonne "Poste technique"', 'red')
      return
    }
    api.bulkEquipements(newList.map(e => ({
      id:          e.id,
      designation: e.designation,
      entite:      e.niveau  ? String(e.niveau) : null,   // Niveau → entite
      famille:     e.eqSeq   || null,                     // EQ/SEQ → famille
    })))
      .then(res => {
        showNotif('✅ Liste mise à jour', `${Array.isArray(res) ? res.length : newList.length} équipement(s) enregistré(s)`, 'green')
        if (onUpdateEquipmentList) onUpdateEquipmentList()
      })
      .catch(err => showNotif('❌ Erreur', err.message, 'red'))
    setEquipPreview(null)
  }

  const handleConfirm = () => {
    if (!confirmModal) return
    if (confirmModal.action === 'equip') handleImportEquip()
    else if (confirmModal.action === 'causes') {
      importCausesList()
    }
    else if (confirmModal.action === 'participants') handleImportParticipants()
    setConfirmModal(null)
  }

  const downloadEquipTemplate = () => {
    api.getEquipements()
      .then(equips => {
        const rows = [['Poste technique', 'Désignation du poste technique', 'Niveau', 'EQ/SEQ']]
        equips.forEach(e => rows.push([e.id || '', e.designation || '', e.entite || '', e.famille || '']))
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet(rows)
        XLSX.utils.book_append_sheet(wb, ws, 'Postes_Techniques')
        XLSX.writeFile(wb, 'DATA_POSTES_TECHNIQUES.xlsx')
      })
      .catch(() => showNotif('❌ Erreur', 'Impossible de récupérer la liste', 'red'))
  }

  const handleCausesFile = useCallback(
    async (file) => {
      if (!file) return
      setCausesFileName(file.name)
      setIsLoadingCauses(true)

      const ext = file.name.split('.').pop().toLowerCase()

      try {
        if (ext === 'xlsx' || ext === 'xls') {
          let XLSXLib
          try {
            XLSXLib = await loadSheetJS()
          } catch {
            showNotif('❌ SheetJS indisponible', 'Vérifiez votre connexion internet', 'red')
            return
          }
          const buf = await file.arrayBuffer()
          const wb = XLSXLib.read(buf, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = XLSXLib.utils.sheet_to_json(ws, { defval: '', header: 1 })

          if (!data || data.length < 2) {
            showNotif('❌ Fichier vide', 'Le fichier Excel ne contient pas de données', 'red')
            return
          }

          const causesHeaders = data[0].map(cell => String(cell || '').trim())
          const causesValidation = validateColumns(causesHeaders, COLUMN_RULES.causes)
          if (!causesValidation.isValid) {
            setColumnErrorModal({ tab: 'causes', missing: causesValidation.missing, found: causesValidation.found, headers: causesHeaders })
            return
          }

          const causes = data
            .slice(1)
            .map((row) => {
              const val = row[0]
              if (!val) return null
              return String(val).trim()
            })
            .filter((cause) => cause && cause !== '')

          setCausesPreview(causes)
          showNotif('✅ Fichier chargé', `${causes.length} cause(s) détectée(s)`, 'green')
        } else if (ext === 'csv') {
          const text = await readFileAsText(file)
          const rows = text.split(/\r?\n/).filter(Boolean)
          if (rows.length < 2) {
            showNotif('❌ Fichier vide', 'Le fichier CSV ne contient pas de données', 'red')
            return
          }
          const csvCausesHeaders = rows[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''))
          const csvCausesValidation = validateColumns(csvCausesHeaders, COLUMN_RULES.causes)
          if (!csvCausesValidation.isValid) {
            setColumnErrorModal({ tab: 'causes', missing: csvCausesValidation.missing, found: csvCausesValidation.found, headers: csvCausesHeaders })
            return
          }
          const causes = rows
            .slice(1)
            .map((row) => {
              const cols = row.split(',').map((s) => s.trim().replace(/^"|"$/g, ''))
              return cols[0]
            })
            .filter((cause) => cause && cause !== '')
          setCausesPreview(causes)
          showNotif('✅ Fichier chargé', `${causes.length} cause(s) détectée(s)`, 'green')
        } else {
          showNotif('❌ Format non supporté', 'Utilisez un fichier .xlsx, .xls ou .csv', 'red')
        }
      } catch (error) {
        console.error('Erreur lecture fichier:', error)
        showNotif('❌ Erreur', 'Impossible de lire le fichier', 'red')
      } finally {
        setIsLoadingCauses(false)
      }
    },
    [showNotif]
  )

  const importCausesList = () => {
    if (causesPreview.length === 0) return
    api.bulkCauses(causesPreview)
      .then(() => {
        setCausesList(causesPreview)
        if (onUpdateCausesList) onUpdateCausesList()
        showNotif('✅ Liste des causes mise à jour', `${causesPreview.length} cause(s) enregistrée(s)`, 'green')
        setCausesPreview([])
      })
      .catch(err => showNotif('❌ Erreur', err.message, 'red'))
  }

  const downloadCausesTemplate = () => {
    const rows = [["Cause d'arrêt"]]
    causesList.forEach(c => rows.push([c]))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Causes_Arret')
    XLSX.writeFile(wb, (causesFileName || 'DATA_CAUSES_ARRET').replace(/\.xlsx?$/i, '') + '.xlsx')
  }

  // ── Participants handlers ──
  const handleParticipantsFile = useCallback(async (file) => {
    if (!file) return
    setParticipantsFileName(file.name)
    setIsLoadingParticipants(true)
    const ext = file.name.split('.').pop().toLowerCase()
    try {
      if (ext === 'xlsx' || ext === 'xls') {
        let XLSXLib
        try { XLSXLib = await loadSheetJS() } catch {
          showNotif('❌ SheetJS indisponible', 'Vérifiez votre connexion internet', 'red')
          return
        }
        const buf = await file.arrayBuffer()
        const wb = XLSXLib.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSXLib.utils.sheet_to_json(ws, { defval: '', header: 1 })
        if (!data || data.length < 2) { showNotif('❌ Fichier vide', 'Le fichier Excel ne contient pas de données', 'red'); return }
        const headers = data[0].map(cell => String(cell || '').trim())
        const participantsValidation = validateColumns(headers, COLUMN_RULES.participants)
        if (!participantsValidation.isValid) {
          setColumnErrorModal({ tab: 'participants', missing: participantsValidation.missing, found: participantsValidation.found, headers })
          return
        }
        const nomKey = headers.find(h => h.toLowerCase().includes('nom') || h.toLowerCase().includes('participant'))
        const fonctionKey = headers.find(h => h.toLowerCase().includes('fonction') || h.toLowerCase().includes('role'))
        if (!nomKey) { showNotif('❌ Colonne "Nom" introuvable', 'Vérifiez la colonne "Nom du participant"', 'red'); return }
        const rows = data.slice(1)
          .filter(row => row.some(cell => String(cell || '').trim() !== ''))
          .map((row, idx) => ({
            id: `p-${Date.now()}-${idx}`,
            nom: String(row[headers.indexOf(nomKey)] || '').trim(),
            fonction: fonctionKey ? String(row[headers.indexOf(fonctionKey)] || '').trim() : '',
          }))
          .filter(p => p.nom)
        if (!rows.length) { showNotif('❌ Aucun participant', 'Fichier sans nom valide', 'red'); return }
        setParticipantsPreview({ rows, fileName: file.name })
        showNotif('✅ Fichier chargé', `${rows.length} participant(s) détecté(s)`, 'green')
      } else {
        showNotif('❌ Format non supporté', 'Utilisez un fichier .xlsx ou .xls', 'red')
      }
    } catch (err) {
      showNotif('❌ Erreur', `Impossible de lire le fichier : ${err.message}`, 'red')
    } finally {
      setIsLoadingParticipants(false)
    }
  }, [showNotif])

  const handleImportParticipants = () => {
    if (!participantsPreview) return
    const newList = participantsPreview.rows.map(p => ({ nom: p.nom, fonction: p.fonction || '' }))
    api.bulkParticipants(newList)
      .then(() => api.getParticipants())
      .then(rows => {
        const mapped = rows.map(p => ({ id: String(p.id), nom: p.nom, fonction: p.fonction || '' }))
        setParticipants(mapped)
        showNotif('✅ Liste mise à jour', `${mapped.length} participant(s) importé(s)`, 'green')
        setParticipantsPreview(null)
      })
      .catch(err => showNotif('❌ Erreur', err.message, 'red'))
  }

  const handleDeleteParticipant = (id) => {
    api.deleteParticipant(id)
      .then(() => {
        const updated = participants.filter(p => p.id !== id)
        setParticipants(updated)
        showNotif('✅ Participant supprimé', '', 'green')
      })
      .catch(err => showNotif('❌ Erreur', err.message, 'red'))
  }

  const downloadParticipantsTemplate = () => {
    const rows = [['Nom du participant', 'Fonction']]
    participants.forEach(p => rows.push([p.nom || '', p.fonction || '']))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Participants')
    XLSX.writeFile(wb, (participantsFileName || 'DATA_PARTICIPANTS').replace(/\.xlsx?$/i, '') + '.xlsx')
  }

  const tabs = [
    {
      key: 'seuils',
      label: 'Modifier les seuils',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      key: 'equip',
      label: 'Équipements',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        </svg>
      ),
    },
    {
      key: 'causes',
      label: "Causes d'arrêt",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4"/>
          <path d="M12 14c-5 0-8 2-8 3v1h16v-1c0-1-3-3-8-3z"/>
          <line x1="15" y1="8" x2="22" y2="8"/>
          <line x1="19" y1="5" x2="19" y2="11"/>
        </svg>
      ),
    },
    {
      key: 'participants',
      label: 'Participants',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
  ]

  return (
    <>
    <Modal title="Paramétrage TUM" onClose={onClose} width={680}>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1.5px solid ${C.border}`,
          marginBottom: 22,
        }}
      >
        {tabs.map((t) => (
          <div
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1,
              padding: '9px 8px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: activeTab === t.key ? C.blue2 : C.text3,
              borderBottom: `2.5px solid ${activeTab === t.key ? C.blue2 : 'transparent'}`,
              marginBottom: -1.5,
              transition: 'all .15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              background: activeTab === t.key ? '#f8faff' : 'transparent',
            }}
          >
            {t.icon}
            {t.label}
          </div>
        ))}
      </div>

      {/* TAB 1 : Seuils (N1 et N2) */}
      {activeTab === 'seuils' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Verrouillage */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isEditing ? C.text : C.text3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {isEditing ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                    </svg>
                    Édition activée
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Verrouillé
                  </>
                )}
              </span>
              <div
                style={{
                  width: 36,
                  height: 20,
                  background: isEditing ? C.green : C.border2,
                  borderRadius: 20,
                  position: 'relative',
                  transition: 'background .2s',
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    background: '#fff',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: 2,
                    left: isEditing ? 18 : 2,
                    transition: 'left .2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,.2)',
                  }}
                />
              </div>
              <input
                type="checkbox"
                style={{ display: 'none' }}
                checked={isEditing}
                onChange={(e) => setIsEditing(e.target.checked)}
              />
            </label>
          </div>

          {/* NIVEAU N1 — QUICK KAIZEN */}
          <div>
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 20,
                padding: '5px 16px',
                marginBottom: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#d97706"><circle cx="12" cy="12" r="10"/></svg>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#d97706', letterSpacing: '.4px' }}>
                N1 — SURVEILLANCE
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Seuil cumul (h)</label>
                <input
                  type="number"
                  style={{
                    ...inputStyle,
                    background: isEditing ? '#fff' : '#f9fafb',
                    color: isEditing ? C.text : C.text3,
                    cursor: isEditing ? 'text' : 'not-allowed',
                  }}
                  value={localSeuils.n1.cumul}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setLocalSeuils((prev) => ({
                      ...prev,
                      n1: { ...prev.n1, cumul: parseFloat(e.target.value) || 0 },
                    }))
                  }
                  min="0"
                  step="0.5"
                />
                <div style={{ fontSize: 10.5, color: C.text4, marginTop: 4 }}>Déclenche Surveillance</div>
              </div>
              <div>
                <label style={labelStyle}>Seuil fréquence (fois)</label>
                <input
                  type="number"
                  style={{
                    ...inputStyle,
                    background: isEditing ? '#fff' : '#f9fafb',
                    color: isEditing ? C.text : C.text3,
                    cursor: isEditing ? 'text' : 'not-allowed',
                  }}
                  value={localSeuils.n1.frequence}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setLocalSeuils((prev) => ({
                      ...prev,
                      n1: { ...prev.n1, frequence: parseInt(e.target.value) || 1 },
                    }))
                  }
                  min="1"
                />
              </div>
              <div>
                <label style={labelStyle}>Horizon (jours)</label>
                <input
                  type="number"
                  style={{
                    ...inputStyle,
                    background: isEditing ? '#fff' : '#f9fafb',
                    color: isEditing ? C.text : C.text3,
                    cursor: isEditing ? 'text' : 'not-allowed',
                  }}
                  value={localSeuils.n1.horizon}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setLocalSeuils((prev) => ({
                      ...prev,
                      n1: { ...prev.n1, horizon: parseInt(e.target.value) || 1 },
                    }))
                  }
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* NIVEAU N2 — 5 WHY */}
          <div>
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 20,
                padding: '5px 16px',
                marginBottom: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#dc2626"><circle cx="12" cy="12" r="10"/></svg>
              <span style={{ fontWeight: 700, fontSize: 12, color: C.red, letterSpacing: '.4px' }}>
                N2 — ARBRE DE CAUSES
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Seuil cumul (h)</label>
                <input
                  type="number"
                  style={{
                    ...inputStyle,
                    background: isEditing ? '#fff' : '#f9fafb',
                    color: isEditing ? C.text : C.text3,
                    cursor: isEditing ? 'text' : 'not-allowed',
                  }}
                  value={localSeuils.n2.cumul}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setLocalSeuils((prev) => ({
                      ...prev,
                      n2: { ...prev.n2, cumul: parseFloat(e.target.value) || 0 },
                    }))
                  }
                  min="0"
                  step="0.5"
                />
                <div style={{ fontSize: 10.5, color: C.text4, marginTop: 4 }}>Déclenche Arbre De Causes</div>
              </div>
              <div>
                <label style={labelStyle}>Seuil fréquence (fois)</label>
                <input
                  type="number"
                  style={{
                    ...inputStyle,
                    background: isEditing ? '#fff' : '#f9fafb',
                    color: isEditing ? C.text : C.text3,
                    cursor: isEditing ? 'text' : 'not-allowed',
                  }}
                  value={localSeuils.n2.frequence}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setLocalSeuils((prev) => ({
                      ...prev,
                      n2: { ...prev.n2, frequence: parseInt(e.target.value) || 1 },
                    }))
                  }
                  min="1"
                />
              </div>
              <div>
                <label style={labelStyle}>Horizon (jours)</label>
                <input
                  type="number"
                  style={{
                    ...inputStyle,
                    background: isEditing ? '#fff' : '#f9fafb',
                    color: isEditing ? C.text : C.text3,
                    cursor: isEditing ? 'text' : 'not-allowed',
                  }}
                  value={localSeuils.n2.horizon}
                  disabled={!isEditing}
                  onChange={(e) =>
                    setLocalSeuils((prev) => ({
                      ...prev,
                      n2: { ...prev.n2, horizon: parseInt(e.target.value) || 1 },
                    }))
                  }
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>

            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="navy" onClick={handleSaveSeuils}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:5,verticalAlign:'middle'}}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Enregistrer les seuils
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2 : Import équipements */}
      {activeTab === 'equip' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: C.bluePale,
              border: `1px solid ${C.blueMid}`,
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 12.5,
              color: C.text2,
            }}
          >
            ℹ️ Importez pour mettre à jour la liste des équipements suivis dans le TUM. Seuls les équipements présents
            dans cette liste seront acceptés lors des imports d'arrêts.
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              handleEquipFile(e.dataTransfer.files[0])
            }}
            onClick={() => !loading && fileRef.current.click()}
            style={{
              border: `2px dashed ${dragging ? C.navy : C.border2}`,
              borderRadius: 8,
              padding: '26px 16px',
              textAlign: 'center',
              cursor: loading ? 'wait' : 'pointer',
              background: dragging ? C.bluePale : C.bg,
              transition: 'all .15s',
            }}
          >
            {loading ? (
              <>
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>Lecture en cours…</div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>Glissez votre fichier ici</div>

              </>
            )}
            <input
              ref={fileRef}
              type="file"
              style={{ display: 'none' }}
              accept=".xlsx,.csv"
              onChange={(e) => e.target.files[0] && handleEquipFile(e.target.files[0])}
            />
          </div>

          <div
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '12px 15px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.text3,
                textTransform: 'uppercase',
                letterSpacing: '.8px',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2" strokeLinecap="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
              Colonnes attendues
            </div>
            {[
              ['A', 'Poste technique'],
              ['B', 'Désignation du poste technique'],
              ['C', 'Niveau'],
              ['D', 'EQ/SEQ'],
            ].map(([col, lbl]) => (
              <div
                key={col}
                style={{
                  fontSize: 12,
                  color: C.text2,
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: 'monospace',
                    background: C.bluePale,
                    color: C.navy,
                    padding: '1px 6px',
                    borderRadius: 3,
                    fontSize: 10.5,
                    fontWeight: 700,
                  }}
                >
                  {col}
                </span>
                {lbl}
              </div>
            ))}
          </div>

          {equipPreview && (
            <div style={{ animation: 'fadeUp .2s ease' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 8 }}>
                ✅ {equipPreview.rows.length} équipement(s) détecté(s) — {equipPreview.fileName}
              </div>
              <div
                style={{
                  overflow: 'auto',
                  maxHeight: 200,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                }}
              >
                {(() => {
                  const EQUIP_PREVIEW_COLS = [
                    { label: 'Poste technique',                keywords: ['poste technique', 'poste', 'equipement', 'code'] },
                    { label: 'Désignation du poste technique', keywords: ['désignation du poste technique', 'désignation', 'designation', 'libelle', 'libellé'] },
                    { label: 'Niveau',                         keywords: ['niveay', 'niveaa', 'niveau', 'level'] },
                    { label: 'EQ/SEQ',                         keywords: ['eq/seq', 'eqseq', 'eq seq', 'seq'] },
                  ]
                  const displayCols = EQUIP_PREVIEW_COLS
                    .map(def => ({
                      label: def.label,
                      header: findKey(equipPreview.headers, def.keywords),
                    }))
                    .filter(c => c.header)

                  return (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.navy }}>
                          {displayCols.map((c) => (
                            <th key={c.label} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', position: 'sticky', top: 0 }}>
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {equipPreview.rows.slice(0, 15).map((row, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : C.bg, borderBottom: `1px solid ${C.border}` }}>
                            {displayCols.map((c, j) => (
                              <td key={c.label} style={{ padding: '8px 14px', color: j === 0 ? C.navy : C.text2, fontWeight: j === 0 ? 700 : 400, fontFamily: j === 0 ? 'monospace' : 'inherit', whiteSpace: 'nowrap' }}>
                                {row[c.header]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                })()}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <Button variant="ghost" onClick={downloadEquipTemplate}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:5,verticalAlign:'middle'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Télécharger données
            </Button>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              {equipPreview && (
                <Button variant="navy" onClick={() => setConfirmModal({
                  action: 'equip',
                  label: `${equipPreview.rows.length} équipement(s)`,
                  count: equipPreview.rows.length,
                })}>
                  Mettre à jour la liste
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3 : Gestion des causes d'arrêt */}
      {activeTab === 'causes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: C.bluePale,
              border: `1px solid ${C.blueMid}`,
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 12.5,
              color: C.text2,
            }}
          >
            ℹ️ Importez un fichier Excel pour mettre à jour la liste des causes d'arrêt. Ces causes seront disponibles
            dans la saisie manuelle.
          </div>

          <div
            onClick={() => fileCausesRef.current.click()}
            style={{
              border: `2px dashed ${C.border2}`,
              borderRadius: 8,
              padding: '22px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: C.bg,
              transition: 'all .15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.navy
              e.currentTarget.style.background = C.bluePale
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border2
              e.currentTarget.style.background = C.bg
            }}
          >
            <div style={{ marginBottom: 8, display:'flex', justifyContent:'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>
              {isLoadingCauses ? 'Lecture en cours...' : 'Cliquer pour importer la liste des causes'}
            </div>
            <input
              ref={fileCausesRef}
              type="file"
              style={{ display: 'none' }}
              accept=".xlsx,.xls,.csv"
              onChange={(e) => e.target.files[0] && handleCausesFile(e.target.files[0])}
            />
          </div>

          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 15px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2" strokeLinecap="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
              Colonnes attendues
            </div>
            {[
              ['A', "Cause d'arrêt"],
            ].map(([col, lbl]) => (
              <div key={col} style={{ fontSize: 12, color: C.text2, marginBottom: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'monospace', background: C.bluePale, color: C.navy, padding: '1px 6px', borderRadius: 3, fontSize: 10.5, fontWeight: 700 }}>{col}</span>
                {lbl}
              </div>
            ))}
          </div>

          {causesPreview.length > 0 && (
            <div style={{ animation: 'fadeUp .2s ease' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 8 }}>
                ✅ {causesPreview.length} cause(s) détectée(s)
              </div>
              <div
                style={{
                  overflow: 'auto',
                  maxHeight: 150,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.navy }}>
                      <th
                        style={{
                          padding: '6px 12px',
                          textAlign: 'center',
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: '#fff',
                          width: 50,
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                      </th>
                      <th
                        style={{
                          padding: '6px 12px',
                          textAlign: 'left',
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: '#fff',
                        }}
                      >
                        Cause d'arrêt
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {causesPreview.slice(0, 10).map((cause, i) => (
                      <tr
                        key={i}
                        style={{
                          background: i % 2 === 0 ? '#fff' : C.bg,
                          borderBottom: `1px solid ${C.border}`,
                        }}
                      >
                        <td style={{ padding: '7px 12px', color: C.text3, fontWeight: 600, textAlign: 'center' }}>{i + 1}</td>
                        <td style={{ padding: '7px 12px', color: C.text2 }}>{cause}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {causesPreview.length > 10 && (
                <div style={{ fontSize: 11, color: C.text4, marginTop: 4 }}>
                  + {causesPreview.length - 10} cause(s) supplémentaire(s)
                </div>
              )}
            </div>
          )}


          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={downloadCausesTemplate}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:'middle'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Télécharger données
            </Button>
            {causesPreview.length > 0 && (
              <Button variant="navy" onClick={() => setConfirmModal({
                action: 'causes',
                label: `${causesPreview.length} cause(s)`,
                count: causesPreview.length,
              })}>
                Mettre à jour la liste
              </Button>
            )}
          </div>
        </div>
      )}

      {/* TAB 4 : Gestion des participants */}
      {activeTab === 'participants' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: C.bluePale, border: `1px solid ${C.blueMid}`, borderRadius: 8, padding: '12px 16px', fontSize: 12.5, color: C.text2, display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Importez un fichier Excel pour mettre à jour la liste des participants disponibles dans les sessions RCA.
          </div>

          <div
            onClick={() => !isLoadingParticipants && fileParticipantsRef.current.click()}
            style={{ border: `2px dashed ${C.border2}`, borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: isLoadingParticipants ? 'wait' : 'pointer', background: C.bg, transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.background = C.bluePale }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.background = C.bg }}
          >
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
              {isLoadingParticipants ? (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              )}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>
              {isLoadingParticipants ? 'Lecture en cours...' : 'Cliquer pour importer la liste des participants'}
            </div>
            <input ref={fileParticipantsRef} type="file" style={{ display: 'none' }} accept=".xlsx,.xls" onChange={e => e.target.files[0] && handleParticipantsFile(e.target.files[0])} />
          </div>

          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 15px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2" strokeLinecap="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
              Colonnes attendues
            </div>
            {[
              ['A', 'Nom du participant'],
              ['B', 'Fonction'],
            ].map(([col, lbl]) => (
              <div key={col} style={{ fontSize: 12, color: C.text2, marginBottom: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'monospace', background: C.bluePale, color: C.navy, padding: '1px 6px', borderRadius: 3, fontSize: 10.5, fontWeight: 700 }}>{col}</span>
                {lbl}
              </div>
            ))}
          </div>

          {participantsPreview && (
            <div style={{ animation: 'fadeUp .2s ease' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {participantsPreview.rows.length} participant(s) détecté(s) — {participantsPreview.fileName}
              </div>
              <div style={{ overflow: 'auto', maxHeight: 150, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: C.navy }}>
                      <th style={{ padding: '6px 12px', textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: '#fff', width: 40 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                      </th>
                      <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#fff' }}>Nom du participant</th>
                      <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#fff' }}>Fonction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participantsPreview.rows.slice(0, 10).map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                        <td style={{ padding: '7px 12px', color: C.text3, fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{i + 1}</td>
                        <td style={{ padding: '7px 12px', color: C.text }}>{p.nom}</td>
                        <td style={{ padding: '7px 12px', color: C.text2 }}>{p.fonction || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
            <Button variant="ghost" onClick={downloadParticipantsTemplate}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:'middle'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Télécharger données
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={onClose}>Fermer</Button>
              {participantsPreview && (
                <Button variant="navy" onClick={() => setConfirmModal({
                  action: 'participants',
                  label: `${participantsPreview.rows.length} participant(s)`,
                  count: participantsPreview.rows.length,
                })}>
                  Mettre à jour la liste
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>

      {/* ── Column Error Modal ── */}
      {columnErrorModal && (() => {
        const rules = COLUMN_RULES[columnErrorModal.tab]
        const allExpected = [...(rules?.required || []), ...(rules?.optional || [])]
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(4px)',
          }}>
            <div style={{
              background: '#fff',
              borderRadius: 16,
              padding: '28px 32px',
              minWidth: 420,
              maxWidth: 520,
              boxShadow: '0 24px 64px rgba(0,0,0,.22)',
              animation: 'fadeUp .18s ease',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: '#fef2f2', border: '1.5px solid #fecaca',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: '#0f172a', marginBottom: 4 }}>
                    Colonne(s) obligatoire(s) manquante(s)
                  </div>
                  <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.5 }}>
                    Le fichier importé ne respecte pas le format attendu pour l'onglet <strong style={{ color: '#1B2A4A' }}>{rules?.tabLabel}</strong>.
                  </div>
                </div>
              </div>

              {/* Missing columns */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  Colonnes manquantes ({columnErrorModal.missing.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {columnErrorModal.missing.map(col => (
                    <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12.5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      <span style={{ fontWeight: 600, color: '#b91c1c' }}>{col}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expected columns */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>
                  Format attendu
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {allExpected.map((col, i) => {
                    const isRequired = rules.required.some(r => r.label === col.label)
                    const isMissing = columnErrorModal.missing.includes(col.label)
                    // Check if this column is detected in the uploaded file
                    const lowerH = columnErrorModal.headers.map(h => h.toLowerCase().trim())
                    const isDetected = col.keywords.some(k => lowerH.includes(k.toLowerCase()))
                    const bgColor = isMissing ? '#fef2f2' : isDetected ? '#f0fdf4' : '#f8fafc'
                    const txtColor = isMissing ? '#dc2626' : isDetected ? '#16a34a' : '#94a3b8'
                    const bdColor = isMissing ? '#fecaca' : isDetected ? '#bbf7d0' : '#e2e8f0'
                    return (
                      <div key={col.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700, fontSize: 10.5,
                          background: bgColor, color: txtColor, border: `1px solid ${bdColor}`,
                          padding: '1px 7px', borderRadius: 4, minWidth: 22, textAlign: 'center',
                        }}>
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span style={{ color: isMissing ? '#b91c1c' : isDetected ? '#334155' : '#94a3b8', fontWeight: isMissing ? 600 : 400 }}>
                          {col.label}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: isMissing ? '#dc2626' : '#16a34a', background: isMissing ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isMissing ? '#fecaca' : '#bbf7d0'}`, borderRadius: 4, padding: '1px 5px' }}>
                          requis
                        </span>
                        {isMissing ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" style={{ marginLeft: 'auto' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        ) : isDetected ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" style={{ marginLeft: 'auto' }}><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ marginLeft: 'auto' }}><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Detected columns */}
                {columnErrorModal.headers.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
                      Colonnes détectées dans votre fichier :
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {columnErrorModal.headers.map(h => (
                        <span key={h} style={{
                          fontSize: 11, fontFamily: 'monospace',
                          background: '#e2e8f0', color: '#475569',
                          padding: '2px 8px', borderRadius: 4,
                        }}>{h}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setColumnErrorModal(null)}
                  style={{
                    padding: '9px 20px', borderRadius: 8, border: '1.5px solid #e2e8f0',
                    background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Fermer
                </button>
                <button
                  onClick={() => {
                    setColumnErrorModal(null)
                    // Re-trigger file input for the correct tab
                    if (columnErrorModal.tab === 'equip') fileRef.current?.click()
                    else if (columnErrorModal.tab === 'causes') fileCausesRef.current?.click()
                    else if (columnErrorModal.tab === 'participants') fileParticipantsRef.current?.click()
                  }}
                  style={{
                    padding: '9px 20px', borderRadius: 8, border: 'none',
                    background: '#1B2A4A', color: '#fff', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Importer un autre fichier
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Confirmation Modal ── */}
      {confirmModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 14,
            padding: '28px 32px',
            minWidth: 380,
            maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,.18)',
            animation: 'fadeUp .18s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: '#fff7ed', border: '1.5px solid #fed7aa',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Confirmer la mise à jour</div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>Cette action remplacera les données existantes</div>
              </div>
            </div>
            <div style={{
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 8, padding: '12px 16px', marginBottom: 22,
              fontSize: 13, color: '#334155',
            }}>
              <span style={{ fontWeight: 700, color: '#1B2A4A' }}>{confirmModal.count}</span> enregistrement(s) vont être importés et remplaceront la liste actuelle.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: '1.5px solid #e2e8f0',
                  background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: '#1B2A4A', color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  display: 'flex', alignItems: 'center', gap: 7,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Confirmer la mise à jour
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}