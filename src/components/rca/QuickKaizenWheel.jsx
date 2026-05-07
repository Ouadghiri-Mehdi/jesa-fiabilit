// src/components/rca/QuickKaizenWheel.jsx
// P → "PROBLÈME OBSERVÉ" + QQOQCP
// D → "CAUSES POSSIBLES"
// C → tableau synchronisé D : Cause | Test | Résultat ✓/✗
// A → causes REJETÉES de C + bouton "Générer les actions"
//     → appelle onGenererActions(actions[]) vers RCADetail

import { useState } from 'react'
import C from '../../tokens/colors'

const STEPS = {
  plan:  { letter:'P', label:'PROBLÈME',      sub:'Identifier le problème',    bg:'#F2F724', color:'#8a8000', headerBg:'#FEFFD6', borderColor:'#F2F724' },
  do:    { letter:'C', label:'CAUSES POSSIBLES', sub:'Lister les hypothèses',  bg:'#2980b9', color:'#1a5276', headerBg:'#e3f2fd', borderColor:'#2980b9' },
  check: { letter:'V', label:'VÉRIFICATION',  sub:'Vérifier les causes',       bg:'#1a3a6b', color:'#1a3a6b', headerBg:'#e8edf5', borderColor:'#1a3a6b' },
  act:   { letter:'A', label:'ACTIONS',        sub:'Causes rejetées & actions', bg:'#0aaa8a', color:'#0aaa8a', headerBg:'#e0f5f0', borderColor:'#0aaa8a' },
}
const ORDER = ['plan', 'do', 'check', 'act']
const fi = { width:'100%', padding:'8px 10px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:12, fontFamily:"'DM Sans',sans-serif", outline:'none', color:'#1e293b', background:'#fff', boxSizing:'border-box', transition:'border-color .15s' }
const ta = { width:'100%', border:'none', background:'transparent', fontSize:12, fontFamily:"'DM Sans',sans-serif", outline:'none', color:'#1e293b', resize:'none', minHeight:24, lineHeight:1.4 }

// ── Panel P ───────────────────────────────────────────────────────────────────
function PanelProblem({ data, onChange }) {
  const [showQQ, setShowQQ] = useState(false)
  const set = (k, v) => onChange({ ...data, [k]: v })
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
        <div style={{ width:22, height:22, borderRadius:'50%', background:'#F2F724', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:9, fontWeight:900, color:'#8a8000' }}>P</span>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:'#8a8000', textTransform:'uppercase', letterSpacing:'.8px' }}>PROBLÈME OBSERVÉ</span>
      </div>
      <input value={data.titre||''} onChange={e=>set('titre',e.target.value)}
        placeholder="Description du phénomène observé..."
        style={{ ...fi, border:'2px solid #F2F724', borderRadius:9, background:'#FEFFD6', fontSize:13, fontWeight:700 }} />
      <div>
        <button onClick={()=>setShowQQ(v=>!v)}
          style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 14px', background:'#FEFFD6', border:'1.5px solid #F2F724', borderRadius:8, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", width:'100%', boxSizing:'border-box', marginTop:2 }}>
          <span style={{ fontSize:12, fontWeight:600, color:'#8a8000', flex:1, textAlign:'center' }}>Méthode QQOQCP</span>
          <span style={{ fontSize:10, color:'#8a8000', fontWeight:500, flexShrink:0 }}>{showQQ?'− Masquer':'+ Afficher'}</span>
        </button>
        {showQQ && (
          <div style={{ marginTop:6, border:'1.5px solid #F2F724', borderRadius:9, padding:'14px 16px', background:'#fff' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              {[['ou','OÙ ?','Ligne, zone, secteur...'],['quand','QUAND ?','Date, heure, shift...']].map(([k,l,p])=>(
                <div key={k} style={{ background:'#f8fafc', borderRadius:7, padding:'6px 9px' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#64748b', letterSpacing:'.8px', textTransform:'uppercase', marginBottom:6 }}>{l}</div>
                  <textarea value={data[k]||''} onChange={e=>set(k,e.target.value)} placeholder={p} style={ta} />
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              {[['qui','QUI ?','Opérateur, équipe...'],['comment','COMMENT ?','Mode de défaillance...']].map(([k,l,p])=>(
                <div key={k} style={{ background:'#f8fafc', borderRadius:7, padding:'6px 9px' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#64748b', letterSpacing:'.8px', textTransform:'uppercase', marginBottom:6 }}>{l}</div>
                  <textarea value={data[k]||''} onChange={e=>set(k,e.target.value)} placeholder={p} style={ta} />
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[['combien','COMBIEN ?','Durée, fréquence...'],['pourquoi','POURQUOI ?','Première hypothèse...']].map(([k,l,p])=>(
                <div key={k} style={{ background:'#f8fafc', borderRadius:7, padding:'6px 9px' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'#64748b', letterSpacing:'.8px', textTransform:'uppercase', marginBottom:6 }}>{l}</div>
                  <textarea value={data[k]||''} onChange={e=>set(k,e.target.value)} placeholder={p} style={ta} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Panel D ───────────────────────────────────────────────────────────────────
function PanelDo({ data, onChange }) {
  const causes = data.causes||['']
  const setCauses = c => onChange({ ...data, causes:c })
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <div style={{ width:22, height:22, borderRadius:'50%', background:'#2980b9', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:9, fontWeight:900, color:'#fff' }}>C</span>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:'#1a5276', textTransform:'uppercase', letterSpacing:'.8px' }}>CAUSES POSSIBLES</span>
      </div>
      <div style={{ background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:8, padding:'9px 13px', marginBottom:14, display:'flex', alignItems:'flex-start', gap:8 }}>
        <span style={{ fontSize:13, flexShrink:0 }}>🧩</span>
        <div style={{ fontSize:11, color:'#1a5276', lineHeight:1.5 }}>Listez <strong>toutes les hypothèses</strong> qui pourraient expliquer l'écart par rapport au fonctionnement normal.</div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:10 }}>
        {causes.map((c,i)=>(
          <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ width:26, height:26, borderRadius:'50%', background:'#e3f2fd', border:'1.5px solid #2980b9', color:'#1a5276', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</span>
            <input value={c} onChange={e=>{const n=[...causes];n[i]=e.target.value;setCauses(n)}}
              placeholder="Ex: manque maintenance, surcharge, pièce défectueuse..."
              style={{ ...fi, flex:1 }}
              onFocus={e=>e.target.style.borderColor='#94a3b8'}
              onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
            {causes.length>1&&(
              <button onClick={()=>setCauses(causes.filter((_,j)=>j!==i))}
                style={{ background:'none', border:'none', color:'#cbd5e1', cursor:'pointer', fontSize:18, lineHeight:1, padding:'0 4px' }}
                onMouseOver={e=>e.currentTarget.style.color='#ef4444'}
                onMouseOut={e=>e.currentTarget.style.color='#cbd5e1'}>×</button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'center', marginTop:4 }}>
        <button onClick={()=>setCauses([...causes,''])}
          style={{ padding:'6px 18px', border:'1.5px dashed #2980b9', borderRadius:20, background:'transparent', color:'#2980b9', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}
          onMouseOver={e=>e.currentTarget.style.background='#e3f2fd'}
          onMouseOut={e=>e.currentTarget.style.background='transparent'}>
          + Ajouter une cause possible
        </button>
      </div>
    </div>
  )
}

// ── Panel C ───────────────────────────────────────────────────────────────────
function PanelCheck({ data, onChange, causesDo }) {
  const causesActives = (causesDo||[]).filter(c=>c.trim())
  const rows = causesActives.map((cause,i)=>({
    cause,
    test:        data.rows?.[i]?.test        || '',
    resultat:    data.rows?.[i]?.resultat    || null,
    pieceJointe: data.rows?.[i]?.pieceJointe || null,
  }))
  const setRow = (i,field,value) => {
    const updated = rows.map((r,j)=>j===i?{...r,[field]:value}:r)
    onChange({ ...data, rows:updated })
  }

  if(causesActives.length===0) return (
    <div style={{ padding:'32px 20px', textAlign:'center', background:'#f8fafc', borderRadius:10, border:'1.5px dashed #cbd5e1' }}>
      <div style={{ fontSize:24, marginBottom:8 }}>🧩</div>
      <div style={{ fontSize:13, color:'#64748b', fontWeight:600 }}>Aucune cause à vérifier</div>
      <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:4 }}>Ajoutez des causes dans l'étape C d'abord.</div>
    </div>
  )

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <div style={{ width:22, height:22, borderRadius:'50%', background:'#1a3a6b', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:9, fontWeight:900, color:'#fff' }}>V</span>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:'#1a3a6b', textTransform:'uppercase', letterSpacing:'.8px' }}>VÉRIFICATION</span>
      </div>

      <div style={{ borderRadius:10, border:'1.5px solid #e2e8f0', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width:'30%' }} />
            <col style={{ width:'33%' }} />
            <col style={{ width:'16%' }} />
            <col style={{ width:'21%' }} />
          </colgroup>
          <thead>
            <tr style={{ background:'#1a3a6b' }}>
              {['Cause possible','Test réalisé','Résultat','Pièce jointe'].map((h,i)=>(
                <th key={i} style={{ padding:'10px 14px', textAlign: i===2?'center':'left', fontSize:10, fontWeight:700, color:'#fff', letterSpacing:'1px', textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,i)=>{
              const isValide = row.resultat==='valide'
              const isRejete = row.resultat==='rejete'
              const rowBg = isValide?'#ecfdf5':isRejete?'#fef2f2':i%2===0?'#fff':'#f8fafc'
              return (
                <tr key={i} style={{ background:rowBg, borderBottom:'1px solid #e9eef5', transition:'background .15s' }}>

                  {/* Cause */}
                  <td style={{ padding:'11px 14px', verticalAlign:'middle' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:20, height:20, borderRadius:'50%', background:'#eef2f7', border:'1.5px solid #c8d4e8', color:'#1a3a6b', fontSize:9.5, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</span>
                      <span style={{ fontSize:12, color:'#1e293b', fontWeight:600, lineHeight:1.4 }}>{row.cause}</span>
                    </div>
                  </td>

                  {/* Test */}
                  <td style={{ padding:'9px 12px', verticalAlign:'middle' }}>
                    <input value={row.test} onChange={e=>setRow(i,'test',e.target.value)}
                      placeholder="Décrire le test effectué..."
                      style={{ ...fi, fontSize:11.5, padding:'7px 10px', width:'100%', boxSizing:'border-box' }}
                      onFocus={e=>e.target.style.borderColor='#1a3a6b'}
                      onBlur={e=>e.target.style.borderColor='#e2e8f0'} />
                  </td>

                  {/* Résultat ✓ / ✗ */}
                  <td style={{ padding:'9px 10px', textAlign:'center', verticalAlign:'middle' }}>
                    <div style={{ display:'inline-flex', gap:6, justifyContent:'center' }}>
                      <button onClick={()=>setRow(i,'resultat',isValide?null:'valide')}
                        title="BON"
                        style={{ width:48, height:32, borderRadius:20, fontSize:11, fontWeight:800, cursor:'pointer', border:isValide?'2px solid #059669':'1.5px solid #a7f3d0', background:isValide?'#059669':'#ecfdf5', color:isValide?'#fff':'#059669', transition:'all .15s', lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        BON
                      </button>
                      <button onClick={()=>setRow(i,'resultat',isRejete?null:'rejete')}
                        title="Toujours le problème"
                        style={{ width:32, height:32, borderRadius:'50%', fontSize:14, fontWeight:800, cursor:'pointer', border:isRejete?'2px solid #dc2626':'1.5px solid #fecaca', background:isRejete?'#dc2626':'#fef2f2', color:isRejete?'#fff':'#dc2626', transition:'all .15s', lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        ✗
                      </button>
                    </div>
                  </td>

                  {/* Pièce jointe */}
                  <td style={{ padding:'9px 12px', verticalAlign:'middle' }}>
                    {row.pieceJointe ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 8px', background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:6 }}>
                          <span style={{ fontSize:12 }}>📎</span>
                          <span style={{ fontSize:10.5, color:'#0369a1', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }} title={row.pieceJointe}>
                            {row.pieceJointe}
                          </span>
                        </div>
                        <button onClick={()=>setRow(i,'pieceJointe',null)}
                          style={{ fontSize:9.5, color:'#94a3b8', background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0, fontFamily:"'DM Sans',sans-serif" }}>
                          × Retirer
                        </button>
                      </div>
                    ) : (
                      <label style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', background:'#f8fafc', border:'1.5px dashed #cbd5e1', borderRadius:7, cursor:'pointer', fontSize:11, color:'#64748b', fontWeight:600, transition:'all .15s' }}
                        onMouseOver={e=>{e.currentTarget.style.borderColor='#1a3a6b';e.currentTarget.style.color='#1a3a6b';e.currentTarget.style.background='#eff6ff'}}
                        onMouseOut={e=>{e.currentTarget.style.borderColor='#cbd5e1';e.currentTarget.style.color='#64748b';e.currentTarget.style.background='#f8fafc'}}>
                        <span style={{ fontSize:13 }}>📎</span>
                        Joindre
                        <input type="file" style={{ display:'none' }} accept=".pdf,.png,.jpg,.jpeg,.xlsx,.doc,.docx"
                          onChange={e=>{if(e.target.files?.[0]) setRow(i,'pieceJointe',e.target.files[0].name); e.target.value=null}} />
                      </label>
                    )}
                  </td>

                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.some(r=>r.resultat)&&(
        <div style={{ marginTop:10, display:'flex', gap:14, fontSize:11.5, flexWrap:'wrap' }}>
          <span style={{ color:'#059669', fontWeight:700 }}>✓ {rows.filter(r=>r.resultat==='valide').length} BON</span>
          <span style={{ color:'#dc2626', fontWeight:700 }}>✗ {rows.filter(r=>r.resultat==='rejete').length} Toujours le problème</span>
          <span style={{ color:'#64748b' }}>— {rows.filter(r=>!r.resultat).length} non traitée(s)</span>
          {rows.some(r=>r.pieceJointe)&&(
            <span style={{ color:'#0369a1', fontWeight:700 }}>📎 {rows.filter(r=>r.pieceJointe).length} pièce(s) jointe(s)</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Panel A ───────────────────────────────────────────────────────────────────
function PanelAct({ checkRows, onGenererActions }) {
  const causesRejetees = (checkRows||[]).filter(r=>r.resultat==='rejete')

  const handleGenerer = () => {
    const actions = causesRejetees.map((r,i) => ({
      id:          `act-kz-${Date.now()}-${i}`,
      cause:       r.cause,
      action:      '',
      responsable: '',
      delai:       '',
      statut:      'pas-commence',
    }))
    onGenererActions(actions)
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <div style={{ width:22, height:22, borderRadius:'50%', background:'#0aaa8a', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:9, fontWeight:900, color:'#fff' }}>A</span>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color:'#0aaa8a', textTransform:'uppercase', letterSpacing:'.8px' }}>ACTIONS</span>
      </div>
      {causesRejetees.length===0 ? (
        <div style={{ padding:'28px 20px', textAlign:'center', background:'#f8fafc', borderRadius:10, border:'1.5px dashed #cbd5e1' }}>
          <div style={{ fontSize:22, marginBottom:8 }}>🔍</div>
          <div style={{ fontSize:13, color:'#64748b', fontWeight:600 }}>Aucune cause rejetée</div>
          <div style={{ fontSize:11.5, color:'#94a3b8', marginTop:4 }}>Retournez à l'étape V et marquez des causes comme ✗ Rejetée.</div>
        </div>
      ) : (
        <>
          {/* ── Tableau : Causes confirmées à traiter + pièces jointes */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
            <div style={{ padding:'9px 14px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', gap:8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0aaa8a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              <span style={{ fontSize:11, fontWeight:700, color:'#0f172a', textTransform:'uppercase', letterSpacing:'.7px' }}>Causes confirmées à traiter</span>
              <span style={{ fontSize:10, fontWeight:700, color:'#0369a1', letterSpacing:'.4px' }}>📎 Pièce jointe</span>
              <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, color:'#fff', background:'#0aaa8a', borderRadius:20, padding:'2px 8px' }}>{causesRejetees.length}</span>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, tableLayout:'fixed' }}>
              <colgroup>
                <col style={{ width:50 }} />
                <col />
              </colgroup>
              <thead>
                <tr style={{ background:'#fafcff', borderBottom:'1px solid #e9eef5' }}>
                  <th style={{ padding:'8px 14px', fontSize:9.5, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'1px' }}>Rang</th>
                </tr>
              </thead>
              <tbody>
                {causesRejetees.map((r, i) => (
                  <tr key={i} style={{ borderBottom: i < causesRejetees.length - 1 ? '1px solid #f1f5f9' : 'none', background: i%2===0?'#fff':'#fafcff' }}>
                    <td style={{ padding:'10px 14px', textAlign:'center' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:22, height:22, borderRadius:'50%', background:'#fef2f2', border:'1.5px solid #fecaca', color:'#dc2626', fontSize:10, fontWeight:800 }}>
                        {i+1}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      {r.pieceJointe ? (
                        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', background:'#f0f9ff', border:'1.5px solid #bae6fd', borderRadius:8 }}>
                          <span style={{ fontSize:16 }}>📎</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:10, fontWeight:700, color:'#0369a1', letterSpacing:'.4px', marginBottom:1 }}>PIÈCE JOINTE</div>
                            <div style={{ fontSize:11.5, color:'#0c4a6e', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.pieceJointe}>
                              {r.pieceJointe}
                            </div>
                          </div>

                        </div>
                      ) : (
                        <span style={{ fontSize:11, color:'#cbd5e1', fontStyle:'italic' }}>Aucune pièce jointe</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bouton Générer les actions */}
          <div style={{ display:'flex', justifyContent:'center' }}>
            <button
              onClick={handleGenerer}
              style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'13px 32px',
                background:'linear-gradient(135deg, #0aaa8a 0%, #059669 100%)',
                border:'none', borderRadius:14,
                fontSize:14, fontWeight:800, color:'#fff',
                cursor:'pointer', fontFamily:"'DM Sans',sans-serif",
                boxShadow:'0 4px 16px rgba(10,170,138,.40)',
                transition:'all .2s',
              }}
              onMouseOver={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(10,170,138,.50)'}}
              onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 4px 16px rgba(10,170,138,.40)'}}
            >
              <div style={{ width:34, height:34, borderRadius:10, background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:14, fontWeight:800, lineHeight:1.2 }}>Générer les actions</div>
                <div style={{ fontSize:11, opacity:.8, marginTop:2, fontWeight:500 }}>
                  {causesRejetees.length} action(s) corrective(s) à créer
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function QuickKaizenWheel({ noeuds, onChange, phenomene, onGenererActions }) {
  const [active, setActive] = useState('plan')
  const [saved,  setSaved]  = useState({ plan:false, do:false, check:false, act:false })
  const [data,   setData]   = useState(() => {
    const saved = noeuds?.[0]?.kaizenWheelData
    if (saved) return saved
    return {
      plan:  { titre:phenomene||'', ou:'', quand:'', qui:'', comment:'', combien:'', pourquoi:'' },
      do:    { causes:[''] },
      check: { rows:[] },
      act:   {},
    }
  })

  const step = STEPS[active]
  const causesDo  = (data.do?.causes||[]).filter(c=>c.trim())
  const checkRows = (data.check?.rows||[]).map((r,i)=>({ ...r, cause:causesDo[i]||r.cause||'' }))

  const handleChange = (stepKey, newData) => {
    const updated = { ...data, [stepKey]:newData }
    setData(updated)
    const rejetees = (updated.check?.rows||[]).filter(r=>r.resultat==='rejete')
    onChange([{
      id:'kz-root', texte:updated.plan?.titre||'',
      statut: rejetees.length>0?'valide':'investigation',
      commentaire:updated.plan?.titre||'', pieceJointe:null, enfants:[],
      kaizenWheelData: { ...updated },
    }])
  }

  const handleSave = () => {
    setSaved(s=>({ ...s, [active]:true }))
    const idx = ORDER.indexOf(active)
    if(idx < ORDER.length-1) setActive(ORDER[idx+1])
  }

  return (
    <div>
      <div style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:12, padding:'20px 20px 24px', display:'grid', gridTemplateColumns:'200px 1fr', gap:12, alignItems:'start', boxShadow:'0 4px 20px rgba(15,30,53,.07)' }}>

        <div style={{ gridColumn:'1/-1', marginBottom:10 }}>
          <div style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:22, color:'#0f172a' }}>Quick Kaizen</div>
        </div>

        {/* Colonne gauche : roue */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
          <div style={{ position:'relative', width:210, height:210 }}>
            <svg viewBox="0 0 220 220" width="210" height="210" style={{ overflow:'visible', display:'block' }}>
              <path d="M110,110 L110,24 A86,86,0,0,1,196,110 Z" fill={active==='plan'?'#f5e070':'#FEFFD6'} stroke="#fff" strokeWidth="3" style={{ cursor:'pointer', transition:'fill .18s' }} onClick={()=>setActive('plan')} onMouseOver={e=>e.currentTarget.setAttribute('fill','#f5e070')} onMouseOut={e=>e.currentTarget.setAttribute('fill',active==='plan'?'#f5e070':'#FEFFD6')} />
              <path d="M110,110 L196,110 A86,86,0,0,1,110,196 Z" fill={active==='do'?'#90c8e8':'#e3f2fd'} stroke="#fff" strokeWidth="3" style={{ cursor:'pointer', transition:'fill .18s' }} onClick={()=>setActive('do')} onMouseOver={e=>e.currentTarget.setAttribute('fill','#90c8e8')} onMouseOut={e=>e.currentTarget.setAttribute('fill',active==='do'?'#90c8e8':'#e3f2fd')} />
              <path d="M110,110 L110,196 A86,86,0,0,1,24,110 Z" fill={active==='check'?'#1a3a6b':'#dbeafe'} stroke="#fff" strokeWidth="3" style={{ cursor:'pointer', transition:'fill .18s' }} onClick={()=>setActive('check')} onMouseOver={e=>e.currentTarget.setAttribute('fill','#1a3a6b')} onMouseOut={e=>e.currentTarget.setAttribute('fill',active==='check'?'#1a3a6b':'#dbeafe')} />
              <path d="M110,110 L24,110 A86,86,0,0,1,110,24 Z" fill={active==='act'?'#059669':'#d1fae5'} stroke="#fff" strokeWidth="3" style={{ cursor:'pointer', transition:'fill .18s' }} onClick={()=>setActive('act')} onMouseOver={e=>e.currentTarget.setAttribute('fill','#059669')} onMouseOut={e=>e.currentTarget.setAttribute('fill',active==='act'?'#059669':'#d1fae5')} />
              <path d="M112,22 A90,90,0,0,1,198,110" fill="none" stroke="#F2F724" strokeWidth="14" strokeLinecap="round" style={{ cursor:'pointer' }} onClick={()=>setActive('plan')} />
              <path d="M198,112 A90,90,0,0,1,110,198" fill="none" stroke="#2980b9" strokeWidth="14" strokeLinecap="round" style={{ cursor:'pointer' }} onClick={()=>setActive('do')} />
              <path d="M108,198 A90,90,0,0,1,22,110" fill="none" stroke="#1a3a6b" strokeWidth="14" strokeLinecap="round" style={{ cursor:'pointer' }} onClick={()=>setActive('check')} />
              <path d="M22,108 A90,90,0,0,1,110,22" fill="none" stroke="#0aaa8a" strokeWidth="14" strokeLinecap="round" style={{ cursor:'pointer' }} onClick={()=>setActive('act')} />
              <circle cx="110" cy="110" r="30" fill="#1a3a6b" stroke="#fff" strokeWidth="3"/>
              <text x="110" y="105" textAnchor="middle" fontSize="7" fontWeight="900" fill="#ffffff" fontFamily="DM Sans,sans-serif" letterSpacing="1.2">QUICK</text>
              <text x="110" y="115" textAnchor="middle" fontSize="7" fontWeight="900" fill="#ffffff" fontFamily="DM Sans,sans-serif" letterSpacing="1.2">KAIZEN</text>
              <text x="110" y="124" textAnchor="middle" fontSize="5.5" fill="rgba(255,255,255,.5)" fontFamily="DM Sans,sans-serif">Deming</text>
              <rect x="145" y="52" width="22" height="22" rx="5" fill="#F2F724"/>
              <text x="156" y="67" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" fontFamily="DM Sans,sans-serif" style={{ pointerEvents:'none' }}>P</text>
              <rect x="140" y="148" width="28" height="22" rx="5" fill="#2980b9"/>
              <text x="154" y="163" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" fontFamily="DM Sans,sans-serif" style={{ pointerEvents:'none' }}>C</text>
              <rect x="50" y="148" width="22" height="22" rx="5" fill="#1a3a6b"/>
              <text x="61" y="163" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" fontFamily="DM Sans,sans-serif" style={{ pointerEvents:'none' }}>V</text>
              <rect x="50" y="52" width="22" height="22" rx="5" fill="#0aaa8a"/>
              <text x="61" y="67" textAnchor="middle" fontSize="13" fontWeight="900" fill="#fff" fontFamily="DM Sans,sans-serif" style={{ pointerEvents:'none' }}>A</text>
              <path d="M160,26 Q202,60 200,112" fill="none" stroke="#F2F724" strokeWidth="1.8" strokeDasharray="4,3" opacity=".6"/>
              <polygon points="200,112 193,100 204,102" fill="#F2F724" opacity=".7"/>
            </svg>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:5, width:'100%' }}>
            {[
              { key:'plan',  letter:'P', label:'PROBLÈME',      bg:'#F2F724', color:'#8a8000' },
              { key:'do',    letter:'C', label:'CAUSES POSSIBLES', bg:'#2980b9', color:'#1a5276' },
              { key:'check', letter:'V', label:'VÉRIFICATION',    bg:'#1a3a6b', color:'#1a3a6b' },
              { key:'act',   letter:'A', label:'ACTIONS',         bg:'#0aaa8a', color:'#0aaa8a' },
            ].map(s=>(
              <div key={s.key} onClick={()=>setActive(s.key)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:7, cursor:'pointer', border:`2px solid ${active===s.key?s.bg:'transparent'}`, background:active===s.key?STEPS[s.key].headerBg:'#f8fafc', transition:'all .15s' }}>
                <div style={{ width:20, height:20, borderRadius:'50%', background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:8.5, fontWeight:900, color:s.key==='plan'?'#8a8000':'#fff' }}>{s.letter}</span>
                </div>
                <span style={{ fontSize:10.5, fontWeight:700, color:s.color, flex:1 }}>{s.label}</span>
                <div style={{ width:7, height:7, borderRadius:'50%', background:saved[s.key]?s.bg:'#e2e8f0', flexShrink:0 }} />
              </div>
            ))}
          </div>
        </div>

        {/* Colonne droite : panel */}
        <div style={{ minHeight:320, animation:'fadeUp .2s ease' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
            {active==='plan'  && <PanelProblem data={data.plan}  onChange={d=>handleChange('plan',d)} />}
            {active==='do'    && <PanelDo      data={data.do}    onChange={d=>handleChange('do',d)} />}
            {active==='check' && <PanelCheck   data={data.check} onChange={d=>handleChange('check',d)} causesDo={data.do?.causes||[]} />}
            {active==='act'   && <PanelAct     checkRows={checkRows} onGenererActions={onGenererActions} />}
          </div>

          {/* Bouton "Valider étape" — sauf sur A qui a son propre bouton */}
          {active!=='act' && (
            <div style={{ marginTop:16 }}>
              <button onClick={handleSave}
                style={{ padding:'8px 20px', background:step.bg, border:'none', borderRadius:8, fontSize:12.5, fontWeight:700, color:active==='plan'?'#8a8000':'#fff', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", transition:'opacity .15s' }}
                onMouseOver={e=>e.currentTarget.style.opacity='.85'}
                onMouseOut={e=>e.currentTarget.style.opacity='1'}>
                ✓ Valider
              </button>
            </div>
          )}


        </div>
      </div>


    </div>
  )
}