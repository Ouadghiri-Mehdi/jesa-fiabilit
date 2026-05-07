-- Mettre à jour les profils en récupérant les IDs depuis auth.users
UPDATE profiles SET
  nom = 'Ouadghiri', prenom = 'Mehdi', role = 'admin',
  email = 'mehdi@jesa.ma',
  site_id = (SELECT id FROM sites WHERE code = 'rabat')
WHERE id = (SELECT id FROM auth.users WHERE email = 'mehdi@jesa.ma');

UPDATE profiles SET
  nom = 'User', prenom = 'Chaimae', role = 'user',
  email = 'chaimae@jesa.ma',
  site_id = (SELECT id FROM sites WHERE code = 'jorf')
WHERE id = (SELECT id FROM auth.users WHERE email = 'chaimae@jesa.ma');

UPDATE profiles SET
  nom = 'User', prenom = 'Casa', role = 'user',
  email = 'casa@jesa.ma',
  site_id = (SELECT id FROM sites WHERE code = 'casa')
WHERE id = (SELECT id FROM auth.users WHERE email = 'casa@jesa.ma');

UPDATE profiles SET
  nom = 'User', prenom = 'Kherbiga', role = 'user',
  email = 'kherbiga@jesa.ma',
  site_id = (SELECT id FROM sites WHERE code = 'khb')
WHERE id = (SELECT id FROM auth.users WHERE email = 'kherbiga@jesa.ma');

-- Vérification : afficher les profils mis à jour
SELECT p.id, p.email, p.nom, p.prenom, p.role, s.nom as site
FROM profiles p
LEFT JOIN sites s ON s.id = p.site_id;
