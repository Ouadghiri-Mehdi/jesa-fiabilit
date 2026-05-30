// src/components/tum/SaisieManuelle.jsx
import { useState, useRef, useEffect, useMemo } from 'react'
import C from '../../tokens/colors'
import Modal from '../shared/Modal'
import Button from '../shared/Button'
import { POSTES_TECHNIQUES } from '../../data/postes_techniques'
import { getStatut } from '../../hooks/useTUM'

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
]

const ZONES_GEOGRAPHIQUES = ['PAP', 'DAP', 'CAP']

const inputStyle = {
  width: '100%', padding: '9px 13px',
  background: '#fff', border: `1.5px solid ${C.border2}`,
  borderRadius: 8, color: C.text, fontSize: 13,
  fontFamily: "'DM Sans', sans-serif", outline: 'none',
  boxSizing: 'border-box',
}

const inputStyleReduit = {
  width: '100%', padding: '8px 12px',
  background: '#fff', border: `1.5px solid ${C.border2}`,
  borderRadius: 8, color: C.text, fontSize: 13,
  fontFamily: "'DM Sans', sans-serif", outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block', fontSize: 11.5, fontWeight: 600,
  color: C.text3, marginBottom: 6,
}

export default function SaisieManuelle({
  onClose,
  onSave,
  inline = false,
  seuils,
  arretsExistants = [],
  onSaveSuccess,
  equipmentList = [],
  causesList: causesFromProps = [],
}) {
  const today = new Date().toISOString().slice(0, 10)
  const knownPostesList = equipmentList.length > 0 ? equipmentList : POSTES_TECHNIQUES
  const causesList = causesFromProps.length > 0 ? causesFromProps : CAUSES_ARRET_DEFAUT

  const [form, setForm] = useState({
    equipId: '', designation: '', niveauEqSeq: '',
    zone: 'PAP', date: today,
    dateDebutArret: '', dateFinArret: '',
    heureArret: '', heureRedemarrage: '', cause: '', description: '',
  })

  const [autocomplete, setAutocomplete] = useState([])
  const [autocompleteDesig, setAutocompleteDesig] = useState([])
  const acRef = useRef()
  const acDesigRef = useRef()
  const [isAutreCause, setIsAutreCause] = useState(false)
  const [autreCauseText, setAutreCauseText] = useState('')

  useEffect(() => {
    const handle = e => {
      if (acRef.current && !acRef.current.contains(e.target)) setAutocomplete([])
      if (acDesigRef.current && !acDesigRef.current.contains(e.target)) setAutocompleteDesig([])
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const calcDuree = () => {
    if (!form.heureArret || !form.heureRedemarrage) return ''
    const [ah, am] = form.heureArret.split(':').map(Number)
    const [rh, rm] = form.heureRedemarrage.split(':').map(Number)
    let mins = (rh * 60 + rm) - (ah * 60 + am)
    if (mins < 0) mins += 1440
    return (Math.round(mins / 6) / 10).toFixed(1) + 'h'
  }

  const duree = calcDuree()
  const dureeH = duree ? parseFloat(duree) : 0
  const heuresMarche = duree ? (24 - dureeH).toFixed(1) + 'h' : ''

  // 🔥 CORRECTION : Ne prendre que la session active (OPEN) pour l'historique cumulé
  // Car une session clôturée ne doit pas s'additionner avec la nouvelle
  const cumulExistant = useMemo(() => {
    if (!form.equipId) return 0
    
    // Vérifier si les arrêts ont une propriété session_status
    const hasSessionStatus = arretsExistants.some(a => a.sessionStatus !== undefined)
    
    if (hasSessionStatus) {
      // Ne prendre que les sessions OPEN (actives)
      return arretsExistants
        .filter(arret => arret.equipId === form.equipId && arret.sessionStatus === 'OPEN')
        .reduce((total, arret) => total + (arret.duration || 0), 0)
    } else {
      // Fallback : ne prendre que l'arrêt le plus récent (dernière session)
      const equipArrets = arretsExistants
        .filter(arret => arret.equipId === form.equipId)
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      const plusRecente = equipArrets.slice(0, 1)
      return plusRecente.reduce((total, arret) => total + (arret.duration || 0), 0)
    }
  }, [form.equipId, arretsExistants])

  // 🔥 CORRECTION : Idem pour la fréquence
  const frequenceExistante = useMemo(() => {
    if (!form.equipId) return 0
    
    const hasSessionStatus = arretsExistants.some(a => a.sessionStatus !== undefined)
    
    if (hasSessionStatus) {
      return arretsExistants
        .filter(arret => arret.equipId === form.equipId && arret.sessionStatus === 'OPEN')
        .reduce((s, a) => s + (a.frequence || 1), 0)
    } else {
      const equipArrets = arretsExistants
        .filter(arret => arret.equipId === form.equipId)
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      return Math.min(equipArrets.slice(0, 1).length, 1)
    }
  }, [form.equipId, arretsExistants])

  const cumulTotal = cumulExistant + dureeH
  const frequenceTotal = frequenceExistante + 1

  const currentStatut = seuils && (form.heureArret && form.heureRedemarrage)
    ? getStatut(cumulTotal, frequenceTotal, seuils)
    : (dureeH >= 6 ? 'alert' : dureeH >= 4 ? 'watch' : 'normal')

  const level = currentStatut === 'alert' ? 2 : currentStatut === 'watch' ? 1 : 0
  const levelColor = level === 2 ? C.red : level === 1 ? '#d97706' : C.green

  const handlePosteChange = (val) => {
    setForm(f => ({ ...f, equipId: val, designation: '', niveauEqSeq: '' }))
    setAutocomplete(
      val ? knownPostesList.filter(p =>
        p.id.toLowerCase().includes(val.toLowerCase()) ||
        p.designation.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 8) : []
    )
  }

  const selectPoste = (p) => {
    const niv    = p.entite  || p.niveau  || '—'
    const eqseq  = p.famille || p.eqSeq   || '—'
    setForm(f => ({
      ...f,
      equipId:     p.id,
      designation: p.designation || '',
      niveauEqSeq: `${niv} - ${eqseq}`,
    }))
    setAutocomplete([])
    setAutocompleteDesig([])
  }

  const handleDesignationChange = (val) => {
    setForm(f => ({ ...f, designation: val, equipId: '', niveauEqSeq: '' }))
    setAutocompleteDesig(
      val ? knownPostesList.filter(p =>
        p.designation.toLowerCase().includes(val.toLowerCase()) ||
        p.id.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 8) : []
    )
  }

  const handleCauseChange = (e) => {
    const value = e.target.value
    if (value === '__AUTRE__') {
      setIsAutreCause(true)
      setForm(f => ({ ...f, cause: '' }))
    } else {
      setIsAutreCause(false)
      setAutreCauseText('')
      setForm(f => ({ ...f, cause: value }))
    }
  }

  const handleAutreCauseChange = (e) => {
    const value = e.target.value
    setAutreCauseText(value)
    setForm(f => ({ ...f, cause: value }))
  }

  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.equipId.trim()) e.equipId = 'Poste technique requis'
    if (!form.heureArret) e.heureArret = 'Heure d\'arrêt requise'
    if (!form.cause.trim()) e.cause = 'Cause / symptôme requis'
    if (!form.zone) e.zone = 'Zone géographique requise'
    return e
  }

  const handleSave = () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    const dateRef = form.dateDebutArret || form.date
    const start = new Date(`${dateRef}T${form.heureArret}:00`)
    const endDate = form.dateFinArret || dateRef
    const end = form.heureRedemarrage ? new Date(`${endDate}T${form.heureRedemarrage}:00`) : null

    const nouvelArret = {
      id: Date.now() + Math.random(),
      equipId:        form.equipId.trim(),
      designation:    form.designation.trim(),
      niveauEqSeq:    form.niveauEqSeq,
      zone:           form.zone,
      startTime:      start.toISOString(),
      endTime:        end ? end.toISOString() : '',
      dateDebutArret: form.dateDebutArret || '',
      dateFinArret:   form.dateFinArret || '',
      duration:       end ? (end - start) / 3600000 : dureeH,
      cause:          form.cause.trim(),
      description:    form.description.trim(),
      sessionStatus: 'OPEN',
    }

    onSave(nouvelArret)
    if (onSaveSuccess) onSaveSuccess([form.equipId.trim()])
  }

  const field = (label, required, content) => (
    <div>
      <label style={labelStyle}>
        {label}
      </label>
      {content}
    </div>
  )

  const SectionHeader = ({ num, title }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: num > 1 ? 8 : 0 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: C.navy, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800
      }}>
        {num}
      </div>
      <span style={{ fontWeight: 700, fontSize: 13, color: C.navy, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
    </div>
  )

  const InfoCumul = () => {
    // 🔥 Ne plus afficher l'historique cumulé s'il n'y a pas de session active
    if (!form.equipId || cumulExistant === 0) return null
    
    // Vérifier si la session existante est vraiment active
    const hasActiveSession = arretsExistants.some(
      a => a.equipId === form.equipId && a.sessionStatus === 'OPEN'
    )
    
    if (!hasActiveSession && arretsExistants.some(a => a.equipId === form.equipId)) {
      // Une session clôturée existe mais pas active
      return (
        <div style={{
          marginTop: 8, padding: '8px 12px', background: '#fffbeb', borderRadius: 8,
          fontSize: 11.5, color: '#b45309', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          border: '1px solid #fde68a'
        }}>
          <span>⚠️</span>
          <span>Une session précédente est <strong>clôturée</strong>. Cette nouvelle saisie créera un <strong>nouvel incident indépendant</strong>.</span>
        </div>
      )
    }
    
    return (
      <div style={{
        marginTop: 8, padding: '8px 12px', background: C.bg2, borderRadius: 8,
        fontSize: 11.5, color: C.text3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'
      }}>
        <span>📊 <strong>Incident en cours sur {form.equipId}</strong> :</span>
        <span>{cumulExistant.toFixed(1)}h cumulées</span>
        <span>•</span>
        <span>{frequenceExistante} arrêt(s)</span>
        {dureeH > 0 && (
          <span>→ <strong style={{ color: C.navy }}>+{dureeH.toFixed(1)}h = {cumulTotal.toFixed(1)}h</strong></span>
        )}
      </div>
    )
  }

  const formContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader num={1} title="Identification de l'équipement" />

      {/* ── 3 champs poste technique sur une ligne ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 0.8fr', gap: 12 }}>

        {/* Champ 1 — Poste technique avec autocomplete */}
        <div ref={acRef} style={{ position: 'relative' }}>
          <label style={labelStyle}>Poste technique</label>
          <input
            style={{ ...inputStyle, ...(errors.equipId ? { borderColor: C.red } : {}), fontFamily: 'monospace', fontSize: 12.5 }}
            value={form.equipId}
            onChange={e => handlePosteChange(e.target.value)}
            placeholder="Ex: JF08-3M-318A"
            autoComplete="off"
          />
          {errors.equipId && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>⚠ {errors.equipId}</div>}
          {autocomplete.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: '#fff', border: `1px solid ${C.border2}`,
              borderRadius: 8, zIndex: 20,
              boxShadow: '0 8px 24px rgba(0,0,0,.14)',
              maxHeight: 240, overflowY: 'auto',
            }}>
              {autocomplete.map(p => (
                <div key={p.id} onClick={() => selectPoste(p)}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.bg2}` }}
                  onMouseEnter={ev => ev.currentTarget.style.background = C.bluePale}
                  onMouseLeave={ev => ev.currentTarget.style.background = ''}
                >
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: C.navy }}>{p.id}</div>
                  <div style={{ fontSize: 11, color: C.text3, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.designation}
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: C.text4 }}>N{p.entite || p.niveau || '—'} · {p.famille || p.eqSeq || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <InfoCumul />
        </div>

        {/* Champ 2 — Désignation avec autocomplete */}
        <div ref={acDesigRef} style={{ position: 'relative' }}>
          <label style={labelStyle}>Désignation du poste technique</label>
          <input
            style={inputStyle}
            value={form.designation}
            onChange={e => handleDesignationChange(e.target.value)}
            placeholder="Saisir la désignation…"
            autoComplete="off"
            onFocus={e => e.target.style.borderColor = C.navy}
            onBlur={e  => e.target.style.borderColor = C.border2}
          />
          {autocompleteDesig.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: '#fff', border: `1px solid ${C.border2}`,
              borderRadius: 8, zIndex: 20,
              boxShadow: '0 8px 24px rgba(0,0,0,.14)',
              maxHeight: 240, overflowY: 'auto',
            }}>
              {autocompleteDesig.map(p => (
                <div key={p.id} onClick={() => selectPoste(p)}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.bg2}` }}
                  onMouseEnter={ev => ev.currentTarget.style.background = C.bluePale}
                  onMouseLeave={ev => ev.currentTarget.style.background = ''}
                >
                  <div style={{ fontSize: 11.5, color: C.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.designation}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: C.text3, marginTop: 2 }}>
                    {p.id}
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: C.text4 }}>N{p.entite || p.niveau || '—'} · {p.famille || p.eqSeq || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Champ 3 — Niveau - EQ/SEQ (lecture seule, grisé) */}
        <div>
          <label style={labelStyle}>Niveau - EQ/SEQ</label>
          <input
            style={{ ...inputStyle, background: C.bg, color: C.text3, cursor: 'not-allowed', fontWeight: 600 }}
            value={form.niveauEqSeq}
            readOnly
            placeholder="—"
          />
        </div>
      </div>

      {/* ── Zone | Date début arrêt | Date fin arrêt ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Zone géographique</label>
          <select
            style={{ ...inputStyle, ...(errors.zone ? { borderColor: C.red } : {}) }}
            value={form.zone}
            onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
          >
            {ZONES_GEOGRAPHIQUES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
          </select>
          {errors.zone && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>⚠ {errors.zone}</div>}
        </div>
        <div>
          <label style={labelStyle}>Date début arrêt</label>
          <input
            type="date"
            style={inputStyle}
            value={form.dateDebutArret}
            onChange={e => setForm(f => ({ ...f, dateDebutArret: e.target.value }))}
            onFocus={e => e.target.style.borderColor = C.navy}
            onBlur={e => e.target.style.borderColor = C.border2}
          />
        </div>
        <div>
          <label style={labelStyle}>Date fin arrêt</label>
          <input
            type="date"
            style={{
              ...inputStyle,
              ...(form.dateDebutArret && form.dateFinArret && form.dateFinArret < form.dateDebutArret
                ? { borderColor: C.red }
                : {})
            }}
            value={form.dateFinArret}
            min={form.dateDebutArret || undefined}
            onChange={e => setForm(f => ({ ...f, dateFinArret: e.target.value }))}
            onFocus={e => e.target.style.borderColor = C.navy}
            onBlur={e => e.target.style.borderColor = C.border2}
          />
          {form.dateDebutArret && form.dateFinArret && form.dateFinArret < form.dateDebutArret && (
            <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>⚠ Date fin antérieure à la date début</div>
          )}
        </div>
      </div>

      <SectionHeader num={2} title="Données de la panne" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Heure début arrêt</label>
          <input type="time" style={{ ...inputStyle, ...(errors.heureArret ? { borderColor: C.red } : {}) }}
            value={form.heureArret}
            onChange={e => setForm(f => ({ ...f, heureArret: e.target.value }))} />
          {errors.heureArret && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>⚠ {errors.heureArret}</div>}
        </div>
        <div>
          <label style={labelStyle}>Heure fin arrêt</label>
          <input type="time" style={inputStyle}
            value={form.heureRedemarrage}
            onChange={e => setForm(f => ({ ...f, heureRedemarrage: e.target.value }))} />
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
            Durée d'arrêt
            <span style={{ fontSize: 9, background: C.bg2, color: C.text3, padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>AUTO</span>
          </label>
          <input style={{ ...inputStyle, background: C.bg, color: C.text3, cursor: 'not-allowed' }} value={duree} readOnly />
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
            Heures de marche (h)
            <span style={{ fontSize: 9, background: C.bg2, color: C.text3, padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>24h - ARRET</span>
          </label>
          <input style={{ ...inputStyle, background: C.bg, color: C.text3, cursor: 'not-allowed' }} value={heuresMarche} readOnly />
        </div>
      </div>

      <div style={{ maxWidth: '400px' }}>
        <label style={labelStyle}>
          Cause d'arrêt 
        </label>
        <div style={{ position: 'relative' }}>
          <select
            style={{ ...inputStyleReduit, ...(errors.cause ? { borderColor: C.red } : {}), paddingLeft: isAutreCause ? 32 : undefined }}
            value={isAutreCause ? '__AUTRE__' : form.cause}
            onChange={handleCauseChange}
          >
            <option value="">-- Sélectionner une cause --</option>
            {causesList.map((cause, idx) => (
              <option key={idx} value={cause}>{cause}</option>
            ))}
            <option value="__AUTRE__">Autre (saisie libre)</option>
          </select>
          {isAutreCause && (
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </span>
          )}
        </div>
        {isAutreCause && (
          <input
            type="text"
            style={{ ...inputStyleReduit, marginTop: 8, ...(errors.cause ? { borderColor: C.red } : {}) }}
            value={autreCauseText}
            onChange={handleAutreCauseChange}
            placeholder="Saisir la cause..."
          />
        )}
        {errors.cause && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>⚠ {errors.cause}</div>}
      </div>

      {/* ── Description avec limite 500 caractères ── */}
      {field('Description', false,
        <div>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }}
            value={form.description}
            maxLength={500}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Détails supplémentaires, contexte de la panne, observations terrain…"
          />
          <div style={{ textAlign: 'right', fontSize: 10.5, color: form.description.length > 450 ? C.red : C.text4, marginTop: 3 }}>
            {form.description.length} / 500
          </div>
        </div>
      )}

      {(form.heureArret && form.heureRedemarrage && form.equipId) && (() => {
        const triggerCumulN2  = seuils && cumulTotal >= seuils.n2.cumul
        const triggerFreqN2   = seuils && frequenceTotal >= seuils.n2.frequence
        const triggerCumulN1  = seuils && cumulTotal >= seuils.n1.cumul
        const triggerFreqN1   = seuils && frequenceTotal >= seuils.n1.frequence

        const getDetail = () => {
          if (level === 2) {
            if (triggerCumulN2 && triggerFreqN2)
              return `Cumul durée : ${cumulTotal.toFixed(1)}h ≥ ${seuils.n2.cumul}h · Fréquence : ${frequenceTotal} arrêts ≥ ${seuils.n2.frequence}`
            if (triggerCumulN2)
              return `Cumul durée : ${cumulTotal.toFixed(1)}h ≥ ${seuils.n2.cumul}h (seuil N2)`
            if (triggerFreqN2)
              return `Fréquence : ${frequenceTotal} arrêts ≥ ${seuils.n2.frequence} (seuil N2)`
            return `Cumul : ${cumulTotal.toFixed(1)}h · ${frequenceTotal} arrêts`
          }
          if (level === 1) {
            if (triggerCumulN1 && triggerFreqN1)
              return `Cumul durée : ${cumulTotal.toFixed(1)}h ≥ ${seuils.n1.cumul}h · Fréquence : ${frequenceTotal} arrêts ≥ ${seuils.n1.frequence}`
            if (triggerCumulN1)
              return `Cumul durée : ${cumulTotal.toFixed(1)}h ≥ ${seuils.n1.cumul}h (seuil N1)`
            if (triggerFreqN1)
              return `Fréquence : ${frequenceTotal} arrêts ≥ ${seuils.n1.frequence} (seuil N1)`
            return `Cumul : ${cumulTotal.toFixed(1)}h · ${frequenceTotal} arrêts`
          }
          return `Cumul : ${cumulTotal.toFixed(1)}h · ${frequenceTotal} arrêt${frequenceTotal > 1 ? 's' : ''}`
        }

        return (
          <div style={{
            padding: '7px 12px', borderRadius: 8,
            background: level === 2 ? '#fef2f2' : level === 1 ? '#fffbeb' : '#f0fdf4',
            border: `1px solid ${level === 2 ? '#fecaca' : level === 1 ? '#fde68a' : '#bbf7d0'}`,
            display: 'flex', alignItems: 'center', gap: 8,
            marginTop: -4, animation: 'fadeUp .2s ease',
          }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>
              {level === 2 ? '🔴' : level === 1 ? '🟡' : '🟢'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: levelColor }}>
                {level === 2 ? 'N2 — Arbre De Causes obligatoire' :
                 level === 1 ? 'N1 — Quick Kaizen requis' :
                 'Niveau normal'}
              </span>
              <span style={{ fontSize: 11, color: C.text3, marginLeft: 6 }}>
                {getDetail()}
              </span>
            </div>
          </div>
        )
      })()}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
        <Button variant="ghost" onClick={onClose}>{inline ? 'Fermer' : 'Annuler'}</Button>
        <Button variant="navy" onClick={handleSave}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
          </svg>
          Enregistrer l'arrêt
        </Button>
      </div>
    </div>
  )

  if (inline) {
    return (
      <div style={{
        background: '#fff', border: `1.5px solid ${C.blueMid}`,
        borderRadius: 12, marginTop: 16,
        boxShadow: '0 4px 20px rgba(26, 58, 107, 0.08)',
        animation: 'fadeUp .25s ease', overflow: 'hidden'
      }}>
        <div style={{
          background: C.navy, padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,.85)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>Rapport d'arrêt</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          {formContent}
        </div>
      </div>
    )
  }

  return (
    <Modal title="Rapport d'arrêt" onClose={onClose} width={560}>
      {formContent}
    </Modal>
  )
}