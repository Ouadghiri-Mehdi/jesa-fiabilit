// src/components/rca/QuickKaizen.jsx
// Analyse Quick Kaizen — pour les problèmes N1
// Structure simple : Problème → Cause directe → Solution immédiate → Vérification
// Pas d'arbre, formulaire structuré en 4 sections

import { useState, useEffect } from 'react'
import C from '../../tokens/colors'

const sInput = {
  width: '100%', padding: '10px 14px',
  background: '#fff', border: `1.5px solid ${C.border2}`,
  borderRadius: 8, color: C.text, fontSize: 13,
  fontFamily: "'DM Sans',sans-serif", outline: 'none',
  boxSizing: 'border-box',
}

const SECTIONS = [
  {
    key: 'constat',
    icon: '🔍',
    title: 'Constat du problème',
    desc: 'Décrivez précisément ce qui a été observé',
    placeholder: 'Quelle est la manifestation du problème ? Quand ? Où ? Comment ?',
    statut: true,
  },
  {
    key: 'cause',
    icon: '🎯',
    title: 'Cause directe identifiée',
    desc: 'Quelle est la cause principale probable ?',
    placeholder: 'Cause directe ou immédiate identifiée sur le terrain…',
    statut: true,
  },
  {
    key: 'action',
    icon: '🔧',
    title: 'Action corrective immédiate',
    desc: 'Quelle action corrective a été ou sera menée ?',
    placeholder: 'Action corrective directe pour éliminer la cause identifiée…',
    statut: false,
  },
  {
    key: 'verification',
    icon: '✅',
    title: 'Vérification / Résultat attendu',
    desc: "Comment vérifier l'efficacité de l'action ?",
    placeholder: 'Critère de vérification, indicateur ou mesure attendue…',
    statut: false,
  },
]

const STATUT_CFG = {
  investigation: { label: '? En investigation', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
  valide:        { label: '✓ Validée',          bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  rejete:        { label: '✕ Rejetée',          bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
}

const uid = () => `kz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

export default function QuickKaizen({ noeuds, onChange }) {
  const [data, setData] = useState(() => {
    const saved = noeuds?.[0]?.kaizenData
    if (saved) return saved
    return {
      id: uid(),
      constat: '', constatStatut: 'investigation',
      cause: '', causeStatut: 'investigation',
      action: '', verification: '',
      pieceJointe: null, commentaire: '',
    }
  })

  useEffect(() => {
    // Stocker toutes les données Kaizen dans kaizenData + champs compatibles getFeuilllesValidees()
    const asNoeud = {
      id: data.id,
      texte: data.cause,
      statut: data.causeStatut,
      commentaire: data.commentaire,
      pieceJointe: data.pieceJointe,
      enfants: [],
      kaizenData: { ...data },
    }
    onChange([asNoeud])
  }, [data])

  const update = (patch) => setData(d => ({ ...d, ...patch }))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Quick Kaizen</div>
        <div style={{ fontSize: 12, color: C.text3 }}>Analyse rapide structurée — N1</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {SECTIONS.map((s, idx) => (
          <div key={s.key} style={{
            background: '#fff', border: `1.5px solid ${C.border}`,
            borderRadius: 12, padding: 18,
            borderLeft: `3px solid ${idx < 2 ? C.navy : C.green}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{s.icon}</span> {s.title}
                </div>
                <div style={{ fontSize: 11.5, color: C.text4, marginTop: 3 }}>{s.desc}</div>
              </div>

              {/* Statut selector (seulement pour constat + cause) */}
              {s.statut && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.entries(STATUT_CFG).map(([key, cfg]) => {
                    const currentStatut = data[s.key + 'Statut']
                    return (
                      <button key={key}
                        onClick={() => update({ [s.key + 'Statut']: key })}
                        style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          border: `1.5px solid ${currentStatut === key ? cfg.color : C.border2}`,
                          background: currentStatut === key ? cfg.bg : '#fff',
                          color: currentStatut === key ? cfg.color : C.text4,
                          cursor: 'pointer',
                        }}>
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <textarea
              style={{ ...sInput, minHeight: 72, resize: 'vertical', lineHeight: 1.6 }}
              value={data[s.key]}
              onChange={e => update({ [s.key]: e.target.value })}
              placeholder={s.placeholder}
            />
          </div>
        ))}

        {/* Pièce jointe + commentaire global */}
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 12 }}>📎 Documents justificatifs</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              padding: '8px 16px', borderRadius: 8, border: `1.5px dashed ${C.border2}`,
              background: C.bg, fontSize: 12.5, color: C.text3, fontWeight: 600,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {data.pieceJointe ? data.pieceJointe : 'Joindre un fichier'}
              <input type="file" style={{ display: 'none' }} accept=".pdf,.png,.jpg,.jpeg,.xlsx,.doc,.docx"
                onChange={e => { if (e.target.files[0]) update({ pieceJointe: e.target.files[0].name }) }} />
            </label>

            <textarea
              style={{ ...sInput, flex: 1, minWidth: 200, minHeight: 56, resize: 'vertical' }}
              value={data.commentaire}
              onChange={e => update({ commentaire: e.target.value })}
              placeholder="Commentaire global, observations, références…"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
