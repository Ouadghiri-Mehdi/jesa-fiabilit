// Base des équipements suivis — remplaçable par appel API
// Importé dans : ImportExcel.jsx, SaisieManuelle.jsx, CumulCalculator.js

export const EQUIPMENT_LIST = [
  { id: 'BRY-B001', famille: 'Broyeur',   site: 'Jorf Lasfar', entite: 'JCF1' },
  { id: 'BRY-B002', famille: 'Broyeur',   site: 'Jorf Lasfar', entite: 'JCF1' },
  { id: 'BRY-B003', famille: 'Broyeur',   site: 'Jorf Lasfar', entite: 'JCF2' },
  { id: 'BRY-B004', famille: 'Broyeur',   site: 'Jorf Lasfar', entite: 'JCF2' },
  { id: 'BRY-B009', famille: 'Broyeur',   site: 'Laâyoune',    entite: 'Laâyoune' },
  { id: 'BRY-B014', famille: 'Broyeur',   site: 'Jorf Lasfar', entite: 'JCF2' },
  { id: 'BRY-B016', famille: 'Broyeur',   site: 'Casablanca',  entite: 'Casa-Industrie' },
  { id: 'CNV-C012', famille: 'Convoyeur', site: 'Jorf Lasfar', entite: 'JCF1' },
  { id: 'CNV-C018', famille: 'Convoyeur', site: 'Casablanca',  entite: 'Casa-Industrie' },
  { id: 'CNV-C027', famille: 'Convoyeur', site: 'Laâyoune',    entite: 'Laâyoune' },
  { id: 'CNV-C031', famille: 'Convoyeur', site: 'Jorf Lasfar', entite: 'JCF3' },
  { id: 'PMP-P033', famille: 'Pompe',     site: 'Laâyoune',    entite: 'Laâyoune' },
  { id: 'PMP-P041', famille: 'Pompe',     site: 'Jorf Lasfar', entite: 'JCF1' },
  { id: 'PMP-P052', famille: 'Pompe',     site: 'Jorf Lasfar', entite: 'JCF1' },
  { id: 'PMP-P061', famille: 'Pompe',     site: 'Casablanca',  entite: 'Casa-Industrie' },
  { id: 'PMP-P077', famille: 'Pompe',     site: 'Jorf Lasfar', entite: 'JCF3' },
]

// Liste des IDs uniquement (pour validation import)
export const EQUIPMENT_IDS = EQUIPMENT_LIST.map(e => e.id)

// Lookup rapide par ID
export const findEquipement = (id) => EQUIPMENT_LIST.find(e => e.id === id) || null
