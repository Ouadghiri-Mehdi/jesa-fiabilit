// src/data/postes_techniques.js
// Source : export SAP PM — Postes techniques OCP Jorf Lasfar

export const POSTES_TECHNIQUES = [
  { id: 'JF08',                             designation: '3MT / 107DEF & OSBL JORF LASFAR',       niveau: 1, eqSeq: 'STADE OP' },
  { id: 'JF08-3M-318A',                     designation: 'ATELIEROSBL',                            niveau: 3, eqSeq: 'STADE OP' },
  { id: 'JF08-3M-318A-00316B-000RIA',       designation: 'RIA DE LA ZONE DE STOCKAGE DU FUEL',     niveau: 5, eqSeq: 'CAPITAL' },
  { id: 'JF08-3M-318A-00316B-00AE03-INST',  designation: 'ESBL DES INST DU RÉCHAUFFEUR DE FUEL',  niveau: 6, eqSeq: 'SOUS-EQUIPEMENT' },
  { id: 'JF08-3M-318A-00316B-00AP11',       designation: 'MTPMP DCHRG CITERNES FUEL OIL',         niveau: 5, eqSeq: 'CAPITAL' },
  { id: 'JF08-3M-318A-00316B-00AP11-000P',  designation: 'MTPMP DCHRG FUEL OIL AP11',             niveau: 6, eqSeq: 'SOUS-EQUIPEMENT' },
  { id: 'JF08-3M-318A-00316B-00AP11-00BC',  designation: 'BT CMD MTPMP DCHRG CTRNOIAP11',         niveau: 6, eqSeq: 'SOUS-EQUIPEMENT' },
]

export const POSTES_IDS = POSTES_TECHNIQUES.map(p => p.id)

export const findPoste = (id) => POSTES_TECHNIQUES.find(p => p.id === id) || null
