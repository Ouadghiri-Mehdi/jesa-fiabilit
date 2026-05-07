// src/components/sap/SAPPage.jsx
// Design identique au HTML original — pg-sap
// Workflow SAP : flux 5 étapes + Fiche d'intervention + tableau OT + export

import { useState } from 'react'
import C from '../../tokens/colors'

// ── Data mock OT SAP
const OT_DATA = [
  {
    id: 'OT-2026-0847', fi: 'FI-2026-1247', equip: 'BRY-B003', famille: 'Broyeur',
    typeOT: 'PM01', typeLabel: 'Ordre Correctif', site: 'Jorf Lasfar — JCF2',
    rcaRef: 'RCA-2026-014', causeRacine: 'Défaut graissage roulement',
    dateCreation: '2026-03-06', datePrevue: '2026-03-20',
    statut: 'en-cours', niveau: 'N2',
  },
  {
    id: 'OT-2026-0841', fi: 'FI-2026-1241', equip: 'CNV-C012', famille: 'Convoyeur',
    typeOT: 'PM02', typeLabel: 'Ordre Préventif', site: 'Jorf Lasfar — JCF1',
    rcaRef: 'RCA-2026-013', causeRacine: 'Tension insuffisante contrepoids',
    dateCreation: '2026-03-04', datePrevue: '2026-03-18',
    statut: 'planifie', niveau: 'N1',
  },
  {
    id: 'OT-2026-0830', fi: 'FI-2026-1230', equip: 'PMP-P041', famille: 'Pompe',
    typeOT: 'PM01', typeLabel: 'Ordre Correctif', site: 'Jorf Lasfar — JCF1',
    rcaRef: 'RCA-2026-009', causeRacine: 'Joint mécanique défaillant',
    dateCreation: '2026-02-26', datePrevue: '2026-03-05',
    statut: 'cloture', niveau: 'N1',
  },
  {
    id: 'OT-2026-0821', fi: 'FI-2026-1221', equip: 'BRY-B001', famille: 'Broyeur',
    typeOT: 'PM03', typeLabel: 'Ordre Amélioration', site: 'Jorf Lasfar — JCF1',
    rcaRef: 'RCA-2026-011', causeRacine: 'Absence plan PM graissage',
    dateCreation: '2026-02-12', datePrevue: '2026-03-01',
    statut: 'cloture', niveau: 'N2',
  },
]

const OT_TYPE_CFG = {
  PM01: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  PM02: { bg: '#eff6ff', color: '#1a3a6b', border: '#bfdbfe' },
  PM03: { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
}

const STATUT_OT = {
  'en-cours': { label: 'En cours',  bg: '#FEFFD6', color: '#d97706', border: '#fde68a', dot: '#d97706' },
  'planifie':  { label: 'Planifié', bg: '#eef2f7', color: '#334155', border: '#d1dbe8', dot: '#334155' },
  'cloture':   { label: 'Clôturé', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', dot: '#059669' },
}

// ── Fiche intervention sélectionnée
const FICHES = {
  'OT-2026-0847': { fi: 'FI-2026-1247', equip: 'BRY-B003', famille: 'Broyeur — Jorf Lasfar', typeArret: 'Panne (UM) — 28h', niveau: 'N2 — 5 Pourquoi', cause: 'Défaut graissage roulement', typeSAP: 'PM01 — Ordre Correctif', responsable: 'Chaimae H.', datePrevue: '20/03/2026' },
  'OT-2026-0841': { fi: 'FI-2026-1241', equip: 'CNV-C012', famille: 'Convoyeur — Jorf Lasfar', typeArret: 'Panne répétitive — 8h', niveau: 'N1 — Quick Kaizen', cause: 'Tension insuffisante contrepoids', typeSAP: 'PM02 — Ordre Préventif', responsable: 'Karim B.', datePrevue: '18/03/2026' },
  'OT-2026-0830': { fi: 'FI-2026-1230', equip: 'PMP-P041', famille: 'Pompe — Jorf Lasfar', typeArret: 'Panne étanchéité — 5.5h', niveau: 'N1 — Quick Kaizen', cause: 'Joint mécanique défaillant', typeSAP: 'PM01 — Ordre Correctif', responsable: 'Y. Oualid', datePrevue: '05/03/2026' },
  'OT-2026-0821': { fi: 'FI-2026-1221', equip: 'BRY-B001', famille: 'Broyeur — Jorf Lasfar', typeArret: 'Panne vibratoire — 3h', niveau: 'N2 — 5 Pourquoi', cause: 'Absence plan PM graissage', typeSAP: 'PM03 — Ordre Amélioration', responsable: 'Ahmed F.', datePrevue: '01/03/2026' },
}

// ── Flux SAP (5 étapes — identique HTML sap-flow)
const FLUX_STEPS = [
  { icon: '📊', label: 'TUM Validé',      sub: 'Données saisies',        statut: 'done' },
  { icon: '🔍', label: 'RCA Finalisée',   sub: '5 Pourquoi clôturé',     statut: 'done' },
  { icon: '⚙️', label: 'Génération Auto', sub: 'Fiche + OT + PDF',       statut: 'active' },
  { icon: '☁️', label: 'Import SAP',      sub: 'Semi-auto / Manuel',     statut: 'attente' },
  { icon: '✅', label: 'OT SAP Créé',     sub: 'Traçabilité',            statut: 'planifie' },
]

const STEP_CFG = {
  done:     { bg: '#ecfdf5', border: '#a7f3d0', tagBg: '#ecfdf5', tagColor: '#059669', tagBorder: '#a7f3d0', tagLabel: '✓' },
  active:   { bg: '#eff6ff', border: '#bfdbfe', tagBg: '#eff6ff', tagColor: '#1a3a6b', tagBorder: '#bfdbfe', tagLabel: 'En cours' },
  attente:  { bg: '#fff',    border: '#e2e8f0', tagBg: '#f1f5f9', tagColor: '#64748b', tagBorder: '#e2e8f0', tagLabel: 'Attente' },
  planifie: { bg: '#fff',    border: '#e2e8f0', tagBg: '#f1f5f9', tagColor: '#64748b', tagBorder: '#e2e8f0', tagLabel: 'Planifié' },
}

const th = { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0', background: '#f8fafc', whiteSpace: 'nowrap' }
const td = { padding: '11px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#334155', verticalAlign: 'middle' }

export default function SAPPage() {
  const [selectedOT, setSelectedOT] = useState('OT-2026-0847')
  const [exported, setExported]     = useState(false)

  const fiche = FICHES[selectedOT]

  const handleExport = () => {
    setExported(true)
    setTimeout(() => setExported(false), 2500)
  }

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>

      {/* ── Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button onClick={handleExport}
          style={{ padding: '8px 20px', background: exported ? '#059669' : '#1a3a6b', color: '#fff', border: 'none', borderRadius: 25, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 7, transition: 'background .3s' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {exported ? '✓ Exporté' : 'Export CSV/SAP'}
        </button>
      </div>

      {/* ── Flux SAP (identique HTML sap-flow) */}
      <div style={{ display: 'flex', alignItems: 'stretch', marginBottom: 22 }}>
        {FLUX_STEPS.map((step, i) => {
          const cfg = STEP_CFG[step.statut]
          const isFirst = i === 0, isLast = i === FLUX_STEPS.length - 1
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'stretch', flex: 1 }}>
              <div style={{
                flex: 1, padding: '16px 12px', textAlign: 'center',
                background: cfg.bg, border: `1.5px solid ${cfg.border}`,
                borderRadius: isFirst ? '8px 0 0 8px' : isLast ? '0 8px 8px 0' : 0,
                borderLeft: i > 0 ? 'none' : undefined,
                boxShadow: step.statut === 'active' ? '0 1px 3px rgba(15,30,53,.07)' : 'none',
              }}>
                <span style={{ fontSize: 24, marginBottom: 7, display: 'block' }}>{step.icon}</span>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>{step.label}</div>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>{step.sub}</div>
                <div style={{ marginTop: 7 }}>
                  <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: cfg.tagBg, color: cfg.tagColor, border: `1px solid ${cfg.tagBorder}` }}>
                    {cfg.tagLabel}
                  </span>
                </div>
              </div>
              {!isLast && (
                <div style={{ display: 'flex', alignItems: 'center', color: '#cbd5e1', fontSize: 20, flexShrink: 0, padding: '0 2px' }}>›</div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Layout 2 colonnes (identique HTML g2) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>

        {/* ── Fiche d'intervention (identique HTML) */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,30,53,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>📄 Fiche d'Intervention</span>
            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#1a3a6b', border: '1px solid #bfdbfe' }}>Auto</span>
          </div>
          <div style={{ padding: 18 }}>
            {/* Sélecteur OT */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 5, display: 'block' }}>Sélectionner un OT</label>
              <select value={selectedOT} onChange={e => setSelectedOT(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: 'none', background: '#fff', color: '#0f172a', cursor: 'pointer' }}>
                {OT_DATA.map(ot => (
                  <option key={ot.id} value={ot.id}>{ot.id} · {ot.equip}</option>
                ))}
              </select>
            </div>

            {/* Fiche monospace (identique HTML) */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, fontFamily: 'monospace', fontSize: 12, lineHeight: 2 }}>
              <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 12, color: '#1a3a6b', marginBottom: 7 }}>
                ══ FICHE INTERVENTION JESA ══
              </div>
              {fiche && [
                ['N° Interne',     <b style={{ color: '#d97706' }}>{fiche.fi}</b>],
                ['Tag Équipement', fiche.equip],
                ['Famille',        fiche.famille],
                ['Type Arrêt',     fiche.typeArret],
                ['Niveau RCA',     <span style={{ color: '#dc2626', fontWeight: 700 }}>{fiche.niveau}</span>],
                ['Cause Racine',   fiche.cause],
                ['Responsable',    fiche.responsable],
                ['Date prévue',    fiche.datePrevue],
                ['Type SAP',       <span style={{ color: '#059669', fontWeight: 700 }}>{fiche.typeSAP}</span>],
              ].map(([label, val], i) => (
                <div key={i}>
                  <span style={{ color: '#64748b', display: 'inline-block', width: 130 }}>{label}</span>
                  {typeof val === 'string' ? val : val}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button style={{ flex: 1, padding: '10px', background: '#1a3a6b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                📥 Télécharger PDF
              </button>
              <button onClick={handleExport}
                style={{ flex: 1, padding: '10px', background: exported ? '#059669' : '#0891b2', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'background .3s' }}>
                {exported ? '✓ Exporté' : '📊 Export CSV/SAP'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Statut Import SAP */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* KPIs SAP */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'OT Créés',    value: OT_DATA.length,                                          color: '#1a3a6b' },
              { label: 'OT Clôturés', value: OT_DATA.filter(o => o.statut === 'cloture').length,      color: '#059669' },
              { label: 'En cours',    value: OT_DATA.filter(o => o.statut === 'en-cours').length,     color: '#d97706' },
              { label: 'Planifiés',   value: OT_DATA.filter(o => o.statut === 'planifie').length,     color: '#334155' },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', borderTop: `3px solid ${k.color}` }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 28, color: '#0f172a' }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Import SAP manuel */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
              ☁️ Import SAP
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#1a3a6b', marginBottom: 14 }}>
                ℹ️ Les fiches sont générées automatiquement. L'import SAP peut se faire en mode <strong>semi-automatique</strong> ou <strong>manuel</strong>.
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button style={{ flex: 1, padding: '10px 14px', background: '#1a3a6b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Import auto
                </button>
                <button style={{ flex: 1, padding: '10px 14px', background: 'transparent', color: '#334155', border: '1.5px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                  Import manuel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tableau OT SAP */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,30,53,.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>📋 Ordres de Travail SAP</span>
          <span style={{ fontSize: 11.5, color: '#64748b' }}>{OT_DATA.length} OT générés</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>
              {['N° OT', 'Fiche', 'Équipement', 'Type SAP', 'Site', 'Réf RCA', 'Cause Racine', 'Date prévue', 'Statut'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {OT_DATA.map((ot, idx) => {
                const sc = STATUT_OT[ot.statut] || STATUT_OT.planifie
                const tc = OT_TYPE_CFG[ot.typeOT] || OT_TYPE_CFG.PM01
                return (
                  <tr key={ot.id}
                    style={{ borderBottom: idx < OT_DATA.length - 1 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer', transition: 'background .1s' }}
                    onClick={() => setSelectedOT(ot.id)}
                    onMouseOver={e => e.currentTarget.style.background = '#fafcff'}
                    onMouseOut={e => e.currentTarget.style.background = ''}>

                    <td style={td}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11.5, color: '#1a3a6b' }}>{ot.id}</div>
                    </td>
                    <td style={td}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#d97706', fontWeight: 600 }}>{ot.fi}</div>
                    </td>
                    <td style={td}>
                      <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 12.5, color: '#1a3a6b' }}>{ot.equip}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{ot.famille}</div>
                    </td>
                    <td style={td}>
                      <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                        {ot.typeOT}
                      </span>
                      <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 3 }}>{ot.typeLabel}</div>
                    </td>
                    <td style={{ ...td, fontSize: 12, color: '#64748b' }}>{ot.site}</td>
                    <td style={td}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: '#1a3a6b' }}>{ot.rcaRef}</span>
                    </td>
                    <td style={{ ...td, maxWidth: 200, color: '#475569', fontSize: 12 }}>{ot.causeRacine}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>
                      {new Date(ot.datePrevue).toLocaleDateString('fr-FR')}
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color, border: `1.5px solid ${sc.border}`, whiteSpace: 'nowrap' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                        {sc.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
