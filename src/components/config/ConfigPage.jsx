// src/components/config/ConfigPage.jsx
// Design identique au HTML original — pg-config
// Seuils & Configuration : N1/N2 pour Installations Fixes + Mobiles Lourds
// Prévisualisation des règles en temps réel + Sauvegarder + Réinitialiser

import { useState } from 'react'
import C from '../../tokens/colors'

const DEFAULT_SEUILS = {
  fixe: {
    n1DurMin: 4,   n1DurMax: 6,
    n1CoutMin: 50, n1CoutMax: 100,
    n2DurMin: 6,   n2CoutMin: 100,
  },
  mobile: {
    n1DurMin: 12,  n1DurMax: 24,
    n1CoutMin: 10, n1CoutMax: 50,
    n1FreqMax: 2,
    n2DurMin: 24,  n2CoutMin: 50,
  },
}

const fi = {
  width: '100%', padding: '8px 10px',
  border: '1.5px solid #cbd5e1', borderRadius: 8,
  fontSize: 12.5, fontFamily: "'DM Sans',sans-serif",
  outline: 'none', background: '#fff', color: '#0f172a',
  boxSizing: 'border-box', transition: 'border-color .15s',
}
const fl = { fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5, display: 'block' }

// Composant champ numérique
function NumField({ label, value, onChange, min = 0, step = 0.5 }) {
  return (
    <div>
      <label style={fl}>{label}</label>
      <input type="number" style={fi} value={value} min={min} step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        onFocus={e => e.target.style.borderColor = '#1a3a6b'}
        onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
    </div>
  )
}

// Prévisualisation règle pour un type
function PreviewBox({ type, seuils }) {
  const s = seuils[type]
  const isFixe = type === 'fixe'
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#334155', lineHeight: 1.9 }}>
      <div style={{ fontWeight: 700, fontSize: 11, color: '#64748b', letterSpacing: '.8px', textTransform: 'uppercase', marginBottom: 8 }}>
        Prévisualisation des règles actives
      </div>
      <div>
        <span style={{ display: 'inline-block', padding: '1px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#FEFFD6', color: '#d97706', border: '1px solid #fde68a', marginRight: 6 }}>N1</span>
        Durée entre <strong>{s.n1DurMin}h</strong> et <strong>{s.n1DurMax}h</strong> OU coût entre <strong>{s.n1CoutMin}K</strong> et <strong>{s.n1CoutMax}K DH</strong>
        {!isFixe && <> OU fréquence ≤ <strong>{s.n1FreqMax}×/mois</strong></>}
        {' → '}<strong style={{ color: '#d97706' }}>Quick Kaizen suggéré</strong>
      </div>
      <div>
        <span style={{ display: 'inline-block', padding: '1px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', marginRight: 6 }}>N2</span>
        Durée {'>'} <strong>{s.n2DurMin}h</strong> OU coût {'>'} <strong>{s.n2CoutMin}K DH</strong>
        {' → '}<strong style={{ color: '#dc2626' }}>5 Pourquoi obligatoire</strong>
      </div>
    </div>
  )
}

// Bloc seuils pour un type d'installation
function SeuilsBlock({ type, label, icon, seuils, onChange }) {
  const s = seuils[type]
  const isFixe = type === 'fixe'

  const set = (key, val) => onChange(type, { ...s, [key]: val })

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,30,53,.07)' }}>

      {/* Header carte (identique .ch) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>{label}</span>
      </div>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Seuil N1 — orange */}
        <div style={{ background: '#FEFFD6', border: '1.5px solid #fde68a', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#d97706', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
            ⚠️ Seuil N1 — Analyse simple
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <NumField label="Durée min. N1 (h)"   value={s.n1DurMin}  onChange={v => set('n1DurMin', v)} />
            <NumField label="Durée max. N1 (h)"   value={s.n1DurMax}  onChange={v => set('n1DurMax', v)} />
            <NumField label="Coût min. N1 (K DH)" value={s.n1CoutMin} onChange={v => set('n1CoutMin', v)} step={10} />
            <NumField label="Coût max. N1 (K DH)" value={s.n1CoutMax} onChange={v => set('n1CoutMax', v)} step={10} />
            {!isFixe && (
              <div style={{ gridColumn: '1/-1' }}>
                <NumField label="Fréquence max. N1 (×/mois)" value={s.n1FreqMax} onChange={v => set('n1FreqMax', v)} step={1} min={1} />
              </div>
            )}
          </div>
        </div>

        {/* Seuil N2 — rouge */}
        <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
            🚨 Seuil N2 — Analyse avancée
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <NumField label="Durée min. N2 (h)"   value={s.n2DurMin}  onChange={v => set('n2DurMin', v)} />
            <NumField label="Coût min. N2 (K DH)" value={s.n2CoutMin} onChange={v => set('n2CoutMin', v)} step={10} />
          </div>
        </div>

        {/* Prévisualisation */}
        <PreviewBox type={type} seuils={seuils} />
      </div>
    </div>
  )
}

export default function ConfigPage() {
  const [seuils, setSeuils]   = useState(DEFAULT_SEUILS)
  const [saved, setSaved]     = useState(false)

  const handleChange = (type, newVals) => {
    setSeuils(prev => ({ ...prev, [type]: newVals }))
    setSaved(false)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleReset = () => {
    setSeuils(DEFAULT_SEUILS)
    setSaved(false)
  }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>

      {/* ── Header (identique HTML) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleReset}
            style={{ padding: '8px 16px', background: 'transparent', border: '1.5px solid #cbd5e1', borderRadius: 25, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#64748b', fontFamily: "'DM Sans',sans-serif" }}>
            ↺ Valeurs par défaut
          </button>
          <button onClick={handleSave}
            style={{ padding: '8px 22px', background: saved ? '#059669' : '#1a3a6b', color: '#fff', border: 'none', borderRadius: 25, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'background .3s' }}>
            {saved ? '✓ Sauvegardé' : '💾 Sauvegarder'}
          </button>
        </div>
      </div>

      {/* ── Banner info (identique HTML) */}
      <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: '13px 18px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a3a6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <div style={{ fontSize: 12.5, color: '#1a3a6b' }}>
          Ces seuils définissent le déclenchement automatique <strong>N1 / N2</strong> dans le TUM. Le fiabiliste garde toujours la main sur le <strong>choix final de la méthode d'analyse</strong>.
        </div>
      </div>

      {/* ── Grille 2 colonnes (identique HTML g2) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
        <SeuilsBlock type="fixe"   label="Installations Fixes"         icon="🏭" seuils={seuils} onChange={handleChange} />
        <SeuilsBlock type="mobile" label="Équipements Mobiles Lourds"  icon="🏗️" seuils={seuils} onChange={handleChange} />
      </div>

      {/* ── Section TUM Général */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,30,53,.07)', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <span style={{ fontSize: 18 }}>⚙️</span>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>Paramètres TUM Généraux</span>
        </div>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          <div>
            <label style={fl}>Seuil cumul alerte (h)</label>
            <input type="number" style={fi} defaultValue={6} min={1} step={0.5}
              onFocus={e => e.target.style.borderColor = '#1a3a6b'}
              onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Heures cumulées → alerte TUM</div>
          </div>
          <div>
            <label style={fl}>Seuil fréquence alerte (×)</label>
            <input type="number" style={fi} defaultValue={3} min={1} step={1}
              onFocus={e => e.target.style.borderColor = '#1a3a6b'}
              onBlur={e => e.target.style.borderColor = '#cbd5e1'} />
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Nb arrêts → alerte TUM</div>
          </div>
          <div>
            <label style={fl}>Horizon d'observation</label>
            <select style={{ ...fi, cursor: 'pointer' }}
              onFocus={e => e.target.style.borderColor = '#1a3a6b'}
              onBlur={e => e.target.style.borderColor = '#cbd5e1'}>
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
              <option value={90} selected>90 jours</option>
            </select>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Période de calcul cumul</div>
          </div>
        </div>
      </div>

      {/* ── Section Utilisateurs */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,30,53,.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <span style={{ fontSize: 18 }}>👥</span>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>Équipe fiabilité</span>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { nom: 'Chaimae Hamdi',  role: 'Fiabiliste',           site: 'Jorf Lasfar', couleur: '#1a3a6b' },
              { nom: 'Ahmed Fassi',    role: 'Fiabiliste',           site: 'Jorf Lasfar', couleur: '#059669' },
              { nom: 'Karim Benali',   role: 'Sup. Maintenance',     site: 'Jorf Lasfar', couleur: '#d97706' },
              { nom: 'Mohamed Benali', role: 'Technicien Maint.',    site: 'Laâyoune',    couleur: '#7c3aed' },
              { nom: 'Sarah Amrani',   role: 'Ingénieur Process',    site: 'Casablanca',  couleur: '#0891b2' },
              { nom: 'Youssef Oualid', role: 'Fiabiliste',           site: 'Laâyoune',    couleur: '#dc2626' },
            ].map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: u.couleur, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {u.nom.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{u.nom}</div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>{u.role} · {u.site}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
