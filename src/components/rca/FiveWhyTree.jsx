// src/components/rca/FiveWhyTree.jsx
// MODIFIÉ :
//   ✦ Zoom in / Zoom out sur l'arbre
//   ✦ Lignes de connexion clippées dans le conteneur (overflow: hidden)
//   ✦ Étiquettes de niveau "Pourquoi 1", "Pourquoi 2"… affichées dans la bande supérieure
//   ✦ Popup de confirmation avant suppression d'une cause remplie
//   ✦ Bouton "+ Phénomène" supprimé
//   ✦ Phrase "Les feuilles ✓ sans enfants = causes racines finales." supprimée
//   ✦ Bouton "Valider l'analyse" dans l'en-tête supprimé (seul celui sous l'arbre reste)

import { useState, useCallback } from 'react'
import C from '../../tokens/colors'

const STATUTS = {
  investigation: { label: '?', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', borderCard: '#cbd5e1' },
  valide:        { label: '✓', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', borderCard: '#a7f3d0' },
  rejete:        { label: '✗', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', borderCard: '#fecaca' },
}

const uid = () => `n-${Date.now()}-${Math.random().toString(36).slice(2,6)}`

function updateNode(nodes, id, fn) {
  return nodes.map(n => {
    if (n.id === id) return fn(n)
    if (n.enfants?.length) return { ...n, enfants: updateNode(n.enfants, id, fn) }
    return n
  })
}

function addEnfant(nodes, parentId) {
  return updateNode(nodes, parentId, n => ({
    ...n,
    enfants: [...(n.enfants || []), { id: uid(), texte: '', statut: 'investigation', enfants: [] }]
  }))
}

function removeNode(nodes, id) {
  return nodes.filter(n => n.id !== id).map(n => n.enfants?.length ? { ...n, enfants: removeNode(n.enfants, id) } : n)
}

function cloneTree(nodes) { return JSON.parse(JSON.stringify(nodes)) }

function getFeuilllesValidees(nodes) {
  const result = []
  const walk = (n) => {
    const hasCh = n.enfants?.length > 0
    if (!hasCh && n.statut === 'valide') result.push(n)
    if (hasCh) n.enfants.forEach(walk)
  }
  nodes.forEach(walk)
  return result
}

function getMaxDepth(nodes, current = 0) {
  if (!nodes || nodes.length === 0) return current
  let max = current
  for (const n of nodes) {
    if (n.enfants?.length) max = Math.max(max, getMaxDepth(n.enfants, current + 1))
  }
  return max
}

const LEVEL_LABELS = ['Phénomène', 'Pourquoi 1', 'Pourquoi 2', 'Pourquoi 3', 'Pourquoi 4', 'Pourquoi 5']
const getLevelLabel = (depth) => LEVEL_LABELS[depth] || `Pourquoi ${depth}`

const CARD_W = 170
const H_CONN = 56  // total horizontal connector (32 out + 24 branch)

// ── Popup confirmation suppression
function ConfirmDeletePopup({ onConfirm, onCancel }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background:'#fff', borderRadius:14, width:380, maxWidth:'92vw', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', overflow:'hidden' }}>
        <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'#fef2f2', border:'1.5px solid #fecaca', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:15, color:'#0f172a' }}>Attention</div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Êtes-vous sûr de supprimer cette cause ?</div>
          </div>
        </div>
        <div style={{ padding:'14px 22px', fontSize:13, color:'#475569', lineHeight:1.6 }}>
          Cette action est <strong>irréversible</strong>. La cause et toutes ses sous-causes seront définitivement supprimées.
        </div>
        <div style={{ padding:'12px 22px 18px', display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ padding:'8px 18px', borderRadius:8, border:'1.5px solid #e2e8f0', background:'#fff', fontSize:13, fontWeight:600, color:'#64748b', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
            Annuler
          </button>
          <button onClick={onConfirm} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#dc2626', fontSize:13, fontWeight:700, color:'#fff', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', gap:6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Nœud individuel
function Noeud({ noeud, depth, onChangeStatut, onChangeTexte, onAddDocs, onRemoveDoc, onAddEnfant, onRemove }) {
  const sc = STATUTS[noeud.statut] || STATUTS.investigation
  const isFeuille = !noeud.enfants?.length
  const isCauseRacine = isFeuille && noeud.statut === 'valide'
  const isRejete = noeud.statut === 'rejete'
  const docs = noeud.docs || (noeud.doc ? [noeud.doc] : [])

  return (
    <div style={{ display:'flex', alignItems:'center', position:'relative' }}>
      {/* ── Carte */}
      <div style={{
        width: CARD_W, flexShrink:0,
        background: isCauseRacine ? '#ecfdf5' : isRejete ? '#fef2f2' : '#fff',
        border: `1.5px solid ${sc.borderCard}`,
        borderRadius:8, padding:'8px 10px', position:'relative',
        boxShadow:'0 1px 4px rgba(15,30,53,.07)', opacity: isRejete ? 0.65 : 1,
      }}>
        {/* Statuts + supprimer */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
          <div style={{ display:'flex', gap:3 }}>
            {Object.entries(STATUTS).map(([key, s]) => (
              <button key={key} onClick={() => onChangeStatut(noeud.id, key)}
                title={key === 'investigation' ? 'En investigation' : key === 'valide' ? 'Validée' : 'Rejetée'}
                style={{
                  width:20, height:20, borderRadius:'50%', fontSize:10, fontWeight:800,
                  border:`1.5px solid ${noeud.statut===key ? s.color : '#e2e8f0'}`,
                  background: noeud.statut===key ? s.color : '#fff',
                  color: noeud.statut===key ? '#fff' : '#94a3b8',
                  cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                }}>
                {s.label}
              </button>
            ))}
          </div>
          {depth > 0 && (
            <button onClick={() => onRemove(noeud.id, noeud.texte)}
              style={{ background:'none', border:'none', color:'#cbd5e1', cursor:'pointer', fontSize:15, padding:'0 2px', lineHeight:1 }}>
              ×
            </button>
          )}
        </div>
        {/* Texte */}
        <textarea value={noeud.texte} onChange={e => onChangeTexte(noeud.id, e.target.value)}
          placeholder={depth === 0 ? 'Phénomène observé…' : 'Cause…'}
          style={{ width:'100%', border:'none', outline:'none', resize:'none', fontSize:11.5, color:'#0f172a', background:'transparent', fontFamily:"'DM Sans',sans-serif", lineHeight:1.5, minHeight:40, boxSizing:'border-box', textDecoration: isRejete ? 'line-through' : 'none' }} />
        {isCauseRacine && noeud.texte && (
          <div style={{ marginTop:4, fontSize:9, fontWeight:700, color:'#059669', letterSpacing:'.5px' }}>✦ Cause racine finale</div>
        )}
        {depth > 0 && (
          <div style={{ marginTop:6, marginBottom:2 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:100, overflowY:'auto' }}>
              {docs.map((doc, idx) => (
                <div key={idx} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f1f5f9', borderRadius:4, padding:'3px 6px', fontSize:10, color:'#334155' }}>
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:125 }} title={doc}>📎 {doc}</span>
                  <button onClick={() => onRemoveDoc(noeud.id, idx)} style={{ border:'none', background:'none', cursor:'pointer', color:'#ef4444', fontSize:12, lineHeight:1, marginLeft:4 }}>×</button>
                </div>
              ))}
            </div>
            <label style={{ fontSize:10, color:'#64748b', cursor:'pointer', display:'flex', alignItems:'center', gap:4, padding:'4px 0', marginTop: docs.length ? 4 : 0 }}>
              <span style={{ fontSize:12 }}>📎</span> Joindre fichier(s)
              <input type="file" multiple style={{ display:'none' }} onChange={e => { if (e.target.files?.length) { onAddDocs(noeud.id, Array.from(e.target.files).map(f => f.name)); e.target.value = null } }} />
            </label>
          </div>
        )}
        {!isRejete && (
          <button onClick={() => onAddEnfant(noeud.id)}
            style={{ marginTop:6, width:'100%', padding:'4px 0', background:'#f8fafc', border:'1px dashed #bfdbfe', borderRadius:6, fontSize:10.5, fontWeight:700, color:'#1a3a6b', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}
            onMouseOver={e => { e.currentTarget.style.background='#eff6ff'; e.currentTarget.style.borderColor='#1a3a6b' }}
            onMouseOut={e  => { e.currentTarget.style.background='#f8fafc'; e.currentTarget.style.borderColor='#bfdbfe' }}>
            + Cause
          </button>
        )}
      </div>

      {/* ── Connecteur + enfants */}
      {noeud.enfants?.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', marginLeft:0 }}>
          <div style={{ width:32, height:2, background:'#cbd5e1', flexShrink:0 }} />
          <div style={{ display:'flex', flexDirection:'column' }}>
            {noeud.enfants.map((enfant, i) => {
              const isFirst = i === 0
              const isLast  = i === noeud.enfants.length - 1
              const isOnly  = noeud.enfants.length === 1
              const HALF_GAP = 5
              return (
                <div key={enfant.id} style={{ display:'flex', alignItems:'center', position:'relative', marginBottom: isLast ? 0 : 10 }}>
                  {/* Ligne verticale — uniquement quand plusieurs enfants, reliée exactement de centre à centre */}
                  {!isOnly && (
                    <div style={{
                      position:'absolute', left:-1, width:2, background:'#cbd5e1',
                      top:    isFirst ? '50%' : -HALF_GAP,
                      bottom: isLast  ? '50%' : -HALF_GAP,
                    }} />
                  )}
                  <div style={{ width:24, height:2, background:'#cbd5e1', flexShrink:0 }} />
                  <Noeud noeud={enfant} depth={depth+1} onChangeStatut={onChangeStatut} onChangeTexte={onChangeTexte} onAddDocs={onAddDocs} onRemoveDoc={onRemoveDoc} onAddEnfant={onAddEnfant} onRemove={onRemove} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function FiveWhyTree({ noeuds, onChange, phenomene }) {
  const phenomeneClean = phenomene ? phenomene.replace(/\s*—\s*arrêt\s+forcé\s+[\d.,]+\s*h\b/i, '').trim() : ''
  const [tree, setTree] = useState(() =>
    noeuds?.length ? noeuds : [{ id: uid(), texte: phenomeneClean, statut: 'investigation', enfants: [] }]
  )
  const [zoom, setZoom] = useState(1)
  const [pendingDelete, setPendingDelete] = useState(null)

  const MIN_ZOOM = 0.4, MAX_ZOOM = 1.5, ZOOM_STEP = 0.1

  const push = useCallback((newTree) => { setTree(newTree); onChange(newTree) }, [onChange])

  const handleStatut   = useCallback((id, s)  => push(updateNode(cloneTree(tree), id, n => ({ ...n, statut: s }))), [tree, push])
  const handleTexte    = useCallback((id, t)  => push(updateNode(cloneTree(tree), id, n => ({ ...n, texte: t }))), [tree, push])
  const handleAddDocs  = useCallback((id, ds) => push(updateNode(cloneTree(tree), id, n => ({ ...n, docs:[...(n.docs||(n.doc?[n.doc]:[])), ...ds], doc:undefined }))), [tree, push])
  const handleRemoveDoc= useCallback((id, i)  => push(updateNode(cloneTree(tree), id, n => ({ ...n, docs:(n.docs||(n.doc?[n.doc]:[])).filter((_,j)=>j!==i), doc:undefined }))), [tree, push])
  const handleAddEnfant= useCallback((pid)    => push(addEnfant(cloneTree(tree), pid)), [tree, push])
  const handleRemove   = useCallback((id, texte) => {
    if (texte && texte.trim()) { setPendingDelete({ id }) } else { push(removeNode(cloneTree(tree), id)) }
  }, [tree, push])

  const feuilles = getFeuilllesValidees(tree)
  const maxDepth = getMaxDepth(tree)
  const colWidths = Array.from({ length: maxDepth + 1 }, (_, d) => CARD_W + (d < maxDepth ? H_CONN : 0))

  return (
    <div style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:12, padding:24, boxShadow:'0 1px 3px rgba(15,30,53,.07)' }}>

      {pendingDelete && (
        <ConfirmDeletePopup
          onConfirm={() => { push(removeNode(cloneTree(tree), pendingDelete.id)); setPendingDelete(null) }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:16, color:'#0f172a' }}>Arbre des causes</div>
          <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Développez chaque cause avec <strong>+ Cause</strong>.</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {feuilles.length > 0 && (
            <div style={{ fontSize:12, fontWeight:600, color:'#059669', background:'#ecfdf5', border:'1px solid #a7f3d0', padding:'4px 12px', borderRadius:20 }}>
              ✦ {feuilles.length} cause(s) racine(s)
            </div>
          )}
          {/* Zoom */}
          <div style={{ display:'flex', alignItems:'center', gap:4, background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:20, padding:'3px 10px' }}>
            <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, +(z-ZOOM_STEP).toFixed(1)))} disabled={zoom<=MIN_ZOOM}
              title="Zoom arrière"
              style={{ width:24, height:24, borderRadius:'50%', border:'none', background: zoom<=MIN_ZOOM?'#f1f5f9':'#fff', color: zoom<=MIN_ZOOM?'#cbd5e1':'#1a3a6b', cursor: zoom<=MIN_ZOOM?'not-allowed':'pointer', fontSize:16, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
            <span style={{ fontSize:11, fontWeight:700, color:'#64748b', minWidth:36, textAlign:'center' }}>{Math.round(zoom*100)}%</span>
            <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z+ZOOM_STEP).toFixed(1)))} disabled={zoom>=MAX_ZOOM}
              title="Zoom avant"
              style={{ width:24, height:24, borderRadius:'50%', border:'none', background: zoom>=MAX_ZOOM?'#f1f5f9':'#fff', color: zoom>=MAX_ZOOM?'#cbd5e1':'#1a3a6b', cursor: zoom>=MAX_ZOOM?'not-allowed':'pointer', fontSize:16, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
          </div>
        </div>
      </div>

      {/* Légende */}
      <div style={{ display:'flex', gap:14, marginBottom:16, padding:'8px 14px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0', flexWrap:'wrap' }}>
        <span style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'.5px', textTransform:'uppercase' }}>Statuts :</span>
        {Object.entries(STATUTS).map(([key, s]) => (
          <div key={key} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11.5 }}>
            <div style={{ width:16, height:16, borderRadius:'50%', background:s.color, color:'#fff', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{s.label}</div>
            <span style={{ color:'#64748b' }}>{key==='investigation'?'En investigation':key==='valide'?'Cause validée':'Cause rejetée'}</span>
          </div>
        ))}
      </div>

      {/* Zone arbre — overflow hidden pour couper les lignes extérieures */}
      <div style={{ border:'1px dashed #e2e8f0', borderRadius:8, overflow:'hidden' }}>

        {/* Bande étiquettes de niveau */}
        <div style={{ display:'flex', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', padding:'5px 20px', gap:0 }}>
          {colWidths.map((w, d) => (
            <div key={d} style={{ width: w * zoom, flexShrink:0, display:'flex', alignItems:'center' }}>
              <span style={{
                display:'inline-block', fontSize:10.5, fontWeight:800,
                color:'#64748b', background:'#f1f5f9', border:'1.5px solid #cbd5e1',
                borderRadius:20, padding:'2px 10px', letterSpacing:'.4px', whiteSpace:'nowrap',
              }}>
                {getLevelLabel(d)}
              </span>
            </div>
          ))}
        </div>

        {/* Arbre scrollable + zoomé — overflow hidden sur les deux axes pour couper les lignes qui débordent */}
        <div style={{ overflowX:'auto', overflowY:'hidden', paddingBottom:8 }}>
          <div style={{ transformOrigin:'top left', transform:`scale(${zoom})`, transition:'transform .2s ease', width:`${100/zoom}%`, display:'flex', flexDirection:'column', gap:20, padding:20, minWidth:'max-content' }}>
            {tree.map(noeud => (
              <Noeud key={noeud.id} noeud={noeud} depth={0}
                onChangeStatut={handleStatut} onChangeTexte={handleTexte}
                onAddDocs={handleAddDocs} onRemoveDoc={handleRemoveDoc}
                onAddEnfant={handleAddEnfant} onRemove={handleRemove}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}