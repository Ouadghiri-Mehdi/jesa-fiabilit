// src/components/tum/ImportExcel.jsx
import { useState, useRef, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx'
import C from '../../tokens/colors'
import { POSTES_TECHNIQUES } from '../../data/postes_techniques'
import Button from '../shared/Button'

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

function parseDate(val) {
  if (!val) return null
  if (typeof val === 'number') {
    const excelEpoch = new Date(1899, 11, 30)
    const d = new Date(excelEpoch.getTime() + val * 86400000)
    if (!isNaN(d)) return d
  }
  const s = String(val).trim()
  const d = new Date(s)
  if (!isNaN(d)) return d
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})/)
  if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1], +m[4], +m[5])
  const m2 = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (m2) return new Date(+m2[3] < 100 ? 2000 + +m2[3] : +m2[3], +m2[2] - 1, +m2[1])
  return null
}

function extractDatePart(val) {
  if (!val) return ''
  const s = String(val).trim()
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) {
    const [y, m, d] = isoMatch[1].split('-')
    return `${d}/${m}/${y}`
  }
  return s
}

function formatDateFrench(val, includeTime = false) {
  if (!val) return ''
  let date
  if (typeof val === 'string') { date = new Date(val); if (isNaN(date)) return val }
  else if (val instanceof Date) { date = val }
  else { return String(val) }
  const dd   = String(date.getDate()).padStart(2, '0')
  const mm   = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  if (!includeTime) return `${dd}/${mm}/${yyyy}`
  return `${dd}/${mm}/${yyyy} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}

function parseCSV(text) {
  const rows = text.split(/\r?\n/).filter(Boolean)
  if (rows.length < 2) return { headers: [], data: [] }
  const headers = rows[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''))
  const data = rows.slice(1).map(row => {
    const cols = row.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cols[i] || '' })
    return obj
  }).filter(r => Object.values(r).some(Boolean))
  return { headers, data }
}

// ── CORRECTION : extraire HH:mm depuis un objet Date pour les colonnes "heure" ──
function formatCellValue(header, val) {
  if (val instanceof Date) {
    const hLower = header.toLowerCase()
    if (hLower.includes('heure')) {
      // Colonne heure : extraire uniquement HH:mm
      return `${String(val.getHours()).padStart(2, '0')}:${String(val.getMinutes()).padStart(2, '0')}`
    }
    // Colonne date ou autre : garder ISO
    return val.toISOString()
  }
  return val !== undefined && val !== null ? String(val) : ''
}

const GUIDE_COLS = [
  { letter: 'A', label: 'Poste technique',                required: false },
  { letter: 'B', label: 'Désignation du poste technique', required: false },
  { letter: 'C', label: 'Niveau',                         required: false },
  { letter: 'D', label: 'EQ/SEQ',                         required: false },
  { letter: 'E', label: 'Zone géographique',              required: false },
  { letter: 'F', label: 'Date début arrêt',               required: false },
  { letter: 'G', label: 'Heure début arrêt',              required: false },
  { letter: 'H', label: 'Date fin arrêt',                 required: false },
  { letter: 'I', label: 'Heure fin arrêt',                required: false },
  { letter: 'J', label: 'Causes arrêt',                   required: false },
  { letter: 'K', label: 'Description',                    required: false },
]

const PREVIEW_COL_DEFS = [
  { label: 'Poste technique',                keywords: ['poste technique', 'poste', 'equipement', 'code'] },
  { label: 'Désignation du poste technique', keywords: ['désignation du poste technique', 'désignation', 'designation', 'libelle', 'libellé'] },
  { label: 'Niveau',                         keywords: ['niveay', 'niveaa', 'niveau', 'level'] },
  { label: 'EQ/SEQ',                         keywords: ['eq/seq', 'eqseq', 'eq seq', 'seq'] },
  { label: 'Zone géographique',             keywords: ['zone géographique', 'zone geographique', 'zone'] },
  { label: 'Date début arrêt',              keywords: ['date début arrêt', 'date debut arret', 'date début', 'date debut'] },
  { label: 'Heure début arrêt',             keywords: ['heure début arrêt', 'heure debut arret', 'heure début', 'heure debut'] },
  { label: 'Date fin arrêt',                keywords: ['date fin arrêt', 'date fin arret', 'date fin'] },
  { label: 'Heure fin arrêt',               keywords: ['heure fin arrêt', 'heure fin arret', 'heure fin'] },
  { label: 'Causes arrêt',                  keywords: ['causes arrêt', 'cause arrêt', 'cause_arret', 'cause', 'causes'] },
  { label: 'Description',                    keywords: ['description', 'desc', 'commentaire', 'détails'] },
]

export default function ImportExcel({ onImport, showNotif, onFileLoaded }) {
  const [preview, setPreview]   = useState(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading]   = useState(false)
  const fileRef = useRef()
  const knownPostesList = (() => {
    try {
      const stored = localStorage.getItem('jesa_postes_techniques')
      return stored ? JSON.parse(stored) : POSTES_TECHNIQUES
    } catch { return POSTES_TECHNIQUES }
  })()

  useEffect(() => { loadSheetJS().catch(() => {}) }, [])

  const findKey = (headers, keywords) =>
    headers.find(h => keywords.some(k => h.toLowerCase().includes(k)))

  const processFile = useCallback(async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    setLoading(true)
    try {
      if (ext === 'csv' || ext === 'tsv') {
        const text = await file.text()
        const { headers, data } = parseCSV(text)
        if (!headers.length) { showNotif('Fichier vide', 'Le fichier CSV ne contient pas de données', 'red'); return }
        setPreview({ headers, rows: data, fileName: file.name })
        const posteKey = findKey(headers, ['poste technique', 'poste', 'equipement', 'code'])
        if (posteKey && onFileLoaded)
          onFileLoaded([...new Set(data.map(row => String(row[posteKey] || '').trim()).filter(Boolean))])
      } else if (['xlsx', 'xls'].includes(ext)) {
        let XLSXLib
        try { XLSXLib = await loadSheetJS() }
        catch { showNotif('SheetJS indisponible', 'Vérifiez votre connexion internet', 'red'); return }
        const buf = await file.arrayBuffer()
        const wb  = XLSXLib.read(buf, { type: 'array', cellDates: true })
        const ws  = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSXLib.utils.sheet_to_json(ws, { defval: '', header: 1 })
        if (raw.length < 2) { showNotif('Fichier vide', 'Le fichier ne contient pas de données', 'red'); return }
        const headers = raw[0].map(h => String(h).trim()).filter(Boolean)
        const data = raw.slice(1)
          .map(row => {
            const obj = {}
            headers.forEach((h, i) => {
              // ── CORRECTION : utiliser formatCellValue pour gérer les heures ──
              obj[h] = formatCellValue(h, row[i])
            })
            return obj
          }).filter(r => Object.values(r).some(v => v !== ''))
        if (!data.length) { showNotif('Aucune donnée', 'Le fichier ne contient que des en-têtes', 'red'); return }
        setPreview({ headers, rows: data, fileName: file.name })
        showNotif('Fichier chargé', `${data.length} ligne(s) détectée(s) dans ${file.name}`, 'green')
        const posteKey = findKey(headers, ['poste technique', 'poste', 'equipement', 'code'])
        if (posteKey && onFileLoaded)
          onFileLoaded([...new Set(data.map(row => String(row[posteKey] || '').trim()).filter(Boolean))])
      } else {
        showNotif('Format non supporté', `Le format .${ext} n'est pas pris en charge`, 'red')
      }
    } catch (err) {
      showNotif('Erreur de lecture', `Impossible de lire le fichier : ${err.message}`, 'red')
    } finally {
      setLoading(false)
    }
  }, [showNotif, onFileLoaded])

  const handleImportAll = useCallback(() => {
    if (!preview) return
    const { headers, rows } = preview

    const posteKey       = findKey(headers, ['poste technique', 'poste', 'equipement', 'code'])
    const designationKey = findKey(headers, ['désignation du poste technique', 'désignation', 'designation', 'libelle', 'libellé'])
    const niveauKey      = findKey(headers, ['niveay', 'niveaa', 'niveau', 'level'])
    const eqSeqKey       = findKey(headers, ['eq/seq', 'eqseq', 'eq seq', 'seq'])
    const zoneKey        = findKey(headers, ['zone géographique', 'zone geographique', 'zone'])
    const dateDebutKey   = findKey(headers, ['date début arrêt', 'date debut arret', 'date début', 'date debut'])
    const heureDebutKey  = findKey(headers, ['heure début arrêt', 'heure debut arret', 'heure début', 'heure debut'])
    const dateFinKey     = findKey(headers, ['date fin arrêt', 'date fin arret', 'date fin'])
    const heureFinKey    = findKey(headers, ['heure fin arrêt', 'heure fin arret', 'heure fin'])
    const causeKey       = findKey(headers, ['causes arrêt', 'cause arrêt', 'cause_arret', 'cause', 'causes'])
    const descKey        = findKey(headers, ['description', 'desc', 'commentaire', 'détails'])

    const errors = [], newArrets = []

    rows.forEach((row, i) => {
      const equipId     = posteKey       ? String(row[posteKey]       || '').trim() : ''
      const designation = designationKey ? String(row[designationKey] || '').trim() : ''
      const niveau      = niveauKey      ? String(row[niveauKey]      || '').trim() : ''
      const eqSeq       = eqSeqKey       ? String(row[eqSeqKey]       || '').trim() : ''
      const niveauEqSeq = (niveau || eqSeq) ? `${niveau}${niveau && eqSeq ? ' - ' : ''}${eqSeq}` : ''

      if (!equipId) { errors.push(`Ligne ${i + 2} : Poste technique manquant`); return }

      const posteConnu = knownPostesList.find(p => p.id === equipId)
      if (!posteConnu) { errors.push(`Ligne ${i + 2} : "${equipId}" introuvable dans la liste des postes techniques`); return }

      let start = null
      if (dateDebutKey && heureDebutKey) {
        const ds = extractDatePart(row[dateDebutKey]), hs = row[heureDebutKey]
        if (ds && hs) start = parseDate(`${ds} ${hs}`)
      } else if (dateDebutKey) { start = parseDate(row[dateDebutKey]) }

      let end = null
      if (dateFinKey && heureFinKey) {
        const ds = extractDatePart(row[dateFinKey]), hs = row[heureFinKey]
        if (ds && hs) end = parseDate(`${ds} ${hs}`)
      } else if (dateFinKey) { end = parseDate(row[dateFinKey]) }

      if (!start) { errors.push(`Ligne ${i + 2} : date début invalide`); return }

      const durH = start && end ? Math.round(((end - start) / 3_600_000) * 10) / 10 : 0

      newArrets.push({
        id:          Date.now() + i + Math.random(),
        equipId,
        designation: designation || posteConnu?.designation || '',
        niveauEqSeq: niveauEqSeq || (posteConnu ? `${posteConnu.niveau} - ${posteConnu.eqSeq}` : ''),
        zone:        zoneKey ? String(row[zoneKey] || '').trim() || 'PAP' : 'PAP',
        startTime:   start.toISOString(),
        endTime:     end ? end.toISOString() : '',
        duration:    durH,
        cause:       causeKey ? String(row[causeKey] || '') : '',
        description: descKey  ? String(row[descKey]  || '') : '',
      })
    })

    if (errors.length > 0) showNotif(`${errors.length} ligne(s) ignorée(s)`, errors[0], 'orange')
    if (newArrets.length > 0) { onImport(newArrets); setPreview(null) }
    else if (!errors.length)  showNotif('Aucune ligne valide', 'Vérifiez la structure du fichier', 'red')
  }, [preview, onImport, showNotif])

  const downloadTemplate = useCallback(() => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Poste technique', 'Désignation du poste technique', 'Niveau', 'EQ/SEQ', 'Date début arrêt', 'Heure début arrêt', 'Date fin arrêt', 'Heure fin arrêt', 'Causes arrêt', 'Description'],
      ['JF08',                            '3MT / 107DEF & OSBL JORF LASFAR',      1, 'STADE OP',        '20/03/2026', '08:00', '20/03/2026', '09:30', 'fixation supportage pompe à bouillie AP02',          'Révision pompe AP02 pour fixation supportage et alignement.'],
      ['JF08-3M-318A',                    'ATELIEROSBL',                           3, 'STADE OP',        '21/03/2026', '09:00', '21/03/2026', '10:30', 'Débouchage de la rampe',                             'Débouchage rampe et remplacement pompe AP02.'],
      ['JF08-3M-318A-00316B-000RIA',      'RIA DE LA ZONE DE STOCKAGE DU FUEL',   5, 'CAPITAL',         '22/03/2026', '10:00', '22/03/2026', '11:30', 'Arrêt de la tour - changement compensateur ref BP02', 'Arrêt tour pour remplacement compensateur ref BP02.'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'TUM_Arrets')
    XLSX.writeFile(wb, 'MODELE_TUM_ARRET.xlsx')
  }, [])

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 12,
      boxShadow: C.shadow,
    }}>

      {/* ── HEADER ── */}
      <div style={{
        background: C.navy,
        padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,.85)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 12.5, color: '#fff' }}>
          Import Excel
        </span>
        <button
          onClick={downloadTemplate}
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 6px', background: 'none', border: 'none',
            borderRadius: 4, fontSize: 11, fontWeight: 600,
            color: 'rgba(255,255,255,.85)', cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif", transition: 'color .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#fff'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,.85)'}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v13M7 11l5 5 5-5"/><path d="M5 20h14"/>
          </svg>
          Télécharger modèle
        </button>
      </div>

      {/* ── BODY ── */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>

          {/* ── DROP ZONE ── */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }}
            onClick={() => !loading && fileRef.current.click()}
            style={{
              flex: 1,
              border: `1.5px dashed ${dragging ? C.navy : '#a8c4e0'}`,
              borderRadius: 8,
              padding: '12px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              cursor: loading ? 'wait' : 'pointer',
              background: dragging ? C.bluePale : '#fff',
              transition: 'all .15s',
              minHeight: 90,
              gap: 4,
            }}
          >
            {loading ? (
              <>
                <div style={{ fontSize: 24, marginBottom: 4 }}>⏳</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text3 }}>Lecture en cours…</div>
              </>
            ) : (
              <>
                <div style={{ position: 'relative', width: 40, height: 40, marginBottom: 4 }}>
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect x="10" y="7" width="18" height="22" rx="2" fill="#dce8f5" stroke="#b8d0e8" strokeWidth="1"/>
                    <rect x="7" y="10" width="18" height="22" rx="2" fill="#eaf2fb" stroke="#b8d0e8" strokeWidth="1"/>
                    <line x1="11" y1="16" x2="21" y2="16" stroke="#b8d0e8" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="11" y1="20" x2="21" y2="20" stroke="#b8d0e8" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="11" y1="24" x2="17" y2="24" stroke="#b8d0e8" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: C.navy,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                  }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                      stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5"/>
                      <polyline points="5,12 12,5 19,12"/>
                    </svg>
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a2b3c' }}>
                  Glissez votre fichier ici
                </div>
                <div style={{ fontSize: 11.5, color: C.text3 }}>
                  ou{' '}
                  <span style={{ color: C.navy, fontWeight: 500, textDecoration: 'underline', cursor: 'pointer' }}>
                    cliquer pour parcourir
                  </span>
                </div>
              </>
            )}
            <input ref={fileRef} type="file" style={{ display: 'none' }}
              accept=".xlsx,.csv"
              onChange={e => e.target.files[0] && processFile(e.target.files[0])}
            />
          </div>

          {/* ── GUIDE D'IMPORT ── */}
          <div style={{
            width: 220,
            background: '#fff',
            border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '10px 14px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke={C.text3} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{
                fontSize: 9, fontWeight: 800, color: C.text3,
                textTransform: 'uppercase', letterSpacing: '1px',
              }}>
                Guide d'import
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {GUIDE_COLS.map(({ letter, label, required }) => (
                <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    width: 15, height: 15, flexShrink: 0,
                    background: required ? C.navy : C.bg2, borderRadius: 3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 800, color: required ? '#fff' : C.text3,
                  }}>
                    {letter}
                  </span>
                  <span style={{ fontSize: 10.5, color: required ? C.text : C.text3, fontWeight: required ? 600 : 400 }}>{label}</span>

                </div>
              ))}
            </div>


            <div style={{
              marginTop: 8, paddingTop: 7,
              borderTop: `1px solid ${C.border}`,
              fontSize: 10, color: C.text4,
            }}>
              Formats acceptés :{' '}
              <span style={{ color: C.text3, fontWeight: 600 }}>Excel</span>
              {' · '}
              <span style={{ color: C.text3, fontWeight: 600 }}>CSV</span>
            </div>
          </div>
        </div>

        {/* ── PREVIEW TABLE ── */}
        {preview && (() => {
          const displayCols = PREVIEW_COL_DEFS
            .map(def => ({
              label: def.label,
              header: findKey(preview.headers, def.keywords),
            }))
            .filter(c => c.header)

          return (
            <div style={{ marginTop: 12, animation: 'fadeUp .2s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.green }}>
                  ✅ {preview.rows.length} ligne(s) détectée(s) — {preview.fileName}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>✕ Annuler</Button>
                  <Button variant="green" size="sm" onClick={handleImportAll}>✓ Importer tout</Button>
                </div>
              </div>
              <div style={{ overflow: 'auto', maxHeight: 180, border: `1px solid ${C.border}`, borderRadius: 7 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr>
                      {displayCols.map(c => (
                        <th key={c.label} style={{
                          padding: '6px 10px', background: C.bg,
                          fontSize: 10, fontWeight: 700, color: C.text3,
                          textTransform: 'uppercase', letterSpacing: '.8px',
                          textAlign: 'left', borderBottom: `2px solid ${C.border}`,
                          whiteSpace: 'nowrap',
                        }}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 20).map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.bg2}` }}>
                        {displayCols.map(c => (
                          <td key={c.label} style={{ padding: '6px 10px', color: C.text2, whiteSpace: 'nowrap' }}>
                            {c.label.toLowerCase().includes('date') && !c.label.toLowerCase().includes('heure')
                              ? formatDateFrench(row[c.header], false)
                              : row[c.header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
