-- Recréer rca_sessions avec id texte (format RCA-YYYYMMDD-XXX)
DROP TABLE IF EXISTS rca_embeddings;
DROP TABLE IF EXISTS actions;
DROP TABLE IF EXISTS rca_sessions;

CREATE TABLE rca_sessions (
  id               text primary key,
  titre            text,
  methode          text,
  statut           text default 'non-commencee',
  equip_id         text,
  niveau           integer default 2,
  source           text default 'Manuel',
  responsable      text,
  zone             text,
  phenomene        text,
  cause_arret      text,
  date_ouverture   date,
  date_heure_debut timestamptz,
  date_heure_fin   timestamptz,
  cumul_arret      numeric default 0,
  frequence        numeric default 0,
  taux_panne       numeric default 0,
  disponibilite    numeric default 100,
  participants     jsonb default '[]',
  noeuds           jsonb default '[]',
  actions_generees jsonb default '[]',
  site_id          uuid references sites(id),
  created_by       uuid references profiles(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Actions correctives
CREATE TABLE actions (
  id           uuid primary key default gen_random_uuid(),
  session_id   text references rca_sessions(id) on delete cascade,
  cause        text,
  action       text not null,
  responsable  text,
  ot           text,
  delai        text,
  statut       text default 'pas-commence',
  created_at   timestamptz default now()
);

-- Embeddings RAG
CREATE TABLE rca_embeddings (
  id         uuid primary key default gen_random_uuid(),
  session_id text references rca_sessions(id) on delete cascade,
  contenu    text not null,
  embedding  vector(1536),
  metadata   jsonb default '{}',
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS rca_embeddings_embedding_idx ON rca_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS
ALTER TABLE rca_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rca_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site isolation"  ON rca_sessions  USING (site_id = (SELECT site_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "insert own site" ON rca_sessions  FOR INSERT WITH CHECK (site_id = (SELECT site_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "update own site" ON rca_sessions  FOR UPDATE USING (site_id = (SELECT site_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "site isolation" ON actions
  USING (session_id IN (SELECT id FROM rca_sessions WHERE site_id = (SELECT site_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "insert actions" ON actions
  FOR INSERT WITH CHECK (session_id IN (SELECT id FROM rca_sessions WHERE site_id = (SELECT site_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "update actions" ON actions
  FOR UPDATE USING (session_id IN (SELECT id FROM rca_sessions WHERE site_id = (SELECT site_id FROM profiles WHERE id = auth.uid())));
