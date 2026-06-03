// src/lib/api.js — Client HTTP centralisé pour le backend FastAPI (MySQL)

export const BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

// ─── Token JWT ───────────────────────────────────────────────────────────────

export const token = {
  get:   ()  => localStorage.getItem('jesa_token'),
  set:   (t) => localStorage.setItem('jesa_token', t),
  clear: ()  => localStorage.removeItem('jesa_token'),
}

// ─── Client HTTP ─────────────────────────────────────────────────────────────

async function req(method, path, body = null) {
  const headers = {}
  const t = token.get()
  if (t) headers['Authorization'] = `Bearer ${t}`
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    if (res.status === 401) {
      token.clear()
      sessionStorage.removeItem('jesa_auth_user')
      window.location.href = '/login'
    }
    let msg = `Erreur ${res.status}`
    try { const err = await res.json(); msg = err.detail || msg } catch {}
    throw new Error(msg)
  }

  return res.json()
}

// ─── Mappers snake_case ↔ camelCase ──────────────────────────────────────────

function mapArret(a) {
  return {
    id:            a.id,
    sessionId:     a.session_id,
    sessionStatus: a.session_status,
    equipId:       a.equip_id,
    startTime:     a.start_time,
    duration:      a.duration,
    frequence:     a.frequence !== undefined ? a.frequence : 1,
    cause:         a.cause,
    zone:          a.zone,
    designation:   a.designation,
    description:   a.description,
    createdAt:     a.created_at,
  }
}

function toApiArret(a) {
  return {
    equip_id:    a.equipId,
    start_time:  a.startTime,
    duration:    a.duration,
    cause:       a.cause       || null,
    zone:        a.zone        || null,
    designation: a.designation || null,
    description: a.description || null,
  }
}

function mapSeuils(s) {
  return {
    n1: { cumul: s.n1_cumul, frequence: s.n1_frequence, horizon: s.n1_horizon },
    n2: { cumul: s.n2_cumul, frequence: s.n2_frequence, horizon: s.n2_horizon },
  }
}

function toApiSeuils(s) {
  return {
    n1_cumul:     s.n1.cumul,
    n1_frequence: s.n1.frequence,
    n1_horizon:   s.n1.horizon,
    n2_cumul:     s.n2.cumul,
    n2_frequence: s.n2.frequence,
    n2_horizon:   s.n2.horizon,
  }
}

function mapSession(s) {
  return {
    id:                 s.id,
    equipId:            s.equip_id,
    siteId:             s.site_id,
    incidentSessionId:  s.incident_session_id,
    titre:          s.titre,
    methode:        s.methode,
    statut:         s.statut,
    niveau:         s.niveau,
    source:         s.source,
    responsable:    s.responsable,
    zone:           s.zone,
    phenomene:      s.phenomene,
    causeArret:     s.cause_arret,
    dateOuverture:  s.date_ouverture,
    dateHeureDebut: s.date_heure_debut,
    dateHeureFin:   s.date_heure_fin,
    tempsAnalyse:   s.temps_analyse,
    cumulArret:     s.cumul_arret,
    frequence:      s.frequence,
    tauxPanne:      s.taux_panne,
    disponibilite:  s.disponibilite,
    participants:    s.participants    || [],
    noeuds:          s.noeuds          || [],
    actionsGenerees: s.actions_generees || [],
    type:            'equipement',
    createdAt:      s.created_at,
    updatedAt:      s.updated_at,
  }
}

function toApiSession(s) {
  return {
    id:               s.id,
    equip_id:         s.equipId,
    titre:            s.titre,
    methode:          s.methode,
    statut:           s.statut,
    niveau:           s.niveau,
    source:           s.source,
    responsable:      s.responsable,
    zone:             s.zone,
    phenomene:        s.phenomene,
    cause_arret:      s.causeArret,
    date_ouverture:   s.dateOuverture,
    date_heure_debut: s.dateHeureDebut,
    date_heure_fin:   s.dateHeureFin,
    temps_analyse:    s.tempsAnalyse,
    cumul_arret:      s.cumulArret,
    frequence:        s.frequence,
    taux_panne:       s.tauxPanne,
    disponibilite:    s.disponibilite,
    participants:     s.participants    || [],
    noeuds:           s.noeuds          || [],
    actions_generees: s.actionsGenerees || [],
  }
}

function mapAction(a) {
  return {
    id:          a.id,
    rcaId:       a.rca_id,
    equipId:     a.equip_id,
    cause:       a.cause,
    action:      a.action,
    responsable: a.responsable,
    delai:       a.delai,
    statut:      a.statut,
    commentaire: a.commentaire,
    rcaTitre:    a.rca_titre,
    createdAt:   a.created_at,
    updatedAt:   a.updated_at,
  }
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export const api = {
  // Auth
  login: async (username, password) => {
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Identifiants incorrects' }))
      throw new Error(err.detail || 'Identifiants incorrects')
    }
    return res.json()
  },

  // TUM — Arrêts
  getArrets:   () => req('GET', '/api/tum/arrets').then(l => l.map(mapArret)),
  deleteArret: (id) => req('DELETE', `/api/tum/arrets/${id}`),

  // TUM — Incidents (session-based)
  startIncident: (arret) => req('POST', '/api/tum/incident/start', {
    equip_id:    arret.equipId,
    start_time:  arret.startTime,
    duration:    arret.duration    || 0,
    cause:       arret.cause       || null,
    zone:        arret.zone        || null,
    designation: arret.designation || null,
    description: arret.description || null,
  }),
  addDuration:        (sessionId, duration) => req('POST', '/api/tum/incident/add-duration', { session_id: sessionId, duration }),
  closeIncident:      (sessionId)           => req('POST', '/api/tum/incident/close',        { session_id: sessionId }),
  getActiveIncident:  (equipId)             => req('GET',  `/api/tum/incident/active/${equipId}`),
  getIncidentHistory: (equipId)             => req('GET',  `/api/tum/incident/history/${equipId}`),

  // TUM — Seuils
  getSeuils:    ()        => req('GET', '/api/tum/seuils').then(mapSeuils),
  updateSeuils: (seuils)  => req('PUT', '/api/tum/seuils', toApiSeuils(seuils)).then(mapSeuils),

  // RCA — Sessions
  getSessions:          ()  => req('GET', '/api/rca/sessions').then(l => l.map(mapSession)),
  getClosedSessionsAll: ()  => req('GET', '/api/rca/sessions-closed-global').then(l => l.map(s => ({
    ...mapSession(s),
    siteName: s.site_nom || s.site_id || '—',
  }))),
  createSession:   (s)   => req('POST',   '/api/rca/sessions', toApiSession(s)).then(mapSession),
  updateSession:   (id, s) => req('PUT',    `/api/rca/sessions/${id}`, toApiSession(s)).then(mapSession),
  deleteSession:   (id)   => req('DELETE', `/api/rca/sessions/${id}`),
  closeRcaSession: (id)   => req('PUT',    `/api/rca/sessions/${id}/close`),

  // RCA — Actions
  getActions:      ()       => req('GET',    '/api/rca/actions').then(l => l.map(mapAction)),
  getActionsByRca: (rcaId)  => req('GET',    `/api/rca/actions/rca/${rcaId}`).then(l => l.map(mapAction)),
  createAction: (a) => req('POST', '/api/rca/actions', {
    rca_id:      a.rcaId,
    cause:       a.cause,
    action:      a.action,
    responsable: a.responsable,
    delai:       a.delai,
    statut:      a.statut,
    commentaire: a.commentaire,
  }).then(mapAction),
  updateAction: (id, a) => req('PUT', `/api/rca/actions/${id}`, {
    cause:       a.cause,
    action:      a.action,
    responsable: a.responsable,
    delai:       a.delai,
    statut:      a.statut,
    commentaire: a.commentaire,
  }).then(mapAction),
  deleteAction: (id) => req('DELETE', `/api/rca/actions/${id}`),

  // Config — Équipements
  getEquipements:    ()       => req('GET', '/api/config/equipements'),
  createEquipement:  (eq)     => req('POST', '/api/config/equipements', eq),
  deleteEquipement:  (id)     => req('DELETE', `/api/config/equipements/${id}`),
  bulkEquipements:   (list)   => req('POST', '/api/config/equipements/bulk', list),

  // Config — Causes
  getCauses:         ()       => req('GET', '/api/config/causes').then(l => l.map(c => c.libelle)),
  getCausesConfig:   ()       => req('GET', '/api/config/causes'),
  bulkCauses:        (libs)   => req('POST', '/api/config/causes/bulk', { libelles: libs }),
  deleteCause:       (id)     => req('DELETE', `/api/config/causes/${id}`),

  // Config — Participants
  getParticipants:   ()       => req('GET', '/api/config/participants'),
  bulkParticipants:  (list)   => req('POST', '/api/config/participants/bulk', { participants: list }),
  deleteParticipant: (id)     => req('DELETE', `/api/config/participants/${id}`),

  // Historique référence (Data2 IA)
  bulkHistoriqueRef: (list) => req('POST', '/api/config/historique-reference/bulk', list),

  // IA
  aiChat:       (data) => req('POST', '/api/ai/chat',    data),
  aiSuggest:    (data) => req('POST', '/api/ai/suggest', data),
  getPredictions:          ()     => req('GET',  '/api/ia/predictions'),
  getCausesIA:             (id)   => req('GET',  `/api/ia/causes/${id}`),
  generateArbre:           (body) => req('POST', '/api/ia/arbre',           body),
  generatePriorisation:    (body) => req('POST', '/api/ia/priorisation',    body),
  generateAmdec:           (body) => req('POST', '/api/ia/amdec',           body),
  generateRecommandations: (body) => req('POST', '/api/ia/recommandations', body),

  // Upload fichier (stockage générique)
  uploadFile: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const headers = {}
    const t = token.get()
    if (t) headers['Authorization'] = `Bearer ${t}`
    const res = await fetch(`${BASE}/api/upload`, { method: 'POST', headers, body: form })
    if (!res.ok) {
      let msg = `Erreur ${res.status}`
      try { const err = await res.json(); msg = err.detail || msg } catch {}
      throw new Error(msg)
    }
    const data = await res.json()
    return { name: data.name, url: `${BASE}${data.url}`, type: data.type }
  },

  // Analyse IA d'un fichier joint (PDF / image) dans un contexte RCA
  aiUploadFile: async (file, equip_id, phenomene, rca_id) => {
    const form = new FormData()
    form.append('file', file)
    form.append('equip_id',  equip_id  || '')
    form.append('phenomene', phenomene || '')
    form.append('rca_id',    rca_id    || '')
    const headers = {}
    const t = token.get()
    if (t) headers['Authorization'] = `Bearer ${t}`
    const res = await fetch(`${BASE}/api/ai/upload-file`, { method: 'POST', headers, body: form })
    if (!res.ok) {
      let msg = `Erreur ${res.status}`
      try { const err = await res.json(); msg = err.detail || msg } catch {}
      throw new Error(msg)
    }
    return res.json()
  },
}
