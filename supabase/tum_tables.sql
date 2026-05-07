-- =============================================
-- TABLES TUM — Arrêts & Seuils
-- =============================================

-- Équipements (compléter la table existante)
ALTER TABLE equipements ADD COLUMN IF NOT EXISTS zone text;
ALTER TABLE equipements ADD COLUMN IF NOT EXISTS poste text;

-- Arrêts machines
CREATE TABLE IF NOT EXISTS arrets (
  id          uuid primary key default gen_random_uuid(),
  equip_id    text not null,
  site_id     uuid references sites(id),
  start_time  timestamptz not null,
  duration    numeric not null default 0,
  cause       text,
  zone        text,
  created_by  uuid references profiles(id),
  created_at  timestamptz default now()
);

-- Seuils par site
CREATE TABLE IF NOT EXISTS seuils (
  id             uuid primary key default gen_random_uuid(),
  site_id        uuid references sites(id) unique,
  n1_cumul       numeric default 8,
  n1_frequence   integer default 3,
  n1_horizon     integer default 30,
  n2_cumul       numeric default 24,
  n2_frequence   integer default 5,
  n2_horizon     integer default 30
);

-- Insérer les seuils par défaut pour chaque site
INSERT INTO seuils (site_id)
SELECT id FROM sites
ON CONFLICT (site_id) DO NOTHING;

-- RLS
ALTER TABLE arrets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE seuils  ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site isolation" ON arrets
  USING (site_id = (SELECT site_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "site isolation" ON seuils
  USING (site_id = (SELECT site_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "site isolation" ON equipements
  USING (site_id = (SELECT site_id FROM profiles WHERE id = auth.uid()));
